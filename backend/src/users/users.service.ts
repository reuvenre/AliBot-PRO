import { Injectable, BadRequestException, ConflictException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from './user.entity';
import { trialEndsAt } from '../subscription/plans.const';

/** Reset tokens are 256-bit random, so a fast cryptographic hash is sufficient
 *  (and lets us look them up by an indexed equality match instead of scanning). */
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** The single bootstrap admin — owner of the instance. Override with ADMIN_EMAIL. */
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'rubypc6@gmail.com').toLowerCase();

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  /** Promote the configured admin email to 'admin' on every boot. */
  async onModuleInit() {
    try {
      await this.repo
        .createQueryBuilder()
        .update(User)
        .set({ role: 'admin' })
        .where('LOWER(email) = :email AND role != :role', { email: ADMIN_EMAIL, role: 'admin' })
        .execute();

      // BREAK-GLASS lockout recovery: the admin changed their login email to an address
      // they can't actually use and locked themselves out. Setting ADMIN_EMAIL_RESCUE=true
      // in the environment renames the (single) admin account back to ADMIN_EMAIL on the
      // next boot. Deliberately env-gated and inert by default — only someone with access
      // to the hosting dashboard (the real owner) can flip it, and it should be removed
      // right after recovering. No-op when an account with ADMIN_EMAIL already exists.
      if (process.env.ADMIN_EMAIL_RESCUE === 'true') {
        const existing = await this.repo.findOne({ where: { email: ADMIN_EMAIL } });
        if (!existing) {
          const admins = await this.repo.find({ where: { role: 'admin' } });
          if (admins.length === 1) {
            await this.repo.update(admins[0].id, { email: ADMIN_EMAIL });
            this.logger.warn(`ADMIN_EMAIL_RESCUE: admin ${admins[0].id} email reset to ${ADMIN_EMAIL} (was ${admins[0].email}) — remove the env var now`);
          } else {
            this.logger.warn(`ADMIN_EMAIL_RESCUE set but ${admins.length} admin accounts exist — refusing to guess, no change made`);
          }
        }
      }
    } catch (err: any) {
      // Table may not exist yet on a brand-new DB before sync/migrations — ignore.
      this.logger.warn(`Admin bootstrap skipped: ${err.message}`);
    }
  }

  /** Lists every user with activity counts — admin only. */
  async listAll(): Promise<any[]> {
    return this.repo.query(`
      SELECT u.id, u.email, u.role, u.created_at,
             u.subscription_plan, u.plan_billing, u.credits_remaining, u.is_blocked,
             (u.google_id IS NOT NULL) AS via_google,
             (SELECT COUNT(*)::int FROM posts p WHERE p.user_id = u.id) AS posts_count,
             (SELECT COUNT(*)::int FROM campaigns c WHERE c.user_id = u.id) AS campaigns_count
      FROM users u
      ORDER BY u.created_at DESC
    `);
  }

  // ── Admin user management ─────────────────────────────────────────────────

  /** Admin-create a user with an initial role. Password is hashed like normal signup. */
  async adminCreate(email: string, password: string, role: 'user' | 'admin' = 'user'): Promise<User> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      throw new ConflictException('כתובת אימייל לא תקינה');
    }
    if (!password || password.length < 8) throw new ConflictException('סיסמה חייבת להכיל לפחות 8 תווים');
    const exists = await this.repo.findOne({ where: { email: normalized } });
    if (exists) throw new ConflictException('האימייל כבר רשום במערכת');
    const password_hash = await bcrypt.hash(password, 12);
    const finalRole = normalized === ADMIN_EMAIL ? 'admin' : (role === 'admin' ? 'admin' : 'user');
    const user = this.repo.create({ email: normalized, password_hash, role: finalRole });
    return this.repo.save(user);
  }

  /** Set a user's role. */
  async setRole(userId: string, role: string): Promise<void> {
    const next = role === 'admin' ? 'admin' : 'user';
    await this.repo.update(userId, { role: next });
  }

  /** Block/unblock a user. Blocking also revokes the active refresh token. */
  async setBlocked(userId: string, blocked: boolean): Promise<void> {
    await this.repo.update(userId, {
      is_blocked: blocked,
      ...(blocked ? { refresh_token_hash: null } : {}),
    });
  }

  /** Email recipients for a broadcast. `target`: 'all' | 'users' | 'admins'. */
  async recipients(target: 'all' | 'users' | 'admins' = 'all'): Promise<{ id: string; email: string }[]> {
    const qb = this.repo.createQueryBuilder('u')
      .select(['u.id AS id', 'u.email AS email'])
      .where("u.email <> ''");
    if (target === 'users') qb.andWhere("u.role != 'admin'");
    else if (target === 'admins') qb.andWhere("u.role = 'admin'");
    return qb.getRawMany();
  }

  /** Aggregate counts for the admin dashboard. */
  async adminStats(): Promise<{ total_users: number; admins: number; google_users: number }> {
    const rows = await this.repo.query(`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
        COUNT(*) FILTER (WHERE google_id IS NOT NULL)::int AS google_users
      FROM users
    `);
    return rows[0] || { total_users: 0, admins: 0, google_users: 0 };
  }

  /**
   * Resolve a Google sign-in to an EXISTING account only — never auto-create one.
   * Google is a login method, not a registration path: a brand-new email must go
   * through registration first. Returns null when no account matches (the caller
   * then bounces the user to register), and links the google_id to an account that
   * was created by email/password so they can use Google next time.
   */
  async findGoogleUserForLogin(email: string, googleId: string, displayName?: string): Promise<User | null> {
    // Google users never went through the registration name field — backfill the full
    // name from the Google profile so the dashboard greets them properly instead of
    // falling back to the email prefix. Never overwrites a name the user already has.
    const backfillName = async (user: User): Promise<User> => {
      const name = displayName?.trim();
      if (name && !user.name?.trim()) {
        await this.repo.update(user.id, { name });
        return { ...user, name };
      }
      return user;
    };

    const byGoogle = await this.repo.findOne({ where: { google_id: googleId } });
    if (byGoogle) return backfillName(byGoogle);

    const byEmail = await this.repo.findOne({ where: { email } });
    if (byEmail) {
      await this.repo.update(byEmail.id, { google_id: googleId });
      return backfillName({ ...byEmail, google_id: googleId });
    }

    return null; // never registered → do NOT create; the callback redirects to register
  }

  async create(email: string, password: string, name?: string): Promise<User> {
    const exists = await this.repo.findOne({ where: { email } });
    if (exists) throw new ConflictException('Email already registered');
    const password_hash = await bcrypt.hash(password, 12);
    const role = email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user';
    // Two weeks with every feature gate open — see TRIAL_DAYS in plans.const.ts for why the
    // trial lifts FEATURES and not credits. Set at creation so it is the account's own
    // clock, not something a later screen has to remember to start.
    const user = this.repo.create({
      email, password_hash, role, name: name?.trim() || null, trial_ends_at: trialEndsAt(),
    });
    return this.repo.save(user);
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  /** Change a user's login email. Validation + uniqueness are the CALLER's job
   *  (auth.service.changeEmail) — this is the bare write. */
  async updateEmail(userId: string, email: string): Promise<void> {
    await this.repo.update(userId, { email });
  }

  /**
   * Permanently delete a user AND all their data. Guard rails: never yourself, never an
   * admin (demote first — prevents wiping the owner by mistake), and an account that
   * actually published must be BLOCKED first — deletion is for dead/blocked accounts,
   * not a shortcut around a live customer. All rows go in one transaction; the
   * security_events audit trail is deliberately kept (it has no FK and IS the record
   * that the account existed).
   */
  async adminDelete(actorId: string, targetId: string): Promise<{ deleted: true }> {
    if (actorId === targetId) throw new BadRequestException('אי אפשר למחוק את החשבון של עצמך');
    const target = await this.findById(targetId);
    if (!target) throw new NotFoundException('משתמש לא נמצא');
    if (target.role === 'admin') throw new BadRequestException('אי אפשר למחוק חשבון אדמין — הסר קודם את הרשאת האדמין');
    if (!target.is_blocked) {
      const [{ n }] = await this.repo.manager.query(
        `SELECT count(*)::int AS n FROM posts WHERE user_id = $1 AND status = 'sent'`, [targetId],
      );
      if (Number(n) > 0) {
        throw new BadRequestException('המשתמש פרסם בפועל — חסום אותו קודם, ורק אז מחק');
      }
    }

    // Fixed table list on purpose (no interpolated identifiers). campaign_posted_products
    // hangs off campaigns (no user_id of its own) → deleted via the campaign join first.
    const USER_TABLES = [
      'posts', 'uploaded_images', 'custom_posts', 'agent_runs', 'optimizer_runs',
      'manager_actions', 'link_clicks', 'link_targets', 'earnings', 'coupons',
      'templates', 'notification_prefs', 'payment_sessions', 'ai_usage',
      'catalog_products', 'supplier_products', 'supplier_catalogs',
      'channels', 'campaigns', 'credential_sets',
    ];
    await this.repo.manager.transaction(async (em) => {
      // A table can be absent on a given deployment (entity shipped before its
      // migration ran there). Absent table = nothing to delete — skip it instead of
      // failing the whole wipe. This exact gap surfaced as a bare 500 in production.
      const exists = async (table: string): Promise<boolean> => {
        const [reg] = await em.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
        return !!reg?.t;
      };
      if (await exists('campaign_posted_products')) {
        // campaign_posted_products.campaign_id is VARCHAR while campaigns.id is UUID —
        // without the ::text cast Postgres has no varchar=uuid operator and the very
        // first statement of this transaction died (the production 500).
        await em.query(
          `DELETE FROM campaign_posted_products
           WHERE campaign_id IN (SELECT id::text FROM campaigns WHERE user_id = $1)`, [targetId],
        ).catch((err: any) => {
          throw new BadRequestException(`המחיקה נכשלה בטבלת campaign_posted_products: ${err?.message || err}`);
        });
      }
      for (const table of USER_TABLES) {
        if (!(await exists(table))) continue;
        try {
          await em.query(`DELETE FROM "${table}" WHERE user_id = $1`, [targetId]);
        } catch (err: any) {
          // Name the failing table — a bare 500 sent the investigation guessing.
          throw new BadRequestException(`המחיקה נכשלה בטבלת ${table}: ${err?.message || err}`);
        }
      }
      try {
        await em.query(`DELETE FROM users WHERE id = $1`, [targetId]);
      } catch (err: any) {
        // Most likely an FK from a table this wipe doesn't know about — the driver
        // message names the constraint, which is exactly the lead we need.
        throw new BadRequestException(`מחיקת רשומת המשתמש נכשלה: ${err?.message || err}`);
      }
    });
    return { deleted: true };
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }

  async saveRefreshToken(userId: string, token: string | null) {
    const hash = token ? await bcrypt.hash(token, 10) : null;
    await this.repo.update(userId, { refresh_token_hash: hash });
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user?.refresh_token_hash) return false;
    return bcrypt.compare(token, user.refresh_token_hash);
  }

  async saveResetToken(userId: string, token: string, expiresAt: Date) {
    await this.repo.update(userId, {
      reset_token_hash: hashResetToken(token),
      reset_token_expires: expiresAt,
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.repo.findOne({
      where: {
        reset_token_hash: hashResetToken(token),
        reset_token_expires: MoreThan(new Date()),
      },
    });
  }

  async updatePassword(userId: string, newPassword: string) {
    const hash = await bcrypt.hash(newPassword, 12);
    await this.repo.update(userId, {
      password_hash: hash,
      reset_token_hash: null,
      reset_token_expires: null,
      // Revoke any active session so a password reset/change kicks out
      // an attacker who still holds a valid refresh token.
      refresh_token_hash: null,
    });
  }

  // ── Two-factor auth ─────────────────────────────────────────────────────────

  /** Store (or clear) the encrypted TOTP secret and enabled flag. */
  async setTotp(userId: string, secretEnc: string | null, enabled: boolean) {
    await this.repo.update(userId, { totp_secret_enc: secretEnc, totp_enabled: enabled });
  }

  toPublic(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name || null,
      role: user.role || 'user',
      footer_text: user.footer_text,
      subscription_plan: user.subscription_plan || 'starter',
      credits_remaining: user.credits_remaining ?? 0,
      totp_enabled: user.totp_enabled === true,
      created_at: user.created_at,
    };
  }
}
