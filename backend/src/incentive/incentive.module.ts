import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncentiveProgram } from './incentive-program.entity';
import { IncentiveService } from './incentive.service';
import { IncentiveController } from './incentive.controller';
import { CredentialsModule } from '../credentials/credentials.module';
import { MailModule } from '../mail/mail.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AiModule } from '../ai/ai.module';
import { User } from '../users/user.entity';
import { Post } from '../posts/post.entity';
import { Earning } from '../earnings/earning.entity';

@Module({
  // Post + Earning repos power the per-pool performance stats (posts/clicks/orders by the
  // pool's keywords inside its window) — repositories directly, no module import needed.
  imports: [TypeOrmModule.forFeature([IncentiveProgram, User, Post, Earning]), CredentialsModule, MailModule, SubscriptionModule, AiModule],
  providers: [IncentiveService],
  controllers: [IncentiveController],
  exports: [IncentiveService],
})
export class IncentiveModule {}
