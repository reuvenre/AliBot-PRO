import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './post.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { CredentialsModule } from '../credentials/credentials.module';
import { RatesModule } from '../rates/rates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post]),
    CredentialsModule,
    RatesModule,
  ],
  providers: [PostsService],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
