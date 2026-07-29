import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from '../channels/channel.entity';
import { User } from '../users/user.entity';
import { ProductsModule } from '../products/products.module';
import { PostsModule } from '../posts/posts.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { TelegramBotService } from './telegram-bot.service';

// Channel/User are registered as REPOSITORIES rather than pulling in ChannelsModule +
// UsersModule: UsersModule imports WatchdogModule, which imports this module for the
// webhook — going through the service would close that circle.
@Module({
  imports: [TypeOrmModule.forFeature([Channel, User]), ProductsModule, PostsModule, CredentialsModule],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
