import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CredentialSet } from './credential-set.entity';
import { CredentialSetDto } from './dto/credential-set.dto';
import { encrypt, decrypt, mask } from '../common/crypto';
import axios from 'axios';

export interface DecryptedCredentials {
  aliexpress_app_key?: string;
  aliexpress_app_secret?: string;
  aliexpress_tracking_id?: string;
  telegram_bot_token?: string;
  telegram_channel_id?: string;
  openai_api_key?: string;
  openai_model?: string;
  currency_pair?: string;
}

@Injectable()
export class CredentialsService {
  constructor(
    @InjectRepository(CredentialSet)
    private readonly repo: Repository<CredentialSet>,
  ) {}

  async get(userId: string): Promise<any> {
    const cred = await this.repo.findOne({ where: { user_id: userId } });
    if (!cred) throw new NotFoundException('No credentials saved yet');
    return this.toPublic(cred);
  }

  async upsert(userId: string, dto: CredentialSetDto): Promise<any> {
    let cred = await this.repo.findOne({ where: { user_id: userId } });
    if (!cred) {
      cred = this.repo.create({ user_id: userId });
    }

    // Non-secret fields — only update when a non-empty value is provided
    if (dto.aliexpress_app_key?.trim())      cred.aliexpress_app_key = dto.aliexpress_app_key.trim();
    if (dto.aliexpress_tracking_id?.trim())  cred.aliexpress_tracking_id = dto.aliexpress_tracking_id.trim();
    if (dto.telegram_channel_id?.trim())     cred.telegram_channel_id = dto.telegram_channel_id.trim();
    if (dto.openai_model?.trim())            cred.openai_model = dto.openai_model.trim();
    if (dto.currency_pair?.trim())           cred.currency_pair = dto.currency_pair.trim();

    // Scheduling queue settings
    if (dto.schedule_enabled !== undefined)  cred.schedule_enabled = dto.schedule_enabled;
    if (dto.schedule_start_hour !== undefined)     cred.schedule_start_hour = dto.schedule_start_hour;
    if (dto.schedule_end_hour !== undefined)       cred.schedule_end_hour = dto.schedule_end_hour;
    if (dto.schedule_interval_minutes !== undefined) cred.schedule_interval_minutes = dto.schedule_interval_minutes;

    // Secret fields — only update when a non-empty value is provided
    if (dto.aliexpress_app_secret?.trim()) {
      cred.aliexpress_app_secret_enc = encrypt(dto.aliexpress_app_secret.trim());
    }
    if (dto.telegram_bot_token?.trim()) {
      cred.telegram_bot_token_enc = encrypt(dto.telegram_bot_token.trim());
    }
    if (dto.openai_api_key?.trim()) {
      cred.openai_api_key_enc = encrypt(dto.openai_api_key.trim());
    }

    await this.repo.save(cred);
    return this.toPublic(cred);
  }

  async verify(userId: string): Promise<{ aliexpress: boolean; telegram: boolean; openai: boolean }> {
    const cred = await this.repo.findOne({ where: { user_id: userId } });
    if (!cred) return { aliexpress: false, telegram: false, openai: false };

    const results = { aliexpress: false, telegram: false, openai: false };

    // Verify Telegram
    try {
      const token = decrypt(cred.telegram_bot_token_enc);
      const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 5000 });
      results.telegram = res.data?.ok === true;
    } catch {}

    // Verify OpenAI
    try {
      const key = decrypt(cred.openai_api_key_enc);
      const res = await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 5000,
      });
      results.openai = res.status === 200;
    } catch {}

    // AliExpress: just check that keys are set
    results.aliexpress = !!(cred.aliexpress_app_key && cred.aliexpress_tracking_id);

    return results;
  }

  // Return decrypted credentials for internal use
  async getRaw(userId: string): Promise<DecryptedCredentials | null> {
    const cred = await this.repo.findOne({ where: { user_id: userId } });
    if (!cred) return null;
    return {
      aliexpress_app_key: cred.aliexpress_app_key,
      aliexpress_app_secret: decrypt(cred.aliexpress_app_secret_enc),
      aliexpress_tracking_id: cred.aliexpress_tracking_id,
      telegram_bot_token: decrypt(cred.telegram_bot_token_enc),
      telegram_channel_id: cred.telegram_channel_id,
      openai_api_key: decrypt(cred.openai_api_key_enc),
      openai_model: cred.openai_model,
      currency_pair: cred.currency_pair,
      schedule_enabled: cred.schedule_enabled,
      schedule_start_hour: cred.schedule_start_hour,
      schedule_end_hour: cred.schedule_end_hour,
      schedule_interval_minutes: cred.schedule_interval_minutes,
      schedule_last_sent_at: cred.schedule_last_sent_at,
    };
  }

  /** Returns all credential sets with scheduling enabled (for queue cron) */
  async getAllSchedulingEnabled(): Promise<CredentialSet[]> {
    return this.repo.find({ where: { schedule_enabled: true } });
  }

  /** Records the timestamp of the last sent queued post */
  async updateLastSent(userId: string, sentAt: Date): Promise<void> {
    await this.repo.update({ user_id: userId }, { schedule_last_sent_at: sentAt });
  }

  private toPublic(cred: CredentialSet) {
    return {
      id: cred.id,
      aliexpress_app_key: cred.aliexpress_app_key || '',
      aliexpress_tracking_id: cred.aliexpress_tracking_id || '',
      // Masked secrets — shown as placeholders, re-enter to update
      aliexpress_app_secret: cred.aliexpress_app_secret_enc ? mask(decrypt(cred.aliexpress_app_secret_enc)) : '',
      telegram_bot_token: cred.telegram_bot_token_enc ? mask(decrypt(cred.telegram_bot_token_enc)) : '',
      telegram_channel_id: cred.telegram_channel_id || '',
      openai_api_key: cred.openai_api_key_enc ? mask(decrypt(cred.openai_api_key_enc)) : '',
      openai_model: cred.openai_model || 'gpt-4o-mini',
      currency_pair: cred.currency_pair || 'USD_ILS',
      schedule_enabled: cred.schedule_enabled ?? false,
      schedule_start_hour: cred.schedule_start_hour ?? 9,
      schedule_end_hour: cred.schedule_end_hour ?? 22,
      schedule_interval_minutes: cred.schedule_interval_minutes ?? 60,
      schedule_last_sent_at: cred.schedule_last_sent_at ?? null,
      created_at: cred.created_at,
      updated_at: cred.updated_at,
    };
  }
}
