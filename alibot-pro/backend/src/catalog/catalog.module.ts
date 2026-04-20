import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogProduct } from './catalog-product.entity';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatalogProduct]),
    ProductsModule,
  ],
  providers: [CatalogService],
  controllers: [CatalogController],
  exports: [CatalogService],
})
export class CatalogModule {}
