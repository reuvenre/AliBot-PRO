import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../campaigns/campaign.entity';
import { OptimizerRun } from './optimizer-run.entity';
import { OptimizerService } from './optimizer.service';
import { CredentialsModule } from '../credentials/credentials.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, OptimizerRun]),
    CredentialsModule,
    SubscriptionModule,
    MailModule,
  ],
  providers: [OptimizerService],
  exports: [OptimizerService],
})
export class OptimizerModule {}
