import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { WatchdogService } from './watchdog.service';

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
 */
@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly watchdog: WatchdogService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string,
    @Body() body: any,
  ) {
    if (secret && safeEqual(secret, this.watchdog.telegramWebhookSecret())) {
      await this.watchdog.handleTelegramUpdate(body).catch(() => {});
    }
    return { ok: true };
  }
}
