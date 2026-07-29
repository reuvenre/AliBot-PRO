import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import axios from 'axios';

type MailProbe = {
  ok: boolean;
  error?: string;
  /** Hebrew, operator-facing next step. Kept SEPARATE from `error` so the UI can render
   *  the raw provider string LTR/monospace and the guidance as normal RTL prose. */
  hint?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  transport?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Which delivery transport to use. HTTPS APIs win over SMTP because many PaaS hosts
   * (Render free/starter among them) block outbound SMTP ports entirely — an API on
   * port 443 always gets through. Set RESEND_API_KEY or BREVO_API_KEY to switch;
   * with neither, we fall back to classic SMTP.
   */
  private apiProvider(): 'resend' | 'brevo' | null {
    if (this.config.get<string>('RESEND_API_KEY')) return 'resend';
    if (this.config.get<string>('BREVO_API_KEY')) return 'brevo';
    return null;
  }

  /** True when SOME transport is configured — otherwise sends are logged, not delivered. */
  isConfigured(): boolean {
    return !!this.apiProvider() || !!this.config.get<string>('SMTP_HOST');
  }

  /**
   * SMTP port as a NUMBER. ConfigService returns env vars as strings, so the old
   * `config.get<number>('SMTP_PORT') === 465` was string-vs-number and ALWAYS false —
   * on port 465 (implicit TLS) that left `secure:false`, so we opened a plaintext socket
   * to a TLS-only port and the connection hung until the request timed out.
   */
  private smtpPort(): number {
    return Number(this.config.get('SMTP_PORT')) || 587;
  }

  private transporter() {
    const port = this.smtpPort();
    return nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS (secure:false)
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
      // Never hang a request on a blocked/unreachable SMTP port — fail fast and loudly.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  /**
   * The From header. Gmail SMTP silently REWRITES a From that isn't the authenticated
   * account (or a verified "send mail as" alias), so a mismatch quietly changes the
   * sender the recipient sees. Falling back to SMTP_USER keeps header and envelope
   * aligned instead of pretending we sent as someone else.
   */
  private fromHeader(): string {
    return this.config.get<string>('SMTP_FROM')
      || this.config.get<string>('SMTP_USER')
      || '"Nexlify" <noreply@nexlify.win-solutions.co.il>';
  }

  /** Split `"Name" <a@b.c>` (or a bare address) into the parts the HTTP APIs want. */
  private parseFrom(): { name: string; email: string } {
    const raw = this.fromHeader().trim();
    const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
    if (m) return { name: (m[1] || 'Nexlify').trim(), email: m[2].trim() };
    return { name: 'Nexlify', email: raw };
  }

  /**
   * Check that mail can actually go out, WITHOUT sending (admin diagnostics).
   * Returns the real provider error so a misconfiguration is visible in the UI instead
   * of surfacing as a generic "something went wrong".
   */
  async verify(): Promise<MailProbe> {
    const api = this.apiProvider();
    if (api) return this.verifyApi(api);

    const host = this.config.get<string>('SMTP_HOST');
    const port = this.smtpPort();
    if (!host) return { ok: false, error: 'לא הוגדר SMTP_HOST ולא מפתח API לשליחת מיילים' };
    try {
      await this.transporter().verify();
      return { ok: true, host, port, secure: port === 465, transport: 'smtp' };
    } catch (err: any) {
      this.logger.error(`SMTP verify failed (${host}:${port}): ${err?.message}`);
      return {
        ok: false,
        error: `${err?.code || ''} ${err?.message || err}`.trim(),
        hint: this.smtpHint(err?.code, host, port),
        host, port, secure: port === 465, transport: 'smtp',
      };
    }
  }

  /**
   * Turn nodemailer's terse codes into something an operator can act on. A raw
   * "ETIMEDOUT Connection timeout" says nothing about WHICH knob to turn.
   */
  private smtpHint(code: string, host: string, port: number): string | undefined {
    if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
      // Don't suggest the port that's already in use — on 587 the remaining explanation is
      // that the host blocks outbound SMTP entirely, and only an HTTPS API gets out.
      const portAdvice = port === 587
        ? 'פורט 587 כבר בשימוש, כלומר השרת חוסם SMTP יוצא. הפתרון: הגדר RESEND_API_KEY והמערכת תשלח דרך HTTPS (פורט 443).'
        : 'נסה SMTP_PORT=587; אם גם הוא נכשל, הגדר RESEND_API_KEY והמערכת תשלח דרך HTTPS (פורט 443) במקום SMTP.';
      return `החיבור אל ${host}:${port} לא נפתח כלל — הפורט חסום ביציאה מהשרת. ${portAdvice}`;
    }
    if (code === 'EAUTH') {
      return 'השם או הסיסמה נדחו. ב-Gmail חייבים App Password בן 16 תווים (בלי רווחים) — לא סיסמת החשבון הרגילה.';
    }
    if (code === 'EDNS' || code === 'ENOTFOUND') {
      return `לא נמצאה כתובת לשרת "${host}" — בדוק את הערך של SMTP_HOST.`;
    }
    return undefined;
  }

  /** Cheap authenticated GET against the chosen HTTP mail API — no message is sent. */
  private async verifyApi(provider: 'resend' | 'brevo'): Promise<MailProbe> {
    const probe: MailProbe = { ok: true, transport: provider, host: `${provider} API` };
    try {
      if (provider === 'resend') {
        await axios.get('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${this.config.get<string>('RESEND_API_KEY')}` },
          timeout: 12_000,
        });
      } else {
        await axios.get('https://api.brevo.com/v3/account', {
          headers: { 'api-key': this.config.get<string>('BREVO_API_KEY') as string },
          timeout: 12_000,
        });
      }
      return probe;
    } catch (err: any) {
      const status = err?.response?.status;
      // A "Sending access" Resend key is REFUSED by /domains by design — it may only hit
      // /emails. Failing here would reject a perfectly good key, so treat an auth refusal
      // as inconclusive and let the real test send (which every caller performs next) be
      // the verdict. A genuinely bad key fails there, with the provider's own message.
      if (status === 401 || status === 403) return probe;
      const detail = err?.response?.data?.message || err?.response?.data?.error?.message || err?.message || String(err);
      this.logger.error(`${provider} verify failed: ${detail}`);
      return { ok: false, transport: provider, host: `${provider} API`, error: `${provider}: ${detail}` };
    }
  }

  /**
   * Explain a failure that happened during an actual SEND (the connection was fine).
   * Transport-aware: the SMTP advice — verify the sender as a Gmail alias — is nonsense
   * once mail goes out over an HTTP API, where the sender is governed by which domains
   * are verified in the provider's dashboard.
   */
  sendFailureHint(err: any): string {
    const provider = this.apiProvider();
    const msg = String(err?.message || err).toLowerCase();
    const from = this.parseFrom().email;

    if (!provider) {
      const user = this.config.get<string>('SMTP_USER');
      if (from && user && from.toLowerCase() !== user.toLowerCase()) {
        return `החיבור תקין אך השליחה נדחתה. SMTP_FROM (${from}) שונה מ-SMTP_USER (${user}) — `
          + 'אמת את הכתובת ב-Gmail תחת Settings → Accounts → "Send mail as", או הגדר את SMTP_FROM לכתובת ה-Gmail עצמה.';
      }
      return 'החיבור תקין אך השרת דחה את ההודעה. בדוק את כתובת השולח ואת מגבלות השליחה בחשבון.';
    }

    const name = provider === 'resend' ? 'Resend' : 'Brevo';
    if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('invalid token')) {
      return `${name} דחה את המפתח. ודא ש-${provider === 'resend' ? 'RESEND_API_KEY' : 'BREVO_API_KEY'} ב-Render הועתק במלואו `
        + '(בלי רווחים בהתחלה או בסוף), ושלא נמחק מאז שנוצר.';
    }
    if (msg.includes('not verified') || msg.includes('domain')) {
      return `כתובת השולח ${from} אינה מאושרת ב-${name}. הדומיין שלה חייב להופיע כ-Verified תחת Domains — `
        + 'ודא ש-SMTP_FROM משתמש בדיוק באותו דומיין שאימת.';
    }
    if (msg.includes('testing') || msg.includes('own email')) {
      return `${name} עדיין במצב בדיקה עבור המפתח הזה ומרשה לשלוח רק לכתובת שאיתה נרשמת. `
        + 'ודא שהדומיין מאומת ושהמפתח משויך אליו.';
    }
    return `${name} דחה את ההודעה. ההודעה המלאה מהספק מופיעה למעלה — היא מציינת את הסיבה המדויקת.`;
  }

  /**
   * Single delivery path for every email in the app. Routes to the HTTP API when one is
   * configured, otherwise to SMTP. Throws on failure so callers can surface the reason.
   */
  private async deliver(to: string, subject: string, html: string): Promise<void> {
    const provider = this.apiProvider();
    if (!provider) {
      await this.transporter().sendMail({ from: this.fromHeader(), to, subject, html });
      return;
    }
    const from = this.parseFrom();
    try {
      if (provider === 'resend') {
        await axios.post(
          'https://api.resend.com/emails',
          { from: `${from.name} <${from.email}>`, to: [to], subject, html },
          {
            headers: { Authorization: `Bearer ${this.config.get<string>('RESEND_API_KEY')}` },
            timeout: 20_000,
          },
        );
      } else {
        await axios.post(
          'https://api.brevo.com/v3/smtp/email',
          { sender: from, to: [{ email: to }], subject, htmlContent: html },
          {
            headers: { 'api-key': this.config.get<string>('BREVO_API_KEY') as string },
            timeout: 20_000,
          },
        );
      }
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.response?.data?.error?.message || err?.message || String(err);
      throw new Error(`${provider}: ${detail}`);
    }
  }

  /** Send a ready-made HTML email. Throws on failure so callers can react. */
  async sendHtml(to: string, subject: string, html: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(`[DEV] Email to ${to} not sent (mail not configured): ${subject}`);
      return;
    }
    await this.deliver(to, subject, html);
  }

  /**
   * Send one broadcast email (admin → user). Returns false when mail isn't configured
   * (the caller reports that nothing was actually delivered). The message body is the
   * admin's plain text, wrapped in a simple RTL HTML shell.
   */
  async sendBroadcast(email: string, subject: string, message: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(`[DEV] Broadcast to ${email} (mail not configured): ${subject}`);
      return false;
    }
    const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
    await this.deliver(email, subject, `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#111;">
        <div style="padding:20px 24px;background:#6366f1;color:#fff;border-radius:12px 12px 0 0;">
          <strong style="font-size:18px;">Nexlify</strong>
        </div>
        <div style="padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px;line-height:1.7;">
          ${safe}
        </div>
      </div>
    `);
    return true;
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    if (!this.isConfigured()) {
      // Dev fallback: log the link so developers can use it without SMTP. NEVER in
      // production — a prod instance misconfigured without mail must not write live
      // (1h-valid) reset URLs into its logs.
      if (this.config.get('NODE_ENV') !== 'production') {
        this.logger.warn(`[DEV] Password reset link for ${email}: ${resetUrl}`);
      } else {
        this.logger.error('No mail transport configured — password reset email NOT sent');
      }
      return;
    }

    await this.deliver(email, 'איפוס סיסמה — Nexlify', `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>איפוס סיסמה</h2>
        <p>קיבלנו בקשה לאיפוס הסיסמה שלך. לחץ על הכפתור למטה להמשך:</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;
                  text-decoration:none;border-radius:8px;font-weight:bold;margin:16px 0;">
          איפוס סיסמה
        </a>
        <p style="color:#6b7280;font-size:13px;">
          הקישור יפוג תוך שעה אחת. אם לא ביקשת איפוס סיסמה, ניתן להתעלם מהודעה זו.
        </p>
        <p style="color:#6b7280;font-size:11px;">
          אם הכפתור לא עובד, העתק את הקישור הבא לדפדפן:<br/>
          <span style="word-break:break-all;">${resetUrl}</span>
        </p>
      </div>
    `);

    this.logger.log(`Password reset email sent to ${email}`);
  }
}
