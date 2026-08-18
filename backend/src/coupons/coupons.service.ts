import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from './coupon.entity';
import { AiService } from '../ai/ai.service';
import { CustomPost } from '../custom-posts/custom-post.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { Post } from '../posts/post.entity';
import { LinksService } from '../links/links.service';
import {
  CouponTier, SEQUENCE_NAME_PREFIX, SequenceAnchor, buildCouponSequence,
} from './coupon-sequence';
import { DecryptedCredentials } from '../credentials/credentials.service';

export interface ParsedCoupon {
  code: string;
  discount_usd: number;
  min_spend_usd: number;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon) private readonly repo: Repository<Coupon>,
    private readonly ai: AiService,
    // The launch sequence writes custom_posts rows DIRECTLY (their dispatcher picks them
    // up regardless of author) — importing CustomPostsService would close a module cycle:
    // Posts → Coupons → CustomPosts → Posts.
    @InjectRepository(CustomPost) private readonly customPosts: Repository<CustomPost>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    private readonly links: LinksService,
  ) {}

  /**
   * (Re)build the coupon LAUNCH SEQUENCE for the owner's current batch — see
   * coupon-sequence.ts for what each stage is and why the numbers are code-built.
   *
   * Called after every import/add. Replace-semantics: previous sequence rows that have
   * not yet been sent are deleted first (only rows carrying OUR name prefix — never the
   * owner's hand-written custom posts), so editing dates or re-importing reshapes the
   * sequence instead of doubling it. Best-effort end to end: a failure here must never
   * fail the import that triggered it.
   */
  async syncLaunchSequence(
    userId: string, creds: DecryptedCredentials | null,
  ): Promise<{ created: number; groups: number; stages: string[]; reason?: string }> {
    const none = (reason: string) => ({ created: 0, groups: 0, stages: [] as string[], reason });
    try {
      // The batch = active coupons sharing the LATEST start date. Older windows are
      // yesterday's campaign; mixing them would advertise codes about to die.
      const all = await this.repo.find({ where: { user_id: userId, is_active: true } });
      const dated = all.filter((c) => c.starts_at);
      if (!dated.length) return none('לקופונים אין תאריך התחלה — אין ממה לבנות רצף');
      const latestStart = Math.max(...dated.map((c) => new Date(c.starts_at!).getTime()));
      const batch = dated.filter((c) => new Date(c.starts_at!).getTime() === latestStart);
      const startsAt = new Date(latestStart);
      const endsAt = batch[0].ends_at ? new Date(batch[0].ends_at) : null;
      if (endsAt && endsAt.getTime() <= Date.now()) return none('חלון הקופונים כבר הסתיים');

      // Target groups: what the owner's active AliExpress autopilots publish to. FLYLINK
      // groups are excluded by construction — the codes redeem only at AliExpress checkout.
      const active = await this.campaigns.find({ where: { user_id: userId, status: 'active', source: 'aliexpress' } });
      const groups = new Set<string>();
      for (const c of active) {
        let platforms: string[] | null = null;
        try { platforms = c.target_platforms ? JSON.parse(c.target_platforms) : null; } catch { platforms = null; }
        if (platforms && !platforms.map((x) => String(x).toLowerCase()).includes('telegram')) continue;
        try { for (const g of JSON.parse(c.target_channels || '[]')) if (g) groups.add(String(g)); } catch { /* ignore */ }
      }
      if (!groups.size) return none('אין קבוצות טלגרם שמקבלות מוצרי אלי אקספרס');

      const tiers: CouponTier[] = batch.map((c) => ({
        code: c.code, discount_usd: c.discount_usd, min_spend_usd: c.min_spend_usd,
      }));

      const sequence = buildCouponSequence({
        tiers, startsAt, endsAt, now: new Date(),
        hook: await this.sequenceHook(creds, tiers.length),
        anchor: await this.sequenceAnchor(userId, tiers),
      });
      if (!sequence.length) return none('כל שלבי הרצף כבר מאחורינו');

      // Replace, never stack: drop OUR unsent rows only.
      await this.customPosts.createQueryBuilder()
        .delete()
        .where('user_id = :userId', { userId })
        .andWhere('name LIKE :prefix', { prefix: `${SEQUENCE_NAME_PREFIX}%` })
        .andWhere('(last_sent_at IS NULL AND (next_send_at IS NULL OR next_send_at > now()))')
        .execute()
        .catch(() => {});

      const channels = [...groups];
      for (const post of sequence) {
        await this.customPosts.save(this.customPosts.create({
          user_id: userId,
          name: post.name,
          body: post.body,
          image_urls: null,
          target_channels: channels,
          send_at: post.sendAt,
          repeat: 'none',
          enabled: true,
          next_send_at: post.sendAt,
        }));
      }
      return { created: sequence.length, groups: groups.size, stages: sequence.map((s) => s.stage) };
    } catch (err: any) {
      return none(err?.message || 'בניית הרצף נכשלה');
    }
  }

  /**
   * One AI hook line for the teaser — color only, sanitizeHook guarantees no digits.
   *
   * TIME-BOXED to 4s: this runs INSIDE the save request, and the browser gives up at 15s —
   * a slow model turned "save coupons" into a spinner that ended in a red "הייבוא נכשל"
   * while the server actually finished the work. A late answer is simply dropped; the
   * stock hook is a fine teaser opener.
   */
  private async sequenceHook(creds: DecryptedCredentials | null, tierCount: number): Promise<string | null> {
    if (!creds) return null;
    try {
      const res = await Promise.race([
        this.hookCall(creds, tierCount),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      return res;
    } catch {
      return null;
    }
  }

  private async hookCall(creds: DecryptedCredentials, tierCount: number): Promise<string | null> {
    try {
      const res = await this.ai.generate(creds, {
        system: 'כתוב שורת פתיחה אחת בעברית לפוסט טלגרם שמבשר על קופוני הנחה חדשים באלי אקספרס. '
          + 'נלהבת אך לא צעקנית, עד 90 תווים, בלי מספרים ובלי אחוזים (הם מוצגים בנפרד), אימוג׳י אחד לכל היותר. '
          + `יש ${tierCount} קופונים. ענה בשורה בלבד, ללא הסברים.`,
        prompt: 'שורת הפתיחה:',
        maxTokens: 60,
        temperature: 0.9,
      });
      return res?.text || null;
    } catch {
      return null;
    }
  }

  /**
   * A real, recently-posted product priced just above a tier minimum — the mid-post's
   * worked example. "This item is $38; over $35 the code takes $5 off" converts where an
   * abstract ladder doesn't. Best-effort: no candidate simply means the generic mid body.
   */
  private async sequenceAnchor(userId: string, tiers: CouponTier[]): Promise<SequenceAnchor | null> {
    try {
      const sorted = [...tiers].sort((a, b) => a.min_spend_usd - b.min_spend_usd);
      const recent = await this.posts.createQueryBuilder('p')
        .where('p.user_id = :userId', { userId })
        .andWhere("p.status = 'sent'")
        .andWhere('p.sale_price_usd > 0')
        .andWhere('p.affiliate_url IS NOT NULL')
        // The example must itself be an AliExpress item — a FLYLINK product can't redeem.
        .andWhere("p.affiliate_url LIKE '%aliexpress%'")
        .orderBy('p.sent_at', 'DESC')
        .take(50)
        .getMany();
      for (const tier of sorted) {
        const hit = recent.find((p) =>
          p.sale_price_usd >= tier.min_spend_usd && p.sale_price_usd <= tier.min_spend_usd * 1.3);
        if (hit) {
          let link = hit.affiliate_url;
          try {
            const code = await this.links.ensureCode(hit);
            if (code) {
              void this.links.recordTarget(code, hit.affiliate_url, userId);
              link = this.links.shortUrl(code);
            }
          } catch { /* raw affiliate link is an acceptable fallback */ }
          return {
            title: String(hit.product_title || '').slice(0, 60),
            priceUsd: +hit.sale_price_usd.toFixed(2),
            tierMin: tier.min_spend_usd,
            code: tier.code,
            saveUsd: tier.discount_usd,
            link,
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Words that look like a coupon code but aren't — AliExpress wording changes between
   * campaigns, so we identify the code STRUCTURALLY (an uppercase token) and reject the
   * vocabulary around it rather than relying on any one phrasing.
   */
  private static readonly STOPWORDS = new Set([
    'OFF', 'USD', 'US', 'SAVE', 'CODE', 'CODES', 'COUPON', 'COUPONS', 'GET', 'ALL', 'AND',
    'FOR', 'THE', 'MIN', 'MAX', 'OVER', 'ORDERS', 'ORDER', 'EXTRA', 'NEW', 'SALE', 'ONLY',
    'UP', 'TO', 'ON', 'WITH', 'SPEND', 'DISCOUNT', 'PROMO', 'LIMITED', 'FREE', 'SHIPPING',
    'IL', 'ILS', 'NIS', 'AM', 'PM', 'TUE', 'MON', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
  ]);

  /**
   * Parse a pasted AliExpress coupon block. Deliberately format-AGNOSTIC: rather than
   * matching one phrasing, each line is scanned for (a) an uppercase code token and
   * (b) two money amounts. Handles all of these:
   *   "ILAFF1  $2 OFF $15+"        "ILAFF3 - US $7 off US $55"
   *   "ILAFF7: $55 OFF $449+"      "ILAFF2 — Save $4 on orders over $30"
   *   "$10 OFF $80+ (code: ILAFF4)"  "ILAFF5 (25$ off 209$)"
   * Non-coupon lines (titles, promo period, "---") yield no match and are skipped.
   */
  parse(text: string): ParsedCoupon[] {
    const out: ParsedCoupon[] = [];
    const seen = new Set<string>();

    for (const rawLine of (text || '').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || /^[-=_*\s]+$/.test(line)) continue;

      // 1) The code FIRST: an all-caps token that isn't part of the surrounding vocabulary.
      let code = '';
      let codeIdx = -1;
      let codeLen = 0;
      const codeRe = /\b([A-Z][A-Z0-9_-]{2,31})\b/g;
      let cm: RegExpExecArray | null;
      while ((cm = codeRe.exec(line)) !== null) {
        const cand = cm[1].toUpperCase();
        if (CouponsService.STOPWORDS.has(cand)) continue;
        if (!/[A-Z]/.test(cand)) continue; // must contain a letter — never a bare number
        code = cand; codeIdx = cm.index; codeLen = cm[1].length;
        break;
      }
      if (!code) continue;

      // 2) Strip the code out before reading money. Codes end in digits ("ILAFF1"), and in
      // "ILAFF1  $2" that trailing 1 would otherwise be read as the amount "1$" — silently
      // producing a WRONG discount, which is worse than failing to parse.
      const rest = `${line.slice(0, codeIdx)} ${line.slice(codeIdx + codeLen)}`;

      // 3) Money in any notation: "$15", "US $15", "15$", "15 USD". Note the word boundary
      // belongs to USD only — "\$\b" never matches "25$ off" (space after $ isn't a boundary).
      const amounts: number[] = [];
      const amountRe = /(?:US\s*)?\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:\$|USD\b)/gi;
      let am: RegExpExecArray | null;
      while ((am = amountRe.exec(rest)) !== null) {
        const n = parseFloat((am[1] ?? am[2]).replace(',', '.'));
        if (Number.isFinite(n)) amounts.push(n);
      }
      if (amounts.length < 2) continue; // a coupon line always carries discount + threshold

      // A discount is always SMALLER than the spend threshold it unlocks — so regardless of
      // which order the wording puts them in, the smaller amount is the discount.
      const discount = Math.min(amounts[0], amounts[1]);
      const min = Math.max(amounts[0], amounts[1]);
      if (discount <= 0 || min <= 0 || discount >= min) continue;
      if (seen.has(code)) continue;
      seen.add(code);
      out.push({ code, discount_usd: discount, min_spend_usd: min });
    }
    return out;
  }

  /** Manually add/update one coupon — the guaranteed fallback when parsing can't cope. */
  async upsertOne(userId: string, data: {
    code: string; discount_usd: number; min_spend_usd: number;
    campaign?: string; starts_at?: string; ends_at?: string;
  }): Promise<Coupon> {
    const code = (data.code || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('נא להזין קוד קופון');
    const discount = Number(data.discount_usd);
    const min = Number(data.min_spend_usd);
    if (!Number.isFinite(discount) || discount <= 0) throw new BadRequestException('סכום ההנחה חייב להיות גדול מ-0');
    if (!Number.isFinite(min) || min < 0) throw new BadRequestException('סף הקנייה לא תקין');
    if (discount >= min && min > 0) throw new BadRequestException('ההנחה חייבת להיות קטנה מסף הקנייה');

    const existing = await this.repo.findOne({ where: { user_id: userId, code } });
    const row = existing || this.repo.create({ user_id: userId, code });
    row.discount_usd = discount;
    row.min_spend_usd = min;
    row.campaign = data.campaign?.trim() || row.campaign || null;
    row.starts_at = data.starts_at ? new Date(data.starts_at) : null;
    row.ends_at = data.ends_at ? new Date(data.ends_at) : null;
    row.is_active = true;
    return this.repo.save(row);
  }

  /** Preview only — parse without saving, so the UI can show what it found. */
  preview(text: string): ParsedCoupon[] {
    return this.parse(text);
  }

  /**
   * Validate + normalise coupon rows from an UNTRUSTED source (the AI). Applies exactly
   * the same invariants as the regex parser, so a hallucinated or malformed row is dropped
   * rather than saved. Never trust model output straight into the DB.
   */
  private sanitize(rows: any[]): ParsedCoupon[] {
    const out: ParsedCoupon[] = [];
    const seen = new Set<string>();
    for (const r of Array.isArray(rows) ? rows : []) {
      const code = String(r?.code ?? '').trim().toUpperCase();
      const discount = Number(r?.discount_usd);
      const min = Number(r?.min_spend_usd);
      if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) continue;   // plausible code shape only
      if (!Number.isFinite(discount) || !Number.isFinite(min)) continue;
      if (discount <= 0 || min <= 0) continue;
      if (discount >= min) continue;                            // a discount is below its threshold
      if (seen.has(code)) continue;
      seen.add(code);
      out.push({ code, discount_usd: discount, min_spend_usd: min });
    }
    return out;
  }

  /**
   * AI fallback for text the regex can't crack (AliExpress rewords campaigns freely, and
   * some arrive as prose or a table dump). Costs one AI generation, so the UI only calls
   * this on demand. Output is schema-checked by sanitize() before it can be saved.
   */
  async parseWithAi(creds: DecryptedCredentials | null, text: string): Promise<ParsedCoupon[]> {
    const body = (text || '').trim();
    if (!body) return [];
    const result = await this.ai.generate(creds, {
      system:
        'You extract discount coupon tiers from marketing text. Reply with JSON ONLY — no prose, ' +
        'no markdown fence. Schema: {"coupons":[{"code":string,"discount_usd":number,"min_spend_usd":number}]}. ' +
        'code = the literal code the buyer types at checkout. discount_usd = money taken off. ' +
        'min_spend_usd = the minimum order value that unlocks it. Convert every amount to a plain ' +
        'USD number (strip $, US$, USD). A discount is always smaller than its own minimum spend. ' +
        'Ignore percentage-only offers and any line without both a code and two amounts. ' +
        'If none are present return {"coupons":[]}.',
      prompt: body.slice(0, 6000),
      maxTokens: 700,
      temperature: 0, // extraction, not creativity
    });
    if (!result?.text) return [];
    // Models still occasionally wrap JSON in a fence or add a sentence — grab the object.
    const raw = result.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return [];
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      return this.sanitize(parsed?.coupons);
    } catch {
      return [];
    }
  }

  /**
   * Import a pasted block. Replaces any existing coupon with the same code for this user
   * (re-pasting an updated campaign refreshes it instead of duplicating).
   */
  async importText(userId: string, text: string, opts: {
    campaign?: string; starts_at?: string; ends_at?: string;
  }): Promise<{ imported: number; coupons: Coupon[] }> {
    const parsed = this.parse(text);
    if (!parsed.length) {
      throw new BadRequestException('לא זוהו קודי קופון בטקסט — הדבק שורות בפורמט "ILAFF1 $2 OFF $15+"');
    }
    const starts_at = opts.starts_at ? new Date(opts.starts_at) : null;
    const ends_at = opts.ends_at ? new Date(opts.ends_at) : null;
    if (starts_at && ends_at && ends_at <= starts_at) {
      throw new BadRequestException('תאריך הסיום חייב להיות אחרי תאריך ההתחלה');
    }

    const saved: Coupon[] = [];
    for (const p of parsed) {
      const existing = await this.repo.findOne({ where: { user_id: userId, code: p.code } });
      const row = existing || this.repo.create({ user_id: userId, code: p.code });
      row.discount_usd = p.discount_usd;
      row.min_spend_usd = p.min_spend_usd;
      row.campaign = opts.campaign?.trim() || row.campaign || null;
      row.starts_at = starts_at;
      row.ends_at = ends_at;
      row.is_active = true;
      saved.push(await this.repo.save(row));
    }
    return { imported: saved.length, coupons: saved };
  }

  list(userId: string): Promise<Coupon[]> {
    return this.repo.find({ where: { user_id: userId }, order: { min_spend_usd: 'ASC' } });
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const c = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!c) throw new NotFoundException('קופון לא נמצא');
    await this.repo.remove(c);
    return { deleted: true };
  }

  async setActive(userId: string, id: string, active: boolean): Promise<Coupon> {
    const c = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!c) throw new NotFoundException('קופון לא נמצא');
    c.is_active = active;
    return this.repo.save(c);
  }

  /**
   * Edit a SAVED coupon's campaign label and validity window.
   *
   * The import form carries these three fields, so they could only ever be set at the
   * moment of import — an owner who pasted a batch first and named the sale afterwards was
   * left with eight coupons reading "—" and no way to fix them but delete and re-import.
   * The code, discount and minimum spend stay immutable here: those came from AliExpress
   * and editing them would quietly misprice a live post.
   */
  async update(
    userId: string, id: string,
    patch: { campaign?: string | null; starts_at?: string | null; ends_at?: string | null },
  ): Promise<Coupon> {
    const c = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!c) throw new NotFoundException('קופון לא נמצא');
    if (patch.campaign !== undefined) {
      const name = String(patch.campaign ?? '').trim();
      c.campaign = name || null; // an emptied field clears the label rather than storing ''
    }
    const when = (v: string | null | undefined): Date | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || !String(v).trim()) return null;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('תאריך לא תקין');
      return d;
    };
    const from = when(patch.starts_at);
    const to = when(patch.ends_at);
    if (from !== undefined) c.starts_at = from;
    if (to !== undefined) c.ends_at = to;
    // A window that ends before it starts would silently never match a product.
    if (c.starts_at && c.ends_at && c.ends_at.getTime() <= c.starts_at.getTime()) {
      throw new BadRequestException('תאריך הסיום חייב להיות אחרי תאריך ההתחלה');
    }
    return this.repo.save(c);
  }

  /**
   * The coupon to show for a product priced `priceUsd`.
   *
   * AliExpress coupons apply to the CART TOTAL, not to a single item — so a product below
   * every tier is not "no coupon", it's "not there yet". Two outcomes:
   *  • qualifies:true  — the price already clears a tier; return the biggest discount.
   *  • qualifies:false — nothing clears yet; return the CHEAPEST tier as an incentive to
   *    add another item (which is also what grows the commission).
   *
   * priceUsd <= 0 still returns null — that's what keeps AliExpress coupons off FLYLINK
   * posts, which carry no USD price.
   */
  async bestFor(
    userId: string,
    priceUsd: number,
    at: Date = new Date(),
  ): Promise<{ coupon: Coupon; qualifies: boolean } | null> {
    if (!priceUsd || priceUsd <= 0) return null;
    const valid = await this.repo
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.is_active = true')
      .andWhere('(c.starts_at IS NULL OR c.starts_at <= :at)', { at })
      .andWhere('(c.ends_at IS NULL OR c.ends_at >= :at)', { at })
      .getMany();
    if (!valid.length) return null;

    const qualified = valid
      .filter((c) => c.min_spend_usd <= priceUsd)
      .sort((a, b) => b.discount_usd - a.discount_usd || b.min_spend_usd - a.min_spend_usd);
    if (qualified.length) return { coupon: qualified[0], qualifies: true };

    // Below every tier → the entry tier, framed as "add one more item".
    const cheapest = valid.slice().sort((a, b) => a.min_spend_usd - b.min_spend_usd)[0];
    return { coupon: cheapest, qualifies: false };
  }

  /**
   * The exact line appended to a post. Kept here so the send path and the composer
   * preview can never drift apart and show the user something different from what ships.
   *
   * The amounts are shown in the post's own currency, because the rest of the post already
   * is: a shopper reading "₪89 במקום ₪150" and then "$7 הנחה בקנייה מעל $55" has to do the
   * conversion themselves to find out whether they qualify, and most simply will not.
   *
   * The CODE itself is never touched. It is issued by AliExpress and typed at their
   * checkout — a prettier or rebranded code is a code that does not work.
   *
   * Pass no `money` and it renders in USD exactly as before.
   */
  couponLine(coupon: Coupon, qualifies: boolean, money?: { rate: number; symbol: string }): string {
    const { discount, minSpend, symbol } = this.couponAmounts(coupon, money);
    // Two lines, in the order a shopper actually needs them: first WHAT they get and from
    // what basket, then the code to type. Packed onto one line — "קוד קופון: ILAFF3 — ₪25
    // הנחה בקנייה מעל ₪204" — the code sat in the middle of the sentence and the eye had
    // nothing to separate the offer from the thing to copy.
    const lines = [
      `🎟️ הנחה של ${symbol}${discount} בקנייה מעל ${symbol}${minSpend}`,
      `🔑 קוד לקופה: ${coupon.code}`,
    ];
    if (!qualifies) lines.push('💡 הוסף עוד פריט לסל כדי לנצל את ההנחה');
    return lines.join('\n');
  }

  /**
   * The two amounts as the shopper should read them, rounded in the direction that cannot
   * mislead.
   *
   * AliExpress enforces the tier in USD, at its own rate, on the day of purchase — our
   * converted number is a guide, never the rule. So the minimum spend rounds UP and the
   * discount rounds DOWN: the worst case is a shopper who adds a little more than they
   * strictly had to, instead of one who reaches checkout, finds the coupon rejected, and
   * concludes the group posts codes that do not work.
   */
  private couponAmounts(
    coupon: Coupon, money?: { rate: number; symbol: string },
  ): { discount: number; minSpend: number; symbol: string } {
    const rate = Number(money?.rate);
    // No usable rate → USD, unconverted. Showing a shekel sign against a dollar amount
    // would be worse than showing dollars honestly.
    if (!money || !Number.isFinite(rate) || rate <= 0 || money.symbol === '$') {
      return { discount: coupon.discount_usd, minSpend: coupon.min_spend_usd, symbol: '$' };
    }
    return {
      discount: Math.floor(coupon.discount_usd * rate),
      minSpend: Math.ceil(coupon.min_spend_usd * rate),
      symbol: money.symbol,
    };
  }
}

/** The currency symbol for a rates pair ('USD_ILS' → '₪'). */
export function currencySymbol(pair?: string | null): string {
  const p = String(pair || 'USD_ILS');
  if (p.includes('ILS')) return '₪';
  if (p.includes('EUR')) return '€';
  if (p.includes('GBP')) return '£';
  return '$';
}
