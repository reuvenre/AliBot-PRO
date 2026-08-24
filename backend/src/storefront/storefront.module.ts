import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Storefront } from './storefront.entity';
import { User } from '../users/user.entity';
import { StorefrontService } from './storefront.service';
import { PublicStorefrontController, StorefrontController } from './storefront.controller';
import { LinksModule } from '../links/links.module';

// User is registered as a REPOSITORY rather than importing UsersModule: the store only
// needs a name to seed its slug from, and UsersModule pulls in the watchdog/telegram tree.
@Module({
  imports: [
    TypeOrmModule.forFeature([Storefront, User]),
    // Buy buttons redirect through /r/<code>, so a sale that started on the store is
    // counted as evidence about the product like any channel click.
    LinksModule,
  ],
  controllers: [PublicStorefrontController, StorefrontController],
  providers: [StorefrontService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
