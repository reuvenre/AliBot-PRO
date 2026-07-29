import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { WatchdogService } from './watchdog.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';

/** Constant-time string compare — avoids leaking the secret via response timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * PUBLIC endpoint Telegram POSTs bot updates to (set via setWebhook on boot). Auth is the
 * secret_token header Telegram echoes back — anything else is silently ignored. Always
 * answers 200 so Telegram never retry-storms.
 *
 * One bot serves two features, split here: a status keyword goes to the watchdog, and
 * everything else (product searches and the inline buttons they carry) to the product bot.
 */
@Controller('telegram')
export class TelegramWebhookController {
  constructor(
    private readonly watchdog: WatchdogService,
    private readonly bot: TelegramBotService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string,
    @Body() body: any,
  ) {
    if (secret && safeEqual(secret, this.watchdog.telegramWebhookSecret())) {
      // A callback_query carries no message text, so button taps always reach the bot.
      const text = String(body?.message?.text || '').trim();
      const handled = this.watchdog.isStatusRequest(text)
        ? this.watchdog.handleTelegramUpdate(body)
        : this.bot.handleUpdate(body);
      await handled.catch(() => {});
    }
    return { ok: true };
  }
}
