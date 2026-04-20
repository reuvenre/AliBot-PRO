import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignsService } from '../campaigns/campaigns.service';
import { PostsService } from '../posts/posts.service';
import { CredentialsService } from '../credentials/credentials.service';

@Injectable()
export class CampaignSchedulerService {
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private running = new Set<string>();

  constructor(
    private readonly campaigns: CampaignsService,
    private readonly posts: PostsService,
    private readonly credentials: CredentialsService,
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

  /**
   * Runs every minute — processes the smart scheduling queue.
   * For each user who has schedule_enabled=true:
   *  • Checks if current time is within their configured send window
   *  • Checks if the interval since the last sent queued post has elapsed
   *  • If both conditions pass, sends the next post from the queue
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processQueue() {
    let credentialSets: any[];
    try {
      credentialSets = await this.credentials.getAllSchedulingEnabled();
    } catch {
      return;
    }

    const now = new Date();
    const nowHour = now.getHours();

    for (const cred of credentialSets) {
      try {
        const startHour = cred.schedule_start_hour ?? 9;
        const endHour   = cred.schedule_end_hour   ?? 22;
        const interval  = cred.schedule_interval_minutes ?? 60;

        // Skip if outside the allowed time window
        if (nowHour < startHour || nowHour >= endHour) continue;

        // Skip if the interval since last send hasn't elapsed
        if (cred.schedule_last_sent_at) {
          const minsSinceLast =
            (now.getTime() - new Date(cred.schedule_last_sent_at).getTime()) / 60_000;
          if (minsSinceLast < interval) continue;
        }

        // Try to send the next queued post
        const sent = await this.posts.processNextQueuedPost(cred.user_id);
        if (sent) {
          await this.credentials.updateLastSent(cred.user_id, now);
          this.logger.log(`Queue: sent post for user ${cred.user_id}`);
        }
      } catch (err) {
        this.logger.error(`Queue tick failed for user ${cred.user_id}: ${err.message}`);
      }
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
