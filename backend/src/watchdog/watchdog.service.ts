import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { CronTime } from 'cron';
import axios from 'axios';
import { Post } from '../posts/post.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { SecurityService } from '../security/security.service';
import { CredentialsService } from '../credentials/credentials.service';
import { ChannelsService } from '../channels/channels.service';
import { formatTelegramAlert } from './alert-format';
import {
  CtrRegression, MIN_BASELINE_CLICKS, MIN_DROP_PERCENT, MIN_POSTS_PER_WINDOW,
  detectCtrRegressions, regressionLine,
} from './regression';

/** The window a campaign is judged on, and the stretch of its own past it is judged against.
 *  Three weeks of baseline absorbs a single odd week; one week of "recent" still reacts fast. */
const RECENT_DAYS = 7;
const BASELINE_DAYS = 21;

/** The tightest interval (minutes) a cron fires at — min gap over its next few fires.
 *  Hourly → 60, every-2h → 120. null when the expression can't be parsed. */
function cronBaseIntervalMin(expr: string): number | null {
  try {
    const ct = new CronTime(expr);
    let from = new Date();
    let min = Infinity;
    for (let i = 0; i < 4; i++) {
      const a = ct.getNextDateFrom(from).toJSDate();
      const b = ct.getNextDateFrom(new Date(a.getTime() + 1000)).toJSDate();
      min = Math.min(min, (b.getTime() - a.getTime()) / 60_000);
      from = new Date(b.getTime() + 1000);
    }
    return Number.isFinite(min) && min > 0 ? Math.round(min) : null;
  } catch { return null; }
}

/**
 * 24/7 self-monitoring. Every 15 minutes the watchdog scans for anomalies that
 * historically required the owner to notice by eye — stuck scheduled posts, a
 * failure spike, campaigns whose runs stopped — and REPORTS them:
 *
 *  1. GitHub issue (when GITHUB_WATCHDOG_TOKEN is set): title-prefixed
 *     '[watchdog]', full Hebrew diagnostics. A scheduled Claude session polls
 *     these hourly, investigates, fixes and pushes — closing the loop without
 *     the owner in the middle.
 *  2. Email to every admin (best effort, needs SMTP).
 *
 * Each anomaly key is throttled (6h) so a persisting condition doesn't spam,
 * and the GitHub reporter also dedupes against open '[watchdog]' issues.
 */
/**
 * One detected problem, carrying two audiences at once.
 *
 * `body` is for the GitHub issue: markdown, raw ids, investigation hints — written for
 * whoever fixes the code. `details` is for the owner's Telegram: plain lines naming WHICH
 * campaign or channel is affected, no markup (the DM is sent without parse_mode, so
 * backticks and asterisks would show up literally) and no debugging pointers. Sending only
 * the title, as this did before, told the owner something broke without saying what.
 */
export interface WatchdogAlert {
  key: string;
  title: string;
  body: string;
  /** Owner-facing lines, one per affected campaign/channel. */
  details?: string[];
  /** Set when only the user can fix it — surfaced prominently instead of "Claude will handle it". */
  action?: string;
}

@Injectable()
export class WatchdogService implements OnModuleInit {
  private readonly logger = new Logger(WatchdogService.name);
  private running = false;
  /** anomaly key → last-reported ms; suppresses repeats for THROTTLE_MS. */
  private readonly reported = new Map<string, number>();
  private static readonly THROTTLE_MS = 6 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly mail: MailService,
    private readonly credentials: CredentialsService,
    private readonly security: SecurityService,
    private readonly channels: ChannelsService,
  ) {}

  @Cron('0 */15 * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const anomalies = await this.scan();
      for (const a of anomalies) {
        const last = this.reported.get(a.key) || 0;
        if (Date.now() - last < WatchdogService.THROTTLE_MS) continue;
        this.reported.set(a.key, Date.now());
        this.logger.warn(`Watchdog: ${a.key} — ${a.title}`);
        await this.reportGithub(a).catch((err) => this.logger.warn(`watchdog github failed: ${err?.message}`));
        await this.reportTelegram(a).catch((err) => this.logger.warn(`watchdog telegram failed: ${err?.message}`));
        await this.reportEmail(a).catch(() => {});
      }
      // Close the loop the other way: tell the owner on Telegram when a fault was RESOLVED
      // (a '[watchdog]' issue Claude fixed and closed), not just when one was detected.
      await this.notifyResolved().catch((err) => this.logger.warn(`watchdog resolved-notify failed: ${err?.message}`));
    } catch (err: any) {
      this.logger.error(`Watchdog tick failed: ${err?.message}`);
    } finally {
      this.running = false;
    }
  }

  /** Issue numbers already announced as resolved — one Telegram notice per issue per process. */
  private readonly resolvedNotified = new Set<number>();

  /**
   * Telegram confirmation when a watchdog issue is RESOLVED. The owner already gets a
   * "תקלה זוהתה" alert when it opens; this sends the matching "✅ טופל" when Claude fixes
   * and closes it (state_reason = completed — duplicates / not-planned are skipped). Only
   * issues closed within the last 30 min are considered (ticks run every 15 min), so a
   * backend restart never replays an old backlog of closed issues.
   */
  private async notifyResolved(): Promise<void> {
    const token = process.env.GITHUB_WATCHDOG_TOKEN;
    if (!token) return;
    if (!process.env.WATCHDOG_TELEGRAM_CHAT_ID) return; // Telegram not configured → nothing to send
    const repo = process.env.GITHUB_WATCHDOG_REPO || 'reuvenre/Nexlify';
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const res = await axios.get(
      `https://api.github.com/repos/${repo}/issues?state=closed&per_page=30&sort=updated&direction=desc`,
      { headers, timeout: 15000 },
    );
    const cutoff = Date.now() - 30 * 60_000;
    for (const i of res.data || []) {
      if (typeof i.title !== 'string' || !i.title.startsWith('[watchdog]')) continue;
      if (i.state_reason && i.state_reason !== 'completed') continue; // skip duplicate / not-planned
      const closedMs = new Date(i.closed_at || i.updated_at).getTime();
      if (!Number.isFinite(closedMs) || closedMs < cutoff) continue;
      if (this.resolvedNotified.has(i.number)) continue;
      this.resolvedNotified.add(i.number);
      const clean = i.title.replace(/^\[watchdog\]\s*/, '').trim();
      await this.sendTelegram([
        '✅ Nexlify Watchdog — התקלה טופלה:',
        '',
        clean,
        '',
        `Claude תיקן, בנה, בדק ודחף. Issue #${i.number} נסגר.`,
      ].join('\n')).catch(() => {});
    }
  }

  /**
   * Daily "good morning" digest to the owner's Telegram — sent 06:00 Israel time so
   * the night's activity is summarized even when nothing broke (the real-time alerts
   * only fire on anomalies; this is the all-clear + overnight numbers).
   */
  @Cron('0 6 * * *', { timeZone: 'Asia/Jerusalem' })
  async dailyDigest(): Promise<void> {
    try {
      const text = await this.buildDailyDigest();
      const sent = await this.sendTelegram(text);
      if (!sent) this.logger.log('Daily digest skipped — Telegram not configured');
    } catch (err: any) {
      this.logger.error(`Daily digest failed: ${err?.message}`);
    }
  }

  private async buildDailyDigest(): Promise<string> {
    const since = new Date(Date.now() - 24 * 3600_000);
    const [sent, failed, scheduled, anomalies, sec] = await Promise.all([
      this.posts.count({ where: { status: 'sent', sent_at: MoreThan(since) } }).catch(() => 0),
      this.posts.count({ where: { status: 'failed', created_at: MoreThan(since) } }).catch(() => 0),
      this.posts.count({ where: { status: 'scheduled' } }).catch(() => 0),
      this.scan().catch(() => []),
      this.security.summarySince(since).catch(() => null),
    ]);

    const date = new Date().toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem',
    });
    const lines: string[] = [`☀️ בוקר טוב! דוח Nexlify — ${date}`, ''];

    lines.push(anomalies.length
      ? `⚠️ סטטוס: ${anomalies.length} תקלות פעילות דורשות טיפול`
      : '🟢 סטטוס: הכל תקין — לילה שקט');
    lines.push('');

    lines.push('📊 24 השעות האחרונות:');
    lines.push(`• ✅ ${sent} פוסטים פורסמו`);
    if (failed) lines.push(`• ❌ ${failed} פוסטים נכשלו`);
    lines.push(`• ⏳ ${scheduled} פוסטים ממתינים בתור`);

    if (sec) {
      const secLines: string[] = [];
      if (sec.login_failed) secLines.push(`• 🔴 ${sec.login_failed} התחברויות כושלות`);
      if (sec.role_changed || sec.admin_created) secLines.push(`• 👤 ${sec.role_changed + sec.admin_created} שינויי הרשאה`);
      if (sec.password_reset_requested) secLines.push(`• 🔑 ${sec.password_reset_requested} בקשות איפוס סיסמה`);
      if (secLines.length) { lines.push('', '🔐 אבטחה:', ...secLines); }
    }

    if (anomalies.length) {
      lines.push('', '🔧 תקלות פעילות (Claude מטפל):');
      for (const a of anomalies.slice(0, 5)) lines.push(`• ${a.title}`);
    }

    return lines.join('\n');
  }

  // ── Window awareness ───────────────────────────────────────────────────────
  // The scanner must NOT flag a campaign/post as broken when it is simply outside the
  // send window (the night). Before this, every night produced a false "silent campaign"
  // (and "stuck posts") alert at ~00–01:00 Israel time, because silence was measured in
  // wall-clock hours instead of OPEN-window hours. These helpers measure only the time
  // that actually fell inside the send window.

  /** Current hour (0-23) in the given IANA timezone, DST-aware. */
  private hourInZone(date: Date, tz: string): number {
    try {
      const h = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: tz }).format(date);
      const n = parseInt(h, 10);
      return n === 24 ? 0 : n;
    } catch { return date.getHours(); }
  }

  /** Is NOW inside the [startHour, endHour) window in `tz`? Used to SUPPRESS "silent
   *  campaign" / "stuck post" alerts during the closed hours (e.g. 23:00–06:00): nothing
   *  publishes then, so a missing post is expected — the alert would only be night noise the
   *  owner can't act on. A genuine daytime silence re-surfaces the moment the window reopens. */
  private nowInWindow(win: { startHour: number; endHour: number; tz: string }): boolean {
    if (win.startHour >= win.endHour) return true; // 24h / misconfigured → always "open"
    const h = this.hourInZone(new Date(), win.tz);
    return h >= win.startHour && h < win.endHour;
  }

  /** Minutes between `from` and `to` (ms) that fell INSIDE a [startHour, endHour) daily
   *  window in `tz`. A 24h/misconfigured window counts the whole span. Stepped at 15-min
   *  granularity (the tick cadence) — cheap and DST-safe. */
  private openMinutesBetween(from: number, to: number, startHour: number, endHour: number, tz: string): number {
    if (to <= from) return 0;
    if (startHour >= endHour) return (to - from) / 60_000; // 24h window → all of it
    const STEP = 15 * 60_000;
    let open = 0;
    for (let t = from; t < to; t += STEP) {
      const h = this.hourInZone(new Date(t), tz);
      if (h >= startHour && h < endHour) open += Math.min(STEP, to - t) / 60_000;
    }
    return open;
  }

  /** Resolve the send window for a destination: the group's window, else the account's,
   *  else 9–22. Timezone is the scheduler default (group/account windows are in it). */
  private async windowFor(userId: string, groupId: string | null): Promise<{ startHour: number; endHour: number; tz: string }> {
    const tz = process.env.SCHEDULER_TZ || 'Asia/Jerusalem';
    const win = groupId ? await this.channels.getScheduleWindow(userId, groupId).catch(() => null) : null;
    const creds = await this.credentials.getRaw(userId).catch(() => null);
    return {
      startHour: win?.startHour ?? creds?.schedule_start_hour ?? 9,
      endHour: win?.endHour ?? creds?.schedule_end_hour ?? 22,
      tz,
    };
  }

  /** Resolve a CAMPAIGN's send window: its own override (with its own tz) first, else the
   *  target group's / account's window. Mirrors PostsService window precedence. */
  private async campaignWindowResolved(c: Campaign): Promise<{ startHour: number; endHour: number; tz: string }> {
    if (c.window_start_hour != null || c.window_end_hour != null || c.window_tz) {
      return {
        startHour: c.window_start_hour ?? 9,
        endHour: c.window_end_hour ?? 22,
        tz: c.window_tz || process.env.SCHEDULER_TZ || 'Asia/Jerusalem',
      };
    }
    let groups: string[] = [];
    try { groups = JSON.parse(c.target_channels || '[]'); } catch { groups = []; }
    return this.windowFor(c.user_id, groups.length ? groups[0] : null);
  }

  // ── Checks ────────────────────────────────────────────────────────────────

  /**
   * Click-through per campaign in the recent window against the baseline behind it.
   *
   * Only SENT posts are counted — an unpublished post cannot draw a click, and counting it
   * would manufacture a "drop" out of a delivery problem another check already reports.
   */
  private async ctrRegressions(): Promise<CtrRegression[]> {
    const rows: any[] = await this.campaigns.query(
      `SELECT c.id                                                        AS "campaignId",
              c.name                                                      AS "campaignName",
              c.user_id                                                   AS "userId",
              count(*) FILTER (WHERE p.sent_at > now() - ($1 || ' days')::interval)::int
                                                                          AS "recentPosts",
              coalesce(sum(p.clicks_count) FILTER (
                WHERE p.sent_at > now() - ($1 || ' days')::interval), 0)::int
                                                                          AS "recentClicks",
              count(*) FILTER (WHERE p.sent_at <= now() - ($1 || ' days')::interval)::int
                                                                          AS "baselinePosts",
              coalesce(sum(p.clicks_count) FILTER (
                WHERE p.sent_at <= now() - ($1 || ' days')::interval), 0)::int
                                                                          AS "baselineClicks"
       FROM campaigns c
       JOIN posts p ON p.campaign_id = c.id AND p.status = 'sent'
       WHERE c.status = 'active'
         AND p.sent_at > now() - ($2 || ' days')::interval
       GROUP BY c.id, c.name, c.user_id`,
      [String(RECENT_DAYS), String(RECENT_DAYS + BASELINE_DAYS)],
    );
    return detectCtrRegressions(rows.map((r) => ({
      campaignId: String(r.campaignId),
      campaignName: String(r.campaignName || ''),
      userId: String(r.userId),
      recentPosts: Number(r.recentPosts) || 0,
      recentClicks: Number(r.recentClicks) || 0,
      baselinePosts: Number(r.baselinePosts) || 0,
      baselineClicks: Number(r.baselineClicks) || 0,
    })));
  }

  private async scan(): Promise<WatchdogAlert[]> {
    const out: WatchdogAlert[] = [];
    const now = Date.now();

    // 1. Scheduled posts stuck: due for over 90 minutes. The backlog drip legitimately
    //    delays a due post up to one group interval (usually 60m) — beyond that, the
    //    release pipeline is broken (this exact failure shipped once: the group clock
    //    was stamped by Instagram-only posts and Telegram posts sat on 'מתוזמן' all day).
    const stuckCandidates = await this.posts.createQueryBuilder('p')
      .select(['p.id', 'p.user_id', 'p.product_title', 'p.scheduled_at', 'p.channel_override', 'p.campaign_id'])
      .where("p.status = 'scheduled'")
      .andWhere('p.scheduled_at < :cutoff', { cutoff: new Date(now - 90 * 60_000) })
      .orderBy('p.scheduled_at', 'ASC')
      .take(40)
      .getMany();
    // A post whose scheduled_at is in the past but whose send window has been CLOSED since
    // then (held overnight) is waiting correctly, not stuck. Measure the OPEN-window minutes
    // since it came due; only >90 min of open-window silence is a real release-pipeline stall.
    const stuck: typeof stuckCandidates = [];
    for (const p of stuckCandidates) {
      const w = await this.windowFor(p.user_id, p.channel_override || null);
      if (!this.nowInWindow(w)) continue; // window closed now (night) → not expected to send
      const openMin = this.openMinutesBetween(new Date(p.scheduled_at).getTime(), now, w.startHour, w.endHour, w.tz);
      if (openMin > 90) stuck.push(p);
      if (stuck.length >= 20) break;
    }
    if (stuck.length) {
      const oldest = new Date(stuck[0].scheduled_at).toISOString();
      out.push({
        key: `stuck_scheduled:${stuck[0].user_id}`,
        title: `${stuck.length}+ פוסטים מתוזמנים תקועים (הישן ביותר: ${oldest})`,
        body: [
          `**בדיקה:** פוסטים בסטטוס scheduled שמועדם עבר לפני יותר מ-90 דקות.`,
          `**נמצאו:** ${stuck.length} (מוצגים עד 20).`,
          '',
          ...stuck.map((p) => `- \`${p.id}\` · user \`${p.user_id}\` · group \`${p.channel_override || 'default'}\` · scheduled_at ${new Date(p.scheduled_at).toISOString()} · ${String(p.product_title || '').slice(0, 40)}`),
          '',
          'כיווני חקירה: findDueScheduledPosts (דריפ + lastTelegramSendToGroup), sendScheduled/markSent, sendScheduledPosts בסקדולר.',
        ].join('\n'),
        details: stuck.slice(0, 5).map((p) =>
          `קבוצה ${p.channel_override || 'ברירת מחדל'} · ממתין מאז ${this.hhmm(p.scheduled_at)}`
            + (p.product_title ? ` · ${String(p.product_title).slice(0, 40)}` : '')),
      });
    }

    // 2. Failure spike: more than 5 posts failed within the last hour.
    const failRow = await this.posts.createQueryBuilder('p')
      .select('COUNT(*)', 'n')
      .where("p.status = 'failed'")
      .andWhere('p.created_at > :cutoff', { cutoff: new Date(now - 60 * 60_000) })
      .getRawOne();
    const failed = parseInt(failRow?.n, 10) || 0;
    if (failed > 5) {
      const samples = await this.posts.createQueryBuilder('p')
        .select(['p.id', 'p.user_id', 'p.error_message'])
        .where("p.status = 'failed'")
        .andWhere('p.created_at > :cutoff', { cutoff: new Date(now - 60 * 60_000) })
        .take(8)
        .getMany();
      out.push({
        key: 'failure_spike',
        title: `${failed} פוסטים נכשלו בשעה האחרונה`,
        body: [
          `**בדיקה:** קצב כשלונות חריג (מעל 5 בשעה).`,
          '',
          'דוגמאות שגיאה:',
          ...samples.map((p) => `- \`${p.id}\`: ${String(p.error_message || '').slice(0, 160)}`),
        ].join('\n'),
        // The owner needs the error text, not post ids — the same message repeated 8 times
        // is one problem, and showing it once makes that obvious.
        details: [...new Set(samples.map((p) => String(p.error_message || 'שגיאה לא ידועה').slice(0, 120)))]
          .slice(0, 3),
      });
    }

    // 3. Campaign runs stopped: an ACTIVE campaign whose next_run_at is more than
    //    30 minutes in the past means the scheduler is skipping/crashing on it.
    const dead = await this.campaigns.createQueryBuilder('c')
      .select(['c.id', 'c.name', 'c.user_id', 'c.next_run_at', 'c.schedule_cron'])
      .where("c.status = 'active'")
      .andWhere('c.next_run_at < :cutoff', { cutoff: new Date(now - 30 * 60_000) })
      .take(10)
      .getMany();
    if (dead.length) {
      out.push({
        key: `dead_campaigns:${dead.map((c) => c.id).sort().join(',').slice(0, 60)}`,
        title: `${dead.length} קמפיינים פעילים שהריצה שלהם לא מתקדמת`,
        body: [
          `**בדיקה:** קמפיין active עם next_run_at שעבר לפני יותר מ-30 דקות — הסקדולר מדלג או קורס עליהם.`,
          '',
          ...dead.map((c) => `- "${c.name}" \`${c.id}\` · cron \`${c.schedule_cron}\` · next_run_at ${c.next_run_at ? new Date(c.next_run_at).toISOString() : 'null'}`),
          '',
          'כיווני חקירה: runDueCampaigns (this.running נתקע?), markRun/CronTime, חריגות בלוגים של Render.',
        ].join('\n'),
        details: dead.map((c) =>
          `"${c.name}" · הריצה הבאה נתקעה מאז ${this.hhmm(c.next_run_at)}`),
      });
    }

    // 4. Silent campaign: active, published before, but its most recent SENT post is
    //    over 3h old. Catches a campaign that RUNS (next_run_at keeps advancing) yet
    //    stops actually publishing — e.g. its slots getting stolen, or every run failing
    //    a filter. The "dead campaign" check above can't see this because next_run_at
    //    still moves. A single skipped hour is below the threshold (cadence is unknown),
    //    but a sustained silence is caught.
    const silent = await this.campaigns.createQueryBuilder('c')
      .where("c.status = 'active'")
      .andWhere('c.posts_count > 0')
      .getMany()
      .catch(() => []);
    const silentHits: string[] = [];
    const silentDetails: string[] = [];
    for (const c of silent.slice(0, 40)) {
      const row = await this.posts.createQueryBuilder('p')
        .select('MAX(p.sent_at)', 'max')
        .where('p.campaign_id = :cid', { cid: c.id })
        .andWhere("p.status = 'sent'")
        .getRawOne()
        .catch(() => null);
      const lastMs = row?.max ? new Date(row.max).getTime() : 0;
      if (!lastMs) continue;
      const win = await this.campaignWindowResolved(c);
      // NIGHT SUPPRESSION: don't alert while the campaign's window is closed (e.g. 23:00–06:00).
      // Nothing publishes then, so a missing post is expected, not a fault — alerting at 04:00
      // is noise the owner can't act on. A real daytime silence re-fires once the window reopens.
      if (!this.nowInWindow(win)) continue;
      // And measure silence in OPEN-window time only — night hours never count toward it.
      const openSilentMin = this.openMinutesBetween(lastMs, now, win.startHour, win.endHour, win.tz);
      if (openSilentMin <= 3 * 60) continue;
      const hrs = Math.round(openSilentMin / 60);

      // Self-diagnosis — say WHY it's silent instead of listing hypotheses:
      const reasons: string[] = [];

      // (a) Last failed post's error — the campaign ran but every product failed.
      const lastFail = await this.posts.createQueryBuilder('p')
        .select(['p.error_message', 'p.created_at'])
        .where('p.campaign_id = :cid', { cid: c.id })
        .andWhere("p.status = 'failed'")
        .orderBy('p.created_at', 'DESC')
        .getOne()
        .catch(() => null);
      if (lastFail?.error_message && now - new Date(lastFail.created_at).getTime() < 6 * 3600_000) {
        reasons.push(`שגיאת פוסט אחרונה: ${String(lastFail.error_message).slice(0, 160)}`);
      }

      // (b) Over-subscription: another campaign shares a target group. Under fair-share the
      //     group's rate is SPLIT, so each campaign publishing less often is EXPECTED, not a
      //     fault — suppress the alert entirely when the GROUP itself is alive (a sibling
      //     published within the shared cadence). Only a truly DEAD group is a real problem.
      let groups: string[] = [];
      try { groups = JSON.parse(c.target_channels || '[]'); } catch { groups = []; }
      let overSubscribed = false;
      if (groups.length) {
        // The group's last delivery from ANY source — sibling campaigns, the queue, and
        // MANUAL posts alike. Needed regardless of siblings: a hand-published post books
        // the group's interval slot too, making the campaign's next run skip by design.
        const grpRow = await this.posts.createQueryBuilder('p')
          .select('MAX(p.sent_at)', 'max')
          .where("p.status = 'sent'")
          .andWhere(groups.map((_g, i) => `(p.channel_override = :g${i} OR p.channel_overrides LIKE :l${i})`).join(' OR '),
            Object.fromEntries(groups.flatMap((g, i) => [[`g${i}`, g], [`l${i}`, `%"${g}"%`]])))
          .getRawOne().catch(() => null);
        const grpLastMs = grpRow?.max ? new Date(grpRow.max).getTime() : 0;

        // Group served very recently (within ~1.5 intervals)? The campaign's runs are
        // legitimately skipping on interval pacing — e.g. the owner just posted MANUALLY
        // to the group (observed: a 14:28 manual post made the 15:00 campaign run skip,
        // and the watchdog cried "silent campaign" while the pacing worked exactly as
        // designed). Re-check next sweep; alert only if the group itself goes quiet.
        if (grpLastMs && now - grpLastMs < 90 * 60_000) continue;

        const siblings = silent.filter((o) => o.id !== c.id).filter((o) => {
          let og: string[] = [];
          try { og = JSON.parse(o.target_channels || '[]'); } catch { og = []; }
          return og.some((g) => groups.includes(g));
        });
        if (siblings.length) {
          overSubscribed = true;
          // Shared group: under fair-share each campaign's expected quiet window scales
          // with the number of campaigns splitting the group's rate. Don't cry wolf while
          // the group is alive within that budget.
          const perCampaignBudget = (siblings.length + 1) * 3 * 60 * 60_000; // expected quiet window
          if (grpLastMs && now - grpLastMs < perCampaignBudget) {
            continue; // group is alive → fair-share rotation, not a fault
          }
          reasons.push(`over-subscription: הקבוצה חולקה עם ${siblings.length} קמפיינים אך שקטה לגמרי`);
        }
      }

      // (c) Pending posts waiting (scheduled but not going out).
      const pending = await this.posts.count({ where: { campaign_id: c.id, status: 'scheduled' } }).catch(() => 0);
      if (pending) reasons.push(`${pending} פוסטים ממתינים בסטטוס scheduled`);

      // (d) Strict filters that may reject every product.
      if ((c.min_rating ?? 0) >= 4.5 || (c.min_discount ?? 0) >= 40) {
        reasons.push(`פילטרים מחמירים (דירוג≥${c.min_rating ?? 0}, הנחה≥${c.min_discount ?? 0}%)`);
      }

      silentHits.push(`- "${c.name}" \`${c.id}\` · ${hrs} שעות פעילות (בתוך חלון השליחה) ללא פרסום${reasons.length ? `\n   └ ${reasons.join('\n   └ ')}` : ''}`);
      silentDetails.push(`"${c.name}" · ${hrs} שעות ללא פרסום${reasons.length ? ` — ${reasons[0]}` : ''}`);
    }
    if (silentHits.length) {
      out.push({
        key: `silent_campaigns:${silentHits.length}`,
        title: `${silentHits.length} קמפיינים פעילים שהפסיקו לפרסם (מעל 3 שעות)`,
        body: [
          '**בדיקה:** קמפיין active שפרסם בעבר אך הפוסט האחרון שיצא ממנו בן 3+ שעות — רץ אבל לא מפרסם.',
          '',
          ...silentHits,
        ].join('\n'),
        details: silentDetails,
      });
    }

    // 5. CADENCE DRIFT: a campaign that IS publishing but far SLOWER than its configured
    //    cron — e.g. every 2h when set to hourly. The silent check misses this (it does
    //    publish), so this is the gap that hid the every-2-hours bug. Compare the median
    //    real gap between recent sends to the expected cadence (cron interval, floored by
    //    the group interval and multiplied for fair-share siblings). Night gaps (window
    //    closed) are dropped so they don't masquerade as drift.
    const driftHits: string[] = [];
    const driftDetails: string[] = [];
    for (const c of silent.slice(0, 40)) {
      const expectedCron = c.schedule_cron ? cronBaseIntervalMin(c.schedule_cron) : null;
      if (!expectedCron) continue;
      // Same night suppression: don't report slow cadence while the window is closed.
      if (!this.nowInWindow(await this.campaignWindowResolved(c))) continue;

      let groups: string[] = [];
      try { groups = JSON.parse(c.target_channels || '[]'); } catch { groups = []; }
      const siblings = groups.length ? silent.filter((o) => o.id !== c.id).filter((o) => {
        let og: string[] = []; try { og = JSON.parse(o.target_channels || '[]'); } catch { og = []; }
        return og.some((g) => groups.includes(g));
      }).length : 0;
      const groupInterval = groups.length
        ? ((await this.channels.getIntervalMinutes(c.user_id, groups[0]).catch(() => null)) ?? 60)
        : 0;
      // What the campaign SHOULD publish at: its cron, but never faster than the group's
      // rate, times the fair-share divisor.
      const expected = Math.max(expectedCron, groupInterval) * (siblings + 1);

      // Recent sends (last 12h) — need a few to judge; gaps beyond 3× expected are night
      // pauses / window closes, not drift, so drop them.
      const sends = await this.posts.createQueryBuilder('p')
        .select('p.sent_at', 'sent_at')
        .where('p.campaign_id = :cid', { cid: c.id })
        .andWhere("p.status = 'sent'")
        .andWhere('p.sent_at > :since', { since: new Date(now - 12 * 3600_000) })
        .orderBy('p.sent_at', 'DESC')
        .limit(10)
        .getRawMany()
        .catch(() => []);
      const times = sends.map((s) => new Date(s.sent_at).getTime()).sort((a, b) => b - a);
      const gaps: number[] = [];
      for (let i = 0; i < times.length - 1; i++) {
        const g = (times[i] - times[i + 1]) / 60_000;
        if (g <= expected * 3) gaps.push(g); // drop night/pause gaps
      }
      if (gaps.length < 2) continue; // not enough signal
      gaps.sort((a, b) => a - b);
      const median = gaps[Math.floor(gaps.length / 2)];
      if (median > expected * 1.7) {
        driftHits.push(`- "${c.name}" \`${c.id}\` · מוגדר ~${expected} דק' בין פוסטים, בפועל ~${Math.round(median)} דק'`);
        driftDetails.push(`"${c.name}" · מוגדר ~${expected} דק' בין פוסטים, בפועל ~${Math.round(median)} דק'`);
      }
    }
    if (driftHits.length) {
      out.push({
        key: `cadence_drift:${driftHits.length}`,
        title: `${driftHits.length} קמפיינים מפרסמים לאט מהמוגדר`,
        body: [
          '**בדיקה:** קמפיין פעיל שמפרסם, אבל בקצב איטי משמעותית מהתזמון שהוגדר לו (פי 1.7 ומעלה).',
          '',
          ...driftHits,
          '',
          'כיווני חקירה: nextGroupSlot (groupBusy/grace על גבול המרווח), findDueScheduledPosts, over-subscription/fair-share, חלון השליחה.',
        ].join('\n'),
        details: driftDetails,
      });
    }

    // 6. CADENCE CONFIG MISMATCH: an active campaign whose cron is FASTER than its target
    //    group's publish interval — the group throttles it, so it publishes far slower than
    //    the user configured (e.g. autopilot "every hour" but the group is capped at every
    //    2h → posts every 2h). This is the exact blind spot the drift/silent checks miss:
    //    the cadence MATCHES the (mis)configured group rate, so nothing looks "off" — yet it
    //    contradicts what the user set on the campaign. Only a real config change fixes it,
    //    so this is a "user action required" alert, not something Claude patches in code.
    const activeCampaigns = await this.campaigns.createQueryBuilder('c')
      .where("c.status = 'active'")
      .getMany()
      .catch(() => []);
    const mismatchHits: string[] = [];
    const mismatchDetails: string[] = [];
    const seenMismatch = new Set<string>();
    for (const c of activeCampaigns) {
      const cronMin = c.schedule_cron ? cronBaseIntervalMin(c.schedule_cron) : null;
      if (!cronMin) continue;
      // Only Telegram-publishing campaigns are bound by the group's Telegram interval —
      // an Instagram/Pinterest-only campaign never competes for the group's Telegram slot.
      if (c.target_platforms && !/telegram/i.test(c.target_platforms)) continue;
      let groups: string[] = [];
      try { groups = JSON.parse(c.target_channels || '[]'); } catch { groups = []; }
      if (!groups.length) continue;
      const groupId = groups[0];
      const groupMin = await this.channels.getIntervalMinutes(c.user_id, groupId).catch(() => null);
      // The group is meaningfully SLOWER than the campaign's cron (≥30 min) → it caps the rate.
      if (groupMin == null || groupMin - cronMin < 30) continue;
      const dedupKey = `${groupId}:${cronMin}:${groupMin}`;
      if (seenMismatch.has(dedupKey)) continue;
      seenMismatch.add(dedupKey);
      const groupName = (await this.channels.getName(c.user_id, groupId).catch(() => null)) || groupId;
      mismatchHits.push(`- "${c.name}" \`${c.id}\` · הטייס מוגדר ל-~${cronMin} דק' בין פוסטים, אך מרווח הקבוצה "${groupName}" הוא ${groupMin} דק' → בפועל מפרסם כל ~${groupMin} דק'`);
      mismatchDetails.push(`"${c.name}" · מוגדר ל-${cronMin} דק', אך הקבוצה "${groupName}" מגבילה ל-${groupMin} דק'`);
    }
    if (mismatchHits.length) {
      out.push({
        key: `cadence_config_mismatch:${mismatchHits.map((h) => h).sort().join('|').slice(0, 80)}`,
        title: `${mismatchHits.length} קמפיינים שמרווח קבוצת היעד איטי מהתזמון שהוגדר בטייס`,
        body: [
          '**בדיקה:** קמפיין פעיל שה-cron שלו מהיר ממרווח הפרסום של קבוצת היעד — הקבוצה מגבילה אותו, אז הוא מפרסם לאט מכפי שהוגדר בטייס האוטומטי.',
          '',
          ...mismatchHits,
          '',
          '**נדרשת פעולת משתמש:** הגדרות ← קבוצות ← בחר את הקבוצה ← שנה את "מרווח בין פוסטים" כך שיתאים ל-cron של הקמפיין (או להיפך). זו תקלת תצורה שלא ניתן לתקן בקוד.',
        ].join('\n'),
        details: mismatchDetails,
        action: 'הגדרות ← קבוצות ← בחר את הקבוצה ← שנה את "מרווח בין פוסטים". זו תקלת תצורה — קוד לא יתקן אותה.',
      });
    }

    // 7. Business regression: a campaign that still publishes fine but stopped converting.
    //    Every other check answers "is the machine broken?" — this one catches the failure
    //    that costs money while nothing raises an error at all: posts go out, Telegram
    //    accepts them, and the group quietly stops clicking after a template edit or a
    //    change of voice. Compared against the campaign's OWN recent past, never another's.
    const regressions = await this.ctrRegressions().catch((err: any) => {
      this.logger.warn(`watchdog ctr scan failed: ${err?.message}`);
      return [] as CtrRegression[];
    });
    if (regressions.length) {
      out.push({
        // Keyed by campaign so a second group regressing later is its own alert rather
        // than being swallowed by the first one's 6h throttle.
        key: `ctr_regression:${regressions.map((r) => r.campaignId).sort().join(',').slice(0, 80)}`,
        title: `${regressions.length} קמפיינים שההמרה שלהם צנחה (הגרוע: ${regressions[0].campaignName} — ${regressions[0].dropPercent}%)`,
        body: [
          `**בדיקה:** קליקים לפוסט ב-${RECENT_DAYS} הימים האחרונים מול ${BASELINE_DAYS} הימים שלפניהם, לכל קמפיין מול עצמו.`,
          `**סף:** ירידה של ${MIN_DROP_PERCENT}%+, עם ${MIN_POSTS_PER_WINDOW}+ פוסטים בכל חלון ו-${MIN_BASELINE_CLICKS}+ קליקים בבסיס.`,
          '',
          ...regressions.map((r) =>
            `- "${r.campaignName}" \`${r.campaignId}\` · ${r.recentRate} קליקים/פוסט (${r.recentClicks}/${r.recentPosts})`
            + ` מול ${r.baselineRate} (${r.baselineClicks}/${r.baselinePosts}) → **-${r.dropPercent}%**`),
          '',
          'זו אינה תקלה טכנית — הפרסום עובד. כיווני חקירה: שינוי תבנית/פוטר לקבוצה, מילות מפתח שהוחלפו',
          'לאחרונה (retired_keywords / learned), סגנון כתיבה (copy_variant), שינוי בשעות הפרסום,',
          'או ירידה אמיתית בפעילות הקבוצה. השווה מול התאריך שבו המגמה נשברה לפני שמשנים משהו.',
        ].join('\n'),
        details: regressions.slice(0, 5).map(regressionLine),
      });
    }

    // 8. Security anomalies (brute-force, privilege escalation) from the audit log.
    //    Reported through the same channels; the 6h throttle per key still applies so
    //    an ongoing attack alerts once, not every 15 minutes.
    const sec = await this.security.scan().catch(() => []);
    out.push(...sec);

    return out;
  }

  // ── Reporters ─────────────────────────────────────────────────────────────

  /** Open a GitHub issue (deduped against open '[watchdog]' issues by title). */
  private async reportGithub(a: { key: string; title: string; body: string }): Promise<void> {
    const token = process.env.GITHUB_WATCHDOG_TOKEN;
    if (!token) return;
    const repo = process.env.GITHUB_WATCHDOG_REPO || 'reuvenre/Nexlify';
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const title = `[watchdog] ${a.title}`;

    // Dedupe against recent issues by title. An OPEN same-title issue is already being
    // handled. A CLOSED same-title issue updated within the throttle window was JUST fixed
    // (and closed) — don't immediately reopen it: the in-memory throttle that normally
    // suppresses this is wiped on every Render restart/deploy, and a persisting condition
    // (e.g. waiting for the fix to deploy) would otherwise spawn a fresh issue on each boot.
    const recent = await axios.get(
      `https://api.github.com/repos/${repo}/issues?state=all&per_page=50&sort=updated&direction=desc`,
      { headers, timeout: 15000 },
    );
    const throttleCutoff = Date.now() - WatchdogService.THROTTLE_MS;
    const dup = (recent.data || []).some((i: any) =>
      i.title === title && (i.state === 'open' || new Date(i.updated_at).getTime() > throttleCutoff),
    );
    if (dup) return;

    await axios.post(
      `https://api.github.com/repos/${repo}/issues`,
      {
        title,
        body: [
          a.body,
          '',
          '---',
          `_נפתח אוטומטית על ידי ה-Watchdog · ${new Date().toISOString()} · key: \`${a.key}\`_`,
          '_Claude: אחרי תיקון — סגור את ה-issue עם תגובה קצרה מה תוקן._',
        ].join('\n'),
      },
      { headers, timeout: 15000 },
    );
  }

  /**
   * Instant Telegram DM to the owner's personal chat, sent with the admin's own
   * bot (the one already posting to the groups). Needs WATCHDOG_TELEGRAM_CHAT_ID
   * (the owner's numeric Telegram ID — from @userinfobot) and the owner having
   * opened a private chat with the bot (/start) so it is allowed to DM them.
   * WATCHDOG_TELEGRAM_BOT_TOKEN overrides the bot when set.
   */
  private async reportTelegram(a: WatchdogAlert): Promise<void> {
    await this.sendTelegram(formatTelegramAlert(a));
  }

  /** Local-time HH:MM for owner-facing lines — a full ISO timestamp is noise in a DM. */
  private hhmm(d: Date | string | null | undefined): string {
    if (!d) return 'לא ידוע';
    return new Date(d).toLocaleTimeString('he-IL', {
      hour: '2-digit', minute: '2-digit',
      timeZone: process.env.SCHEDULER_TZ || 'Asia/Jerusalem',
    });
  }

  /** Resolve the watchdog bot token: explicit override, else the admin's group bot. */
  private async telegramToken(): Promise<string | null> {
    if (process.env.WATCHDOG_TELEGRAM_BOT_TOKEN) return process.env.WATCHDOG_TELEGRAM_BOT_TOKEN;
    const admins = await this.users.find({ where: { role: 'admin' } });
    for (const admin of admins) {
      const t = await this.credentials.getTelegramToken(admin.id).catch(() => null);
      if (t) return t;
    }
    return null;
  }

  /** Low-level send to the owner's watchdog chat. No-op (returns false) when unconfigured. */
  private async sendTelegram(text: string): Promise<boolean> {
    const chatId = process.env.WATCHDOG_TELEGRAM_CHAT_ID;
    if (!chatId) return false;
    const token = await this.telegramToken();
    if (!token) return false;
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId, text,
    }, { timeout: 12000 });
    return true;
  }

  // ── Two-way status bot (owner asks "/status", the bot replies) ─────────────

  /** On boot, register the Telegram webhook so the owner can DM the bot for a status. */
  async onModuleInit(): Promise<void> {
    this.setupTelegramWebhook().catch((err) => this.logger.warn(`telegram webhook setup skipped: ${err?.message}`));
  }

  /** Shared secret Telegram echoes back in a header, so only Telegram can call our webhook.
   *  Prefer a dedicated TELEGRAM_WEBHOOK_SECRET so rotating JWT_SECRET can't silently break
   *  the webhook; fall back to a JWT-derived value when it isn't set (no extra env needed). */
  telegramWebhookSecret(): string {
    const dedicated = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
    if (dedicated) return dedicated;
    return crypto.createHash('sha256').update(`tg-webhook:${process.env.JWT_SECRET || 'nexlify'}`).digest('hex').slice(0, 40);
  }

  /** Point the watchdog bot at our /telegram/webhook so incoming DMs reach handleTelegramUpdate.
   *  No-op unless the status chat + a public backend URL + a bot token all exist. Never
   *  clobbers a webhook that belongs to a different integration. */
  private async setupTelegramWebhook(): Promise<void> {
    if (!process.env.WATCHDOG_TELEGRAM_CHAT_ID) return; // status chat not configured → feature off
    const base = (process.env.BACKEND_URL || '').replace(/\/$/, '');
    if (!base || /localhost|127\.0\.0\.1/.test(base)) return;
    const token = await this.telegramToken();
    if (!token) return;
    const url = `${base}/telegram/webhook`;
    // 'callback_query' carries the product bot's inline-button taps. It is NOT implied by
    // a previously-registered ['message'] webhook, so an already-ours webhook still has to
    // be re-registered when it predates the product bot — otherwise every tap is dropped.
    const wanted = ['message', 'callback_query'];
    try {
      const info = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`, { timeout: 10000 });
      const current = info.data?.result?.url || '';
      const allowed: string[] = info.data?.result?.allowed_updates || [];
      if (current === url) {
        if (wanted.every((u) => allowed.includes(u))) return; // already ours, already complete
      } else if (current) {
        this.logger.warn(`telegram bot already has a webhook (${current}) — not overwriting`);
        return;
      }
    } catch { /* proceed to set */ }
    await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
      url,
      secret_token: this.telegramWebhookSecret(),
      allowed_updates: wanted,
    }, { timeout: 10000 });
    this.logger.log('Telegram webhook registered (status + product bot)');
  }

  /** Does this message ask for the status report? The webhook uses it to split the
   *  shared bot between the watchdog and the product bot. */
  isStatusRequest(text: string): boolean {
    const t = String(text || '').trim();
    if (!t) return false;
    return /^\/?(status|health)\b/i.test(t) || /סטטוס|תקלות|מה\s*המצב|מה\s*קורה/.test(t);
  }

  /** Reply to a status request. Only the configured owner chat is answered; every other
   *  message is routed to the product bot by the webhook, not handled here. */
  async handleTelegramUpdate(update: any): Promise<void> {
    const msg = update?.message;
    const text = String(msg?.text || '').trim();
    const chatId = String(msg?.chat?.id ?? '');
    if (!text || !chatId) return;
    if (chatId !== String(process.env.WATCHDOG_TELEGRAM_CHAT_ID || '')) return; // owner-only
    if (!this.isStatusRequest(text)) return;

    const report = await this.statusReport().catch((err) => `שגיאה בהפקת הסטטוס: ${err?.message}`);
    await this.sendTelegramTo(chatId, report).catch(() => {});
  }

  /** Build the on-demand status text: open '[watchdog]' issues + a live scan. */
  async statusReport(): Promise<string> {
    const lines: string[] = ['📊 סטטוס Nexlify Watchdog', ''];

    // Open '[watchdog]' GitHub issues — what's tracked/being handled right now.
    const token = process.env.GITHUB_WATCHDOG_TOKEN;
    if (token) {
      const repo = process.env.GITHUB_WATCHDOG_REPO || 'reuvenre/Nexlify';
      try {
        const res = await axios.get(
          `https://api.github.com/repos/${repo}/issues?state=open&per_page=30`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, timeout: 12000 },
        );
        const open = (res.data || []).filter((i: any) => typeof i.title === 'string' && i.title.startsWith('[watchdog]') && !i.pull_request);
        if (open.length) {
          lines.push(`🔴 ${open.length} תקלות פתוחות (בטיפול):`);
          for (const i of open.slice(0, 8)) lines.push(`• #${i.number} ${String(i.title).replace(/^\[watchdog\]\s*/, '')}`);
        } else {
          lines.push('🟢 אין תקלות פתוחות.');
        }
      } catch {
        lines.push('⚠️ לא ניתן לקרוא issues מ-GitHub כרגע.');
      }
      lines.push('');
    }

    // Live scan — anomalies right now (may precede an issue being opened).
    const anomalies = await this.scan().catch(() => []);
    if (anomalies.length) {
      lines.push(`⚠️ סריקה חיה: ${anomalies.length} ממצאים כרגע:`);
      for (const a of anomalies.slice(0, 6)) lines.push(`• ${a.title}`);
    } else {
      lines.push('🟢 סריקה חיה: הכל תקין כרגע.');
    }
    return lines.join('\n');
  }

  /** Send a message to a specific chat (the one that asked) — sibling of sendTelegram,
   *  which always targets the fixed owner chat. */
  private async sendTelegramTo(chatId: string, text: string): Promise<boolean> {
    const token = await this.telegramToken();
    if (!token) return false;
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text }, { timeout: 12000 });
    return true;
  }

  /**
   * Send a test alert NOW and return a precise diagnostic — so "did I set the
   * Telegram vars right?" is answerable from an admin button instead of waiting
   * for a real anomaly. Distinguishes missing config from Telegram's own errors
   * (chat not found / bot blocked / bad token).
   */
  async sendTestAlert(): Promise<{ ok: boolean; error?: string }> {
    if (!process.env.WATCHDOG_TELEGRAM_CHAT_ID) {
      return { ok: false, error: 'חסר WATCHDOG_TELEGRAM_CHAT_ID ב-Render' };
    }
    if (!(await this.telegramToken())) {
      return { ok: false, error: 'לא נמצא טוקן בוט — הגדר WATCHDOG_TELEGRAM_BOT_TOKEN או טוקן טלגרם לאדמין' };
    }
    try {
      await this.sendTelegram('✅ בדיקת Nexlify Watchdog — אם קיבלת את ההודעה הזו, התראות התקלות מוגדרות ופעילות. 🎉');
      return { ok: true };
    } catch (err: any) {
      const tg = err?.response?.data?.description;
      return { ok: false, error: `טלגרם דחה: ${tg || err?.message || err}. ודא שלחצת Start על הבוט ושה-Chat ID נכון.` };
    }
  }

  /** Email every admin (best effort — needs working SMTP). */
  private async reportEmail(a: { title: string; body: string }): Promise<void> {
    if (!this.mail.isConfigured()) return;
    const admins = await this.users.find({ where: { role: 'admin' } });
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;padding:16px">
      <h3>⚠️ Nexlify Watchdog — ${a.title}</h3>
      <pre dir="ltr" style="background:#f5f5f5;padding:12px;border-radius:8px;white-space:pre-wrap;text-align:left">${a.body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>
      <p>ה-issue המלא נפתח אוטומטית ב-GitHub ומטופל על ידי Claude.</p>
    </div>`;
    for (const admin of admins) {
      await this.mail.sendHtml(admin.email, `⚠️ Nexlify Watchdog: ${a.title}`, html).catch(() => {});
    }
  }
}
