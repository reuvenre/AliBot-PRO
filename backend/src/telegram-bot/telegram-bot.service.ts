import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Channel } from '../channels/channel.entity';
import { User } from '../users/user.entity';
import { ProductsService } from '../products/products.service';
import { PostsService } from '../posts/posts.service';
import { CredentialsService } from '../credentials/credentials.service';
import { OptimizerService } from '../optimizer/optimizer.service';
import { CB_DETAIL, CB_UNDO, CB_UNDO_LIST, undoKeyboard } from '../optimizer/digest-keyboard';
import {
  BotProduct, encodeCallback, matchByPrefix, parseCallback, productCaption, truncate,
} from './product-card';
import { splitMessage } from './split-message';

/** Inline keyboard row(s) as Telegram wants them. A button carries EITHER a callback or a
 *  url — the morning report's "open the dashboard" button is the latter. */
type Keyboard = Array<Array<{ text: string; callback_data?: string; url?: string }>>;

const RESULTS_PER_PAGE = 5;

const HELP = [
  '🛍️ בוט המוצרים של Nexlify',
  '',
  'שלח לי מילת חיפוש (עברית או אנגלית) ואחזיר את המוצרים הנמכרים ביותר באלי אקספרס,',
  'עם מחיר בשקלים ואחוז הנחה. לחיצה על "פרסם לקבוצה" בוחרת קבוצה ומפרסמת מיד,',
  'כולל כתיבת הטקסט השיווקי וקישור השותפים.',
  '',
  'דוגמאות:',
  '• אוזניות בלוטות\'',
  '• /search robot vacuum',
  '',
  '/status — מצב המערכת והתקלות הפתוחות',
].join('\n');

/**
 * Two-way Telegram bot for finding and publishing products from the phone.
 *
 * The owner DMs a keyword, gets the top results as photo cards, taps a product,
 * picks one of their groups and the post goes out through the SAME quickPost path
 * the dashboard uses (AI copy, affiliate short link, per-group template).
 *
 * Access is the owner chat only — identical to the watchdog's /status gate — so the
 * bot needs no auth of its own and can never publish on behalf of another tenant.
 *
 * Search results are cached in memory because a product CANNOT be re-resolved from
 * its id alone (the affiliate API only searches keywords, so a re-fetch would post a
 * wrong or empty product). A cache miss is reported, never guessed around.
 */
@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);

  private static readonly CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  private static readonly CACHE_MAX = 400;

  /** product_id → the card we showed, so a publish tap keeps the real price/title/image. */
  private readonly shown = new Map<string, { product: BotProduct; at: number }>();
  /** chat → last keyword, powering "עוד תוצאות" without re-typing it. */
  private readonly lastQuery = new Map<string, { keyword: string; page: number; at: number }>();

  constructor(
    @InjectRepository(Channel) private readonly channels: Repository<Channel>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly products: ProductsService,
    private readonly posts: PostsService,
    private readonly credentials: CredentialsService,
    // The morning report's buttons: show the evidence, and take a change back.
    private readonly optimizer: OptimizerService,
  ) {}

  // ── Entry point ────────────────────────────────────────────────────────────

  /** Handle one Telegram update the webhook routed here (everything that isn't /status). */
  async handleUpdate(update: any): Promise<void> {
    if (update?.callback_query) {
      await this.handleCallback(update.callback_query);
      return;
    }
    const msg = update?.message;
    const text = String(msg?.text || '').trim();
    const chatId = String(msg?.chat?.id ?? '');
    if (!text || !chatId || !this.isOwner(chatId)) return;
    await this.handleMessage(chatId, text);
  }

  /** Only the configured owner chat is answered; anything else is silently ignored. */
  private isOwner(chatId: string): boolean {
    const owner = String(process.env.WATCHDOG_TELEGRAM_CHAT_ID || '');
    return !!owner && chatId === owner;
  }

  private async handleMessage(chatId: string, text: string): Promise<void> {
    const keyword = this.keywordFrom(text);
    if (!keyword) {
      await this.send(chatId, HELP);
      return;
    }
    await this.runSearch(chatId, keyword, 1);
  }

  /**
   * The search term in a message. A bare message IS the term; `/search foo` (also
   * `/search@MyBot foo`) carries it as an argument. Any other slash command has no
   * term — the caller answers with the help text instead of searching for "/foo".
   */
  private keywordFrom(text: string): string | null {
    if (!text.startsWith('/')) return text;
    const [rawCmd, ...rest] = text.split(/\s+/);
    const cmd = rawCmd.split('@')[0].toLowerCase();
    if (cmd !== '/search' && cmd !== '/find') return null;
    return rest.join(' ').trim() || null;
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  private async runSearch(chatId: string, keyword: string, page: number): Promise<void> {
    const userId = await this.ownerUserId();
    if (!userId) {
      await this.send(chatId, '❌ לא נמצא משתמש אדמין במערכת.');
      return;
    }

    let items: BotProduct[];
    try {
      const res = await this.products.search(userId, { keyword, page, limit: RESULTS_PER_PAGE });
      items = (res?.data || []) as BotProduct[];
    } catch (err: any) {
      this.logger.warn(`bot search "${keyword}" failed: ${err?.message}`);
      await this.send(chatId, `❌ החיפוש נכשל: ${err?.message || err}`);
      return;
    }

    if (!items.length) {
      await this.send(chatId, page > 1
        ? `אין עוד תוצאות עבור «${keyword}».`
        : `לא נמצאו מוצרים עבור «${keyword}». נסה ניסוח אחר.`);
      return;
    }

    this.lastQuery.set(chatId, { keyword, page, at: Date.now() });
    await this.send(chatId, `🔎 «${keyword}» — ${items.length} תוצאות (עמוד ${page}):`);

    let index = (page - 1) * RESULTS_PER_PAGE;
    for (const p of items) {
      index++;
      this.remember(p);
      const caption = productCaption(p, index);
      const keyboard: Keyboard = [[
        { text: '📤 פרסם לקבוצה', callback_data: encodeCallback('c', p.product_id) },
      ]];
      // A photo that Telegram refuses to fetch must not swallow the whole result.
      const sent = p.image_url
        ? await this.sendPhoto(chatId, p.image_url, caption, keyboard)
        : false;
      if (!sent) await this.send(chatId, caption, keyboard);
    }

    await this.send(chatId, 'רוצה עוד אפשרויות?', [[
      { text: '🔄 עוד תוצאות', callback_data: encodeCallback('m', String(page + 1)) },
    ]]);
  }

  // ── Button taps ────────────────────────────────────────────────────────────

  private async handleCallback(cq: any): Promise<void> {
    const chatId = String(cq?.message?.chat?.id ?? '');
    const messageId = cq?.message?.message_id;
    const cbId = String(cq?.id || '');
    if (!chatId || !this.isOwner(chatId)) {
      await this.answer(cbId);
      return;
    }

    const { action, args } = parseCallback(String(cq?.data || ''));
    switch (action) {
      case 'm': return this.onMoreResults(chatId, cbId, Number(args[0]));
      case 'c': return this.onPickChannel(chatId, cbId, args[0]);
      case 'g': return this.onPublish(chatId, cbId, messageId, args[0], args[1]);
      case CB_DETAIL: return this.onDigestDetail(chatId, cbId, args[0]);
      case CB_UNDO_LIST: return this.onUndoList(chatId, cbId);
      case CB_UNDO: return this.onUndo(chatId, cbId, messageId, args[0]);
      case 'x':
        await this.answer(cbId, 'בוטל');
        await this.editText(chatId, messageId, 'בוטל.');
        return;
      default:
        await this.answer(cbId);
    }
  }

  // ── The morning report's buttons ───────────────────────────────────────────

  /** "📋 פירוט מלא" — the evidence behind the brief, on request instead of unasked. */
  private async onDigestDetail(chatId: string, cbId: string, runId?: string): Promise<void> {
    await this.answer(cbId, 'טוען…');
    const userId = await this.ownerUserId();
    const detail = userId ? await this.optimizer.lastRunDetail(userId, runId || null) : null;
    if (!detail) {
      await this.send(chatId, 'אין פירוט שמור לדוח הזה.');
      return;
    }
    await this.sendLong(chatId, detail);
  }

  /** "↩️ בטל שינוי" — the changes still standing, each with its own undo button. */
  private async onUndoList(chatId: string, cbId: string): Promise<void> {
    await this.answer(cbId);
    const userId = await this.ownerUserId();
    const actions = userId ? await this.optimizer.recentActions(userId, 2) : [];
    const undoable = actions.filter((a) => a.undoable && !a.undone);
    if (!undoable.length) {
      await this.send(chatId, 'אין שינויים לביטול מהיומיים האחרונים.');
      return;
    }
    await this.send(chatId, 'איזה שינוי לבטל?',
      undoKeyboard(undoable.map((a) => ({ id: a.id, text: a.label }))));
  }

  /** One change, put back. */
  private async onUndo(
    chatId: string, cbId: string, messageId: number | undefined, actionId?: string,
  ): Promise<void> {
    const userId = await this.ownerUserId();
    if (!actionId || !userId) {
      await this.answer(cbId, 'לא נמצא');
      return;
    }
    await this.answer(cbId, 'מבטל…');
    const res = await this.optimizer.undoAction(userId, actionId);
    // Editing the message drops its keyboard, so a second tap can't re-apply an old state
    // even before undone_at is read — the same guard the publish flow uses.
    await this.editText(chatId, messageId, res.ok
      ? `↩️ בוטל: ${res.label || 'השינוי הוחזר'}`
      : `❌ ${res.reason || 'הביטול נכשל'}`);
  }

  private async onMoreResults(chatId: string, cbId: string, page: number): Promise<void> {
    await this.answer(cbId, 'טוען…');
    const last = this.lastQuery.get(chatId);
    if (!last) {
      await this.send(chatId, 'החיפוש הקודם פג — שלח מילת חיפוש חדשה.');
      return;
    }
    await this.runSearch(chatId, last.keyword, page > 0 ? page : last.page + 1);
  }

  /** Product tapped → offer the owner's active Telegram groups. */
  private async onPickChannel(chatId: string, cbId: string, productId: string): Promise<void> {
    const product = this.recall(productId);
    if (!product) {
      await this.answer(cbId, 'התוצאה פגה');
      await this.send(chatId, 'התוצאות פגו — שלח חיפוש חדש כדי לפרסם.');
      return;
    }

    const userId = await this.ownerUserId();
    const groups = userId ? await this.telegramChannels(userId) : [];
    if (!groups.length) {
      await this.answer(cbId);
      await this.send(chatId, 'לא הוגדרה אף קבוצת טלגרם פעילה — הוסף קבוצה בלוח הבקרה.');
      return;
    }

    const keyboard: Keyboard = groups.map((g) => [{
      text: `📣 ${g.name}`,
      callback_data: encodeCallback('g', productId, g.id),
    }]);
    keyboard.push([{ text: '❌ ביטול', callback_data: 'x' }]);

    await this.answer(cbId);
    await this.send(chatId, `לאן לפרסם את «${truncate(product.title, 60)}»?`, keyboard);
  }

  /** Group tapped → publish now through the same path the dashboard uses. */
  private async onPublish(
    chatId: string, cbId: string, messageId: number | undefined,
    productId: string, channelKey: string,
  ): Promise<void> {
    const product = this.recall(productId);
    const userId = await this.ownerUserId();
    if (!product || !userId) {
      await this.answer(cbId, 'התוצאה פגה');
      await this.editText(chatId, messageId, 'התוצאות פגו — שלח חיפוש חדש כדי לפרסם.');
      return;
    }

    const groups = await this.telegramChannels(userId);
    const group = matchByPrefix(groups, channelKey);
    if (!group) {
      await this.answer(cbId, 'הקבוצה לא נמצאה');
      await this.editText(chatId, messageId, 'הקבוצה לא נמצאה או הושבתה — נסה שוב.');
      return;
    }

    // Editing the message drops its keyboard too, so a second tap can't double-publish.
    await this.answer(cbId, 'מפרסם…');
    await this.editText(chatId, messageId, `⏳ מפרסם ל${group.name}…`);

    try {
      const post = await this.posts.quickPost(
        userId, productId,
        undefined,               // text — let the AI write it, as the dashboard does
        undefined,               // channelOverride — superseded by `channels` below
        product.image_url,
        product.affiliate_url,
        product,
        [group.channel_id],
      );
      const title = truncate(product.title, 60);
      await this.editText(chatId, messageId, post.status === 'sent'
        ? `✅ פורסם ל${group.name}\n${title}${post.error_message ? `\n⚠️ ${post.error_message}` : ''}`
        : `❌ הפרסום ל${group.name} נכשל: ${post.error_message || 'שגיאה לא ידועה'}`);
    } catch (err: any) {
      this.logger.warn(`bot publish ${productId} → ${group.name} failed: ${err?.message}`);
      await this.editText(chatId, messageId, `❌ הפרסום נכשל: ${err?.message || err}`);
    }
  }

  // ── Owner / groups ─────────────────────────────────────────────────────────

  /** The account the bot acts as: the first admin with AliExpress credentials
   *  configured, falling back to the first admin. */
  private async ownerUserId(): Promise<string | null> {
    const admins = await this.users.find({ where: { role: 'admin' } });
    for (const admin of admins) {
      const creds = await this.credentials.getRaw(admin.id).catch(() => null);
      if (creds?.aliexpress_app_key) return admin.id;
    }
    return admins[0]?.id || null;
  }

  private async telegramChannels(userId: string): Promise<Channel[]> {
    const active = await this.channels.find({
      where: { user_id: userId, is_active: true },
      order: { created_at: 'ASC' },
    });
    return active.filter((c) => (c.platform || 'telegram') === 'telegram' && !!c.channel_id);
  }

  // ── Result cache ───────────────────────────────────────────────────────────

  private remember(product: BotProduct): void {
    this.shown.set(product.product_id, { product, at: Date.now() });
    if (this.shown.size > TelegramBotService.CACHE_MAX) {
      // Map preserves insertion order — drop the oldest entries first.
      const excess = this.shown.size - TelegramBotService.CACHE_MAX;
      for (const key of Array.from(this.shown.keys()).slice(0, excess)) this.shown.delete(key);
    }
  }

  private recall(productId: string): BotProduct | null {
    const hit = this.shown.get(productId);
    if (!hit) return null;
    if (Date.now() - hit.at > TelegramBotService.CACHE_TTL_MS) {
      this.shown.delete(productId);
      return null;
    }
    return hit.product;
  }

  // ── Telegram API ───────────────────────────────────────────────────────────

  /** Same token resolution as the watchdog: an explicit bot token, else an admin's. */
  private async telegramToken(): Promise<string | null> {
    if (process.env.WATCHDOG_TELEGRAM_BOT_TOKEN) return process.env.WATCHDOG_TELEGRAM_BOT_TOKEN;
    const admins = await this.users.find({ where: { role: 'admin' } });
    for (const admin of admins) {
      const token = await this.credentials.getTelegramToken(admin.id).catch(() => null);
      if (token) return token;
    }
    return null;
  }

  private async call(method: string, payload: Record<string, any>): Promise<boolean> {
    const token = await this.telegramToken();
    if (!token) return false;
    try {
      await axios.post(`https://api.telegram.org/bot${token}/${method}`, payload, { timeout: 15000 });
      return true;
    } catch (err: any) {
      this.logger.warn(`telegram ${method} failed: ${err?.response?.data?.description || err?.message}`);
      return false;
    }
  }

  private send(chatId: string, text: string, keyboard?: Keyboard): Promise<boolean> {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  }

  /** A report too long for one message, sent in order as several. */
  private async sendLong(chatId: string, text: string): Promise<void> {
    for (const part of splitMessage(text)) await this.send(chatId, part);
  }

  private sendPhoto(chatId: string, photo: string, caption: string, keyboard?: Keyboard): Promise<boolean> {
    return this.call('sendPhoto', {
      chat_id: chatId,
      photo,
      caption,
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  }

  /** Stops the button's loading spinner. Telegram expires these fast, so failures are ignored. */
  private answer(callbackQueryId: string, text?: string): Promise<boolean> {
    if (!callbackQueryId) return Promise.resolve(false);
    return this.call('answerCallbackQuery', { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
  }

  private async editText(chatId: string, messageId: number | undefined, text: string): Promise<void> {
    if (!messageId) { await this.send(chatId, text); return; }
    const edited = await this.call('editMessageText', { chat_id: chatId, message_id: messageId, text });
    if (!edited) await this.send(chatId, text);
  }
}
