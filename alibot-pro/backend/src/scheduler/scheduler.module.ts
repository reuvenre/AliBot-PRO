import { Module } from '@nestjs/common';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [CampaignsModule, PostsModule],
  providers: [CampaignSchedulerService],
})
export class SchedulerModule {}
