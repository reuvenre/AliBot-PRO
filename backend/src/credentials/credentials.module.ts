import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CredentialSet } from './credential-set.entity';
import { Channel } from '../channels/channel.entity';
import { CredentialsService } from './credentials.service';
import { CredentialsController } from './credentials.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([CredentialSet, Channel]), MailModule],
  providers: [CredentialsService],
  controllers: [CredentialsController],
  exports: [CredentialsService],
})
export class CredentialsModule {}
