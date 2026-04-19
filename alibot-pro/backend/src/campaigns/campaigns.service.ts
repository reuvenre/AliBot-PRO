import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './campaign.entity';
import { CampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly repo: Repository<Campaign>,
  ) {}

  async list(userId: string, page = 1, limit = 20, status?: string) {
    const qb = this.repo.createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .orderBy('c.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('c.status = :status', { status });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async get(userId: string, id: string) {
    const campaign = await this.repo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.user_id !== userId) throw new ForbiddenException();
    return campaign;
  }

  async create(userId: string, dto: CampaignDto) {
    const campaign = this.repo.create({
      ...dto,
      user_id: userId,
      status: 'draft',
      next_run_at: this.nextRun(dto.schedule_cron),
    });
    return this.repo.save(campaign);
  }

  async update(userId: string, id: string, dto: Partial<CampaignDto>) {
    const campaign = await this.get(userId, id);
    Object.assign(campaign, dto);
    if (dto.schedule_cron) {
      campaign.next_run_at = this.nextRun(dto.schedule_cron);
    }
    return this.repo.save(campaign);
  }

  async delete(userId: string, id: string) {
    const campaign = await this.get(userId, id);
    await this.repo.remove(campaign);
    return { deleted: true };
  }

  async pause(userId: string, id: string) {
    const campaign = await this.get(userId, id);
    campaign.status = 'paused';
    return this.repo.save(campaign);
  }

  async resume(userId: string, id: string) {
    const campaign = await this.get(userId, id);
    campaign.status = 'active';
    campaign.next_run_at = this.nextRun(campaign.schedule_cron);
    return this.repo.save(campaign);
  }

  async markRun(id: string) {
    const campaign = await this.repo.findOne({ where: { id } });
    if (!campaign) return;
    campaign.last_run_at = new Date();
    campaign.next_run_at = this.nextRun(campaign.schedule_cron);
    await this.repo.save(campaign);
  }

  async incrementPostsCount(id: string) {
    await this.repo.increment({ id }, 'posts_count', 1);
  }

  async findActiveForUser(userId: string) {
    return this.repo.find({ where: { user_id: userId, status: 'active' } });
  }

  async findAllActive() {
    return this.repo.find({ where: { status: 'active' } });
  }

  private nextRun(cron: string): Date {
    try {
      // Parse cron and compute next fire time using simple Date math
      // Falls back to null if cron is invalid
      const { CronTime } = require('cron');
      const ct = new CronTime(cron);
      const next = ct.sendAt();
      return next.toJSDate ? next.toJSDate() : (next as any).toDate?.() ?? null;
    } catch {
      return null;
    }
  }
}
