import { Module } from '@nestjs/common';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { PostsModule } from '../posts/posts.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [CampaignsModule, PostsModule, CredentialsModule, AgentsModule],
  providers: [CampaignSchedulerService],
})
export class SchedulerModule {}
