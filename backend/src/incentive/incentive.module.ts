import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncentiveProgram } from './incentive-program.entity';
import { IncentiveService } from './incentive.service';
import { IncentiveController } from './incentive.controller';
import { CredentialsModule } from '../credentials/credentials.module';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IncentiveProgram, User]), CredentialsModule, MailModule],
  providers: [IncentiveService],
  controllers: [IncentiveController],
  exports: [IncentiveService],
})
export class IncentiveModule {}
