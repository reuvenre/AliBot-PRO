import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Channel } from './channel.entity';
import { CreateChannelDto, UpdateChannelDto } from './dto/channel.dto';
import { encrypt, decrypt, mask, normalizeTelegramChatId } from '../common/crypto';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel)
    private readonly repo: Repository<Channel>,
  ) {}

  async list(userId: string) {
    const channels = await this.repo.find({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
    });
    return channels.map((c) => this.toPublic(c));
  }

  async create(userId: string, dto: CreateChannelDto) {
    const channel = this.repo.create({
      user_id: userId,
      name: dto.name,
      platform: dto.platform || 'telegram',
      channel_id: dto.channel_id,
      description: dto.description,
      bot_token_enc: dto.bot_token ? encrypt(dto.bot_token) : null,
    });
    await this.repo.save(channel);
    return this.toPublic(channel);
  }

  async update(userId: string, id: string, dto: UpdateChannelDto) {
    const channel = await this.findOwned(userId, id);
    if (dto.name !== undefined) channel.name = dto.name;
    if (dto.channel_id !== undefined) channel.channel_id = dto.channel_id;
    if (dto.description !== undefined) channel.description = dto.description;
    if (dto.is_active !== undefined) channel.is_active = dto.is_active;
    if (dto.bot_token?.trim()) channel.bot_token_enc = encrypt(dto.bot_token.trim());
    await this.repo.save(channel);
    return this.toPublic(channel);
  }

  async delete(userId: string, id: string) {
    const channel = await this.findOwned(userId, id);
    await this.repo.remove(channel);
    return { deleted: true };
  }

  async test(userId: string, id: string) {
    const channel = await this.findOwned(userId, id);
    const token = channel.bot_token_enc ? decrypt(channel.bot_token_enc) : null;
    if (!token || !channel.channel_id) {
      return { ok: false, error: 'Bot token or channel ID missing' };
    }
    const chatId = normalizeTelegramChatId(channel.channel_id);
    try {
      const res = await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        { chat_id: chatId, text: '✅ AliBot Pro — test connection successful!' },
        { timeout: 10000 },
      );
      return { ok: res.data?.ok === true };
    } catch (err) {
      return { ok: false, error: err?.response?.data?.description || err.message };
    }
  }

  private async findOwned(userId: string, id: string): Promise<Channel> {
    const channel = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  private toPublic(c: Channel) {
    return {
      id: c.id,
      name: c.name,
      platform: c.platform,
      channel_id: c.channel_id || '',
      description: c.description || '',
      is_active: c.is_active,
      has_token: !!c.bot_token_enc,
      bot_token_masked: c.bot_token_enc ? mask(decrypt(c.bot_token_enc)) : null,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }
}
