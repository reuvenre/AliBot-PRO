import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Earning } from '../earnings/earning.entity';
import { Post } from '../posts/post.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { CredentialsModule } from '../credentials/credentials.module';
import { PostsModule } from '../posts/posts.module';
import { ProductsModule } from '../products/products.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { RecoveryService } from './recovery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Earning, Post, Campaign]),
    CredentialsModule,
    PostsModule,
    ProductsModule,
    SubscriptionModule,
  ],
  providers: [RecoveryService],
})
export class RecoveryModule {}
