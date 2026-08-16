import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinksModule } from '../links/links.module';
import { ProductsModule } from '../products/products.module';
import { Post } from './post.entity';
import { PostedProduct } from './posted-product.entity';
import { Template } from '../templates/template.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { InstagramImageController } from './instagram-image.controller';
import { CredentialsModule } from '../credentials/credentials.module';
import { CouponsModule } from '../coupons/coupons.module';
import { RatesModule } from '../rates/rates.module';
import { AiModule } from '../ai/ai.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ChannelsModule } from '../channels/channels.module';
import { CollageModule } from '../collage/collage.module';
import { IncentiveModule } from '../incentive/incentive.module';
import { PinterestModule } from '../pinterest/pinterest.module';
import { UploadedImage } from './uploaded-image.entity';

@Module({
  imports: [
    // Campaign is registered as a REPOSITORY (not CampaignsService) on purpose:
    // CampaignsModule already imports PostsModule, so injecting the service back
    // would close a circular dependency.
    TypeOrmModule.forFeature([Post, PostedProduct, Template, Campaign, UploadedImage]),
    CredentialsModule,
    CouponsModule,
    LinksModule,
    ProductsModule,
    RatesModule,
    AiModule,
    SubscriptionModule,
    ChannelsModule,
    CollageModule,
    // Publishing a pin goes through PinterestService for its token (refresh + scope check).
    // Safe direction: PinterestModule holds only the Post REPOSITORY, never PostsService,
    // so this does not close a cycle.
    PinterestModule,
    // Bonus-pool steering: reads the owner's registered incentive campaigns.
    // One-way (IncentiveModule knows nothing about posts), so no cycle.
    IncentiveModule,
  ],
  providers: [PostsService],
  controllers: [PostsController, InstagramImageController],
  exports: [PostsService],
})
export class PostsModule {}
