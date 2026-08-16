import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { IncentiveProgram } from './incentive-program.entity';
import { CredentialsService } from '../credentials/credentials.service';
import { MailService } from '../mail/mail.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { User } from '../users/user.entity';

export interface IncentiveInput {
  name?: string;
  keywords?: string[];
  target_campaigns?: string[];
  starts_at?: string;
  ends_at?: string;
  active?: boolean;
}

/** The Incentive Campaign page in the affiliate portal — every reminder points here.
 *  Verified by the owner; the older /campaign/index.htm path now 404s. */
const PORTAL_URL = 'https://portals.aliexpress.com/affiportals/web/incentive.htm';

@Injectable()
export class IncentiveService {
  private readonly logger = new Logger(IncentiveService.name);

  constructor(
    @InjectRepository(IncentiveProgram) private readonly repo: Repository<IncentiveProgram>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly credentials: CredentialsService,
    private readonly mail: MailService,
    private readonly subscription: SubscriptionService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async list(userId: string): Promise<IncentiveProgram[]> {
    return this.repo.find({ where: { user_id: userId }, order: { ends_at: 'DESC' } });
  }

  async create(userId: string, dto: IncentiveInput): Promise<IncentiveProgram> {
    const row = this.repo.create({
      user_id: userId,
      name: (dto.name || '').trim() || 'קמפיין בונוס',
      keywords_json: JSON.stringify(cleanKeywords(dto.keywords)),
      target_campaigns: dto.target_campaigns?.length ? JSON.stringify(dto.target_campaigns) : null,
      starts_at: dto.starts_at ? new Date(dto.starts_at) : new Date(),
      ends_at: dto.ends_at ? new Date(dto.ends_at) : endOfMonth(new Date()),
      active: dto.active !== false,
    });
    return this.repo.save(row);
  }

  async update(userId: string, id: string, dto: IncentiveInput): Promise<IncentiveProgram> {
    const row = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!row) throw new NotFoundException('קמפיין הבונוס לא נמצא');
    if (typeof dto.name === 'string' && dto.name.trim()) row.name = dto.name.trim();
    if (Array.isArray(dto.keywords)) row.keywords_json = JSON.stringify(cleanKeywords(dto.keywords));
    if (Array.isArray(dto.target_campaigns)) {
      row.target_campaigns = dto.target_campaigns.length ? JSON.stringify(dto.target_campaigns) : null;
    }
    if (dto.starts_at) row.starts_at = new Date(dto.starts_at);
    if (dto.ends_at) row.ends_at = new Date(dto.ends_at);
    if (typeof dto.active === 'boolean') row.active = dto.active;
    return this.repo.save(row);
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const row = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!row) throw new NotFoundException('קמפיין הבונוס לא נמצא');
    await this.repo.remove(row);
    return { deleted: true };
  }

  // ── What the autopilot consumes ───────────────────────────────────────────

  /**
   * The bonus keywords in force for THIS campaign, right now. A program with no
   * campaigns of its own applies to all of them; one with a list applies only to those
   * (a Home & Living bonus must not push kitchen organisers into a tactical channel).
   *
   * Never throws: a failure here means the campaign runs on its own keywords, which is
   * exactly the pre-bonus behaviour — earning less is not a reason to publish nothing.
   */
  async keywordsFor(
    userId: string, campaignId: string, channels: string[] = [],
  ): Promise<{ keywords: string[]; names: string[] }> {
    try {
      // Plan gate: steering the rotation is an Autopilot-tier feature. Recording pools
      // and getting the monthly reminder stay open to every plan — knowing the money is
      // there is free, having the system chase it is what's paid for.
      if (!(await this.subscription.allows(userId, 'incentive_steering'))) {
        return { keywords: [], names: [] };
      }
      const now = new Date();
      const rows = await this.repo.find({ where: { user_id: userId, active: true } });
      // `active` is re-checked here, not left to the query alone: this is the owner's
      // off switch, and a correctness gate this cheap should be visible in the code that
      // decides — not only in a where-clause one layer away.
      const live = rows.filter((r) => r.active !== false
        && new Date(r.starts_at) <= now && new Date(r.ends_at) >= now);
      const keywords: string[] = [];
      const names: string[] = [];
      for (const r of live) {
        let own: string[] = [];
        try { own = r.target_campaigns ? JSON.parse(r.target_campaigns) : []; } catch { own = []; }
        // LEGACY tolerance: the first version of the screen stored Telegram GROUP ids.
        // A row saved from a still-cached old page would otherwise match nothing and
        // silently steer no campaign at all — so a stored id also counts when it is one
        // of this campaign's target groups.
        if (own.length && !own.includes(campaignId) && !own.some((id) => channels.includes(id))) continue;
        let kws: string[] = [];
        try { kws = JSON.parse(r.keywords_json || '[]'); } catch { kws = []; }
        const clean = cleanKeywords(kws);
        if (!clean.length) continue;
        names.push(r.name);
        for (const k of clean) if (!keywords.includes(k)) keywords.push(k);
      }
      return { keywords, names };
    } catch (err: any) {
      this.logger.warn(`incentive keywords lookup failed: ${err?.message}`);
      return { keywords: [], names: [] };
    }
  }

  // ── Monthly registration reminder ─────────────────────────────────────────

  /**
   * The portal's pools reset every month and bonuses only count from the moment you
   * register — a month you forget is a month of ordinary commission. Fires on the 1st
   * at 09:00 Israel time, and again mid-month for anyone with nothing recorded, because
   * "I'll do it later" is exactly how the first reminder gets lost.
   */
  @Cron('0 9 1,15 * *', { timeZone: process.env.SCHEDULER_TZ || 'Asia/Jerusalem' })
  async remindRegistration(): Promise<void> {
    const day = new Date().getDate();
    const admins = await this.users.find({ where: { role: 'admin' } }).catch(() => [] as User[]);
    for (const admin of admins) {
      try {
        const live = (await this.list(admin.id)).filter((r) => r.active && new Date(r.ends_at) >= new Date());
        // Mid-month is the nag for an empty list only; the 1st always goes out.
        if (day !== 1 && live.length) continue;
        const lines = live.length
          ? live.map((r) => `• ${r.name} — עד ${new Date(r.ends_at).toLocaleDateString('he-IL')}`)
          : ['(לא רשומים אצלך קמפייני בונוס פעילים במערכת)'];
        const subject = day === 1
          ? '🎁 קמפייני בונוס חדשים באלי אקספרס — זמן להירשם'
          : '🎁 תזכורת: עדיין לא רשמת קמפייני בונוס החודש';
        const body = [
          day === 1
            ? 'הפולים החודשיים בפורטל השותפים התחדשו. הרשמה היא חינם, אבל בונוס נצבר רק על הזמנות שנעשו אחרי ההרשמה.'
            : 'חצי חודש עבר ואין קמפייני בונוס פעילים במערכת — כל מכירה בקטגוריות האלה מוותרת על הבונוס.',
          '',
          'מה שרשום אצלך כרגע:',
          ...lines,
          '',
          `הירשם בפורטל: ${PORTAL_URL}`,
          'ואז הוסף אותם במסך "קמפייני בונוס" כדי שהטייס יעדיף את הקטגוריות שמזכות בבונוס.',
        ].join('\n');

        await this.notify(admin, subject, body);
      } catch (err: any) {
        this.logger.warn(`incentive reminder failed for ${admin.id}: ${err?.message}`);
      }
    }
  }

  /** Email + a Telegram DM through the owner's own bot. Best-effort, both independent. */
  private async notify(admin: User, subject: string, body: string): Promise<void> {
    await this.mail.sendHtml(
      admin.email, subject,
      `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;line-height:1.7">
        <h3 style="margin:0 0 10px">${subject}</h3>
        <p style="white-space:pre-line;color:#374151">${body}</p>
      </div>`,
    ).catch((err: any) => this.logger.warn(`incentive reminder email failed: ${err?.message}`));

    const chatId = process.env.WATCHDOG_TELEGRAM_CHAT_ID;
    if (!chatId) return;
    const token = process.env.WATCHDOG_TELEGRAM_BOT_TOKEN
      || await this.credentials.getTelegramToken(admin.id).catch(() => null);
    if (!token) return;
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId, text: `${subject}\n\n${body}`, disable_web_page_preview: true,
    }, { timeout: 12000 }).catch((err: any) => this.logger.warn(`incentive reminder telegram failed: ${err?.message}`));
  }
}

/** Trim, drop empties and duplicates, cap the list — these join a live search rotation. */
function cleanKeywords(input?: string[] | null): string[] {
  const out: string[] = [];
  for (const raw of input || []) {
    const k = String(raw || '').trim();
    if (!k || k.length > 60) continue;
    if (!out.some((x) => x.toLowerCase() === k.toLowerCase())) out.push(k);
    if (out.length >= 12) break;
  }
  return out;
}

/** Last moment of `d`'s month — the portal's pools run to month end. */
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}
