import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CredentialsModule } from './credentials/credentials.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ProductsModule } from './products/products.module';
import { PostsModule } from './posts/posts.module';
import { EarningsModule } from './earnings/earnings.module';
import { RatesModule } from './rates/rates.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ChannelsModule } from './channels/channels.module';
import { TemplatesModule } from './templates/templates.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'], // finds alibot-pro/.env when running from alibot-pro/backend/
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
        ssl: config.get('NODE_ENV') === 'production' && config.get('DATABASE_SSL') === 'true'
          ? { rejectUnauthorized: false }
          : false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    CredentialsModule,
    CampaignsModule,
    ProductsModule,
    PostsModule,
    EarningsModule,
    RatesModule,
    SchedulerModule,
    ChannelsModule,
    TemplatesModule,
    CatalogModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
