import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import axios from 'axios';
import { Post } from '../posts/post.entity';
import { CredentialsService } from '../credentials/credentials.service';
import { cacheGet, cacheSet } from '../common/safe-cache';

const API = 'https://api.pinterest.com/v5';
/** Pinterest refreshes pin analytics roughly daily — 1h cache spares the rate limit. */
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface PinAnalytics {
  post_id: string;
  pin_id: string;
  title: string;
  image: string;
  sent_at: Date | null;
  impressions: number;
  saves: number;
  pin_clicks: number;
  outbound_clicks: number;
}

export interface PinterestAnalyticsResult {
  available: boolean;
  /** Human-readable reason when unavailable (no token / API rejected). */
  reason?: string;
  totals: { impressions: number; saves: number; pin_clicks: number; outbound_clicks: number; pins: number } | null;
  pins: PinAnalytics[];
}

@Injectable()
export class PinterestService {
  private readonly logger = new Logger(PinterestService.name);

  constructor(
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    private readonly credentials: CredentialsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Pull each recent Pin's OUTBOUND clicks into posts.pinterest_clicks — the signal that
   * lets the learning engine judge Pinterest keywords at all.
   *
   * Outbound clicks (not impressions, not saves) are the money metric: a shopper who left
   * Pinterest for the affiliate link. That makes them the direct equivalent of a /r/ click
   * on the other platforms, so once they are stored, every existing rule — keyword
   * retirement, the boost, copy-angle scoring, winner recycling — works on Pinterest
   * unchanged, without a parallel set of Pinterest-specific rules to keep in sync.
   *
   * SET, never incremented: analytics returns a running total, so re-syncing is idempotent.
   * Best-effort throughout — a failed sync leaves yesterday's numbers, never a wrong one.
   */
  async syncPinClicks(userId: string, days = 30): Promise<{ updated: number; reason?: string }> {
    const creds = await this.credentials.getRaw(userId).catch(() => null);
    const token = creds?.pinterest_access_token;
    if (!token) return { updated: 0, reason: 'no token' };

    const rows = await this.posts.find({
      where: { user_id: userId, pinterest_post_id: Not(IsNull()) },
      order: { sent_at: 'DESC' },
      take: 100,
    }).catch(() => [] as Post[]);
    const cutoff = Date.now() - days * 86_400_000;
    const recent = rows.filter((p) => !p.sent_at || p.sent_at.getTime() > cutoff);
    if (!recent.length) return { updated: 0 };

    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    const day = (d: Date) => d.toISOString().slice(0, 10);

    let updated = 0;
    // Sequential on purpose: a burst of these trips Pinterest's per-second limit.
    for (const post of recent) {
      const res = await axios.get(`${API}/pins/${post.pinterest_post_id}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { start_date: day(start), end_date: day(end), metric_types: 'OUTBOUND_CLICK' },
        timeout: 10_000,
        validateStatus: () => true,
      }).catch(() => null);
      // A dead token or a tier without analytics fails identically for every remaining
      // pin — stop rather than spend 99 more calls proving it.
      if (!res || res.status === 401 || res.status === 403) break;
      if (res.status !== 200) continue;
      const clicks = Number(res.data?.all?.summary_metrics?.OUTBOUND_CLICK) || 0;
      if (clicks !== post.pinterest_clicks) {
        await this.posts.update({ id: post.id }, { pinterest_clicks: clicks }).catch(() => {});
        updated++;
      }
    }
    if (updated) this.logger.log(`pinterest click sync: ${updated} posts updated for ${userId}`);
    return { updated };
  }

  /**
   * The user's Pinterest boards, for picking the publish target in settings.
   *
   * A board's NUMERIC id is what the publish API needs, and it appears nowhere in the
   * Pinterest UI — the board URL carries a slug, not the id — so without this the owner
   * had no way to obtain it short of calling the API by hand. An empty list is a real,
   * common answer on a fresh account: Pinterest creates no board for you, and the reason
   * says so rather than leaving an empty dropdown to interpret.
   */
  async boards(userId: string): Promise<{ boards: Array<{ id: string; name: string }>; reason?: string }> {
    const creds = await this.credentials.getRaw(userId).catch(() => null);
    const token = creds?.pinterest_access_token;
    if (!token) return { boards: [], reason: 'לא הוגדר טוקן פינטרסט — הדבק אותו ושמור, ואז נסה שוב.' };

    const res = await axios.get(`${API}/boards`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page_size: 50 },
      timeout: 10_000,
      validateStatus: () => true,
    }).catch((err: any) => ({ status: 0, data: { message: err.message } } as any));

    if (res.status === 401 || res.status === 403) {
      // Describe the STORED token without revealing it. A 401 has three very different
      // causes — a sandbox token (which can never work: we always call the production
      // host), a truncated paste, and a wrong string — and prefix+length tells them apart
      // in one look instead of another round of guessing. `pina_` is Pinterest's public
      // prefix and the length is not a secret; the token itself is never echoed.
      const shape = `הטוקן השמור: ${token.length} תווים`
        + (token.startsWith('pina_') ? ', מתחיל ב-pina_ (תקין)' : `, מתחיל ב-"${token.slice(0, 5)}" — לא נראה כמו טוקן פינטרסט`);
      return {
        boards: [],
        reason: `פינטרסט דחה את הטוקן (${res.status}). ${shape}. `
          + `סיבה נפוצה: הטוקן נוצר ב"ארגז חול" — טוקן כזה לעולם לא יעבוד מול הסביבה האמיתית. `
          + `צור מחדש עם "הייצור מוגבל" ועם ההרשאות boards:read + pins:write. ${res.data?.message || ''}`.trim(),
      };
    }
    if (res.status !== 200) {
      return { boards: [], reason: `שליפת הלוחות נכשלה (${res.status}) ${res.data?.message || ''}`.trim() };
    }

    const boards = (res.data?.items || [])
      .map((b: any) => ({ id: String(b.id), name: String(b.name || b.id) }))
      .filter((b: { id: string }) => b.id);
    if (!boards.length) {
      return { boards: [], reason: 'לא נמצאו לוחות בחשבון — צור לוח אחד בפינטרסט ואז לחץ לרענון.' };
    }
    return { boards };
  }

  /**
   * Per-pin performance (last 30 days) for the user's published Pins, aggregated from
   * Pinterest's pin-analytics API. Reads the SAME pins the publisher created
   * (posts.pinterest_post_id). Degrades gracefully: no token / Trial-tier rejections
   * come back as { available: false, reason } instead of a 500 — the UI explains.
   */
  async analytics(userId: string): Promise<PinterestAnalyticsResult> {
    const creds = await this.credentials.getRaw(userId).catch(() => null);
    const token = creds?.pinterest_access_token;
    if (!token) {
      return { available: false, reason: 'לא הוגדר טוקן פינטרסט בהגדרות ← אינטגרציות.', totals: null, pins: [] };
    }

    const cacheKey = `pinterest_analytics_${userId}`;
    const cached = await cacheGet<PinterestAnalyticsResult>(this.cache, cacheKey);
    if (cached) return cached;

    const rows = await this.posts.find({
      where: { user_id: userId, pinterest_post_id: Not(IsNull()) },
      order: { sent_at: 'DESC' },
      take: 50,
    });
    if (!rows.length) {
      return { available: true, totals: { impressions: 0, saves: 0, pin_clicks: 0, outbound_clicks: 0, pins: 0 }, pins: [] };
    }

    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86_400_000);
    const day = (d: Date) => d.toISOString().slice(0, 10);

    const pins: PinAnalytics[] = [];
    let authFailure: string | null = null;

    // Sequential on purpose: 50 calls in a burst trips Pinterest's per-second limit.
    for (const post of rows) {
      if (authFailure) break;
      try {
        const res = await axios.get(`${API}/pins/${post.pinterest_post_id}/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            start_date: day(start),
            end_date: day(end),
            metric_types: 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK',
          },
          timeout: 10_000,
          validateStatus: () => true,
        });
        if (res.status === 401 || res.status === 403) {
          // Token dead or the tier doesn't allow analytics — no point hammering 49 more pins.
          authFailure = res.data?.message || `Pinterest analytics rejected (${res.status})`;
          break;
        }
        const m = res.data?.all?.summary_metrics || {};
        pins.push({
          post_id: post.id,
          pin_id: post.pinterest_post_id,
          title: post.product_title || '',
          image: post.product_image || '',
          sent_at: post.sent_at || null,
          impressions: Number(m.IMPRESSION) || 0,
          saves: Number(m.SAVE) || 0,
          pin_clicks: Number(m.PIN_CLICK) || 0,
          outbound_clicks: Number(m.OUTBOUND_CLICK) || 0,
        });
      } catch (err: any) {
        this.logger.warn(`pin ${post.pinterest_post_id} analytics failed: ${err.message}`);
      }
    }

    if (authFailure && !pins.length) {
      return { available: false, reason: authFailure, totals: null, pins: [] };
    }

    const totals = pins.reduce(
      (t, p) => ({
        impressions: t.impressions + p.impressions,
        saves: t.saves + p.saves,
        pin_clicks: t.pin_clicks + p.pin_clicks,
        outbound_clicks: t.outbound_clicks + p.outbound_clicks,
        pins: t.pins + 1,
      }),
      { impressions: 0, saves: 0, pin_clicks: 0, outbound_clicks: 0, pins: 0 },
    );

    // Best-performing first — outbound clicks are the money metric (they hit the affiliate link).
    pins.sort((a, b) => b.outbound_clicks - a.outbound_clicks || b.impressions - a.impressions);

    const result: PinterestAnalyticsResult = { available: true, totals, pins };
    await cacheSet(this.cache, cacheKey, result, CACHE_TTL_MS);
    return result;
  }
}
