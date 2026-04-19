import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignsService } from '../campaigns/campaigns.service';
import { PostsService } from '../posts/posts.service';

@Injectable()
export class CampaignSchedulerService {
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private running = new Set<string>();

  constructor(
    private readonly campaigns: CampaignsService,
    private readonly posts: PostsService,
  ) {}

  /** Runs every minute — sends posts that have reached their scheduled_at time */
  @Cron(CronExpression.EVERY_MINUTE)
  async sendScheduledPosts() {
    try {
      const due = await this.posts.findDueScheduledPosts();
      for (const post of due) {
        await this.posts.sendScheduled(post);
      }
    } catch (err) {
      this.logger.error(`Scheduled posts tick failed: ${err.message}`);
    }
  }

  /** Runs every minute — checks which active campaigns are due */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    let active: any[];
    try {
      active = await this.campaigns.findAllActive();
    } catch {
      return;
    }

    const now = new Date();

    for (const campaign of active) {
      if (!campaign.next_run_at) continue;
      if (new Date(campaign.next_run_at) > now) continue;
      if (this.running.has(campaign.id)) continue;

      this.running.add(campaign.id);
      this.logger.log(`Running campaign "${campaign.name}" (${campaign.id})`);

      this.campaigns.markRun(campaign.id)
        .then(() => this.posts.runCampaign(campaign, campaign.user_id))
        .catch((err) => this.logger.error(`Campaign ${campaign.id} failed: ${err.message}`))
        .finally(() => this.running.delete(campaign.id));
    }
  }
}
