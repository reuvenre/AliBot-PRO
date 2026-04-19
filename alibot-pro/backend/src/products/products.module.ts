import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CredentialsModule } from '../credentials/credentials.module';
import { RatesModule } from '../rates/rates.module';

@Module({
  imports: [CredentialsModule, RatesModule],
  providers: [ProductsService],
  controllers: [ProductsController],
})
export class ProductsModule {}
