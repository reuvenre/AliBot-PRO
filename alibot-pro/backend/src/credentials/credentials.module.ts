import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CredentialSet } from './credential-set.entity';
import { CredentialsService } from './credentials.service';
import { CredentialsController } from './credentials.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CredentialSet])],
  providers: [CredentialsService],
  controllers: [CredentialsController],
  exports: [CredentialsService],
})
export class CredentialsModule {}
