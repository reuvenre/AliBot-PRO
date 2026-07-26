import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { WatchdogService } from './watchdog.service';

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
    if (secret && secret === this.watchdog.telegramWebhookSecret()) {
      await this.watchdog.handleTelegramUpdate(body).catch(() => {});
    }
    return { ok: true };
  }
}
