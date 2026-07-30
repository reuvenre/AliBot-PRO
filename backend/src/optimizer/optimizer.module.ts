import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../campaigns/campaign.entity';
import { OptimizerRun } from './optimizer-run.entity';
import { OptimizerService } from './optimizer.service';
import { OptimizerController } from './optimizer.controller';
import { CredentialsModule } from '../credentials/credentials.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MailModule } from '../mail/mail.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, OptimizerRun]),
    CredentialsModule,
    SubscriptionModule,
    MailModule,
    // Resolves a sold product id to its real AliExpress category (productdetail.get).
    ProductsModule,
  ],
  controllers: [OptimizerController],
  providers: [OptimizerService],
  exports: [OptimizerService],
})
export class OptimizerModule {}
