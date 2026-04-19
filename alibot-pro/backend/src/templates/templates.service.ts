import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './template.entity';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly repo: Repository<Template>,
  ) {}

  list(userId: string): Promise<Template[]> {
    return this.repo.find({
      where: { user_id: userId },
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });
  }

  async create(userId: string, dto: { name: string; content: string; icon?: string }): Promise<Template> {
    const t = this.repo.create({
      user_id: userId,
      name: dto.name.trim(),
      content: dto.content.trim(),
      icon: dto.icon?.trim() || '📝',
    });
    return this.repo.save(t);
  }

  async update(userId: string, id: string, dto: { name?: string; content?: string; icon?: string }): Promise<Template> {
    const t = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!t) throw new NotFoundException('Template not found');
    if (dto.name !== undefined)   t.name    = dto.name.trim();
    if (dto.content !== undefined) t.content = dto.content.trim();
    if (dto.icon !== undefined)   t.icon    = dto.icon.trim();
    return this.repo.save(t);
  }

  async remove(userId: string, id: string): Promise<void> {
    const t = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!t) throw new NotFoundException('Template not found');
    await this.repo.remove(t);
  }
}
