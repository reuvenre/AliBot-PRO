import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogProduct } from './catalog-product.entity';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { ProductsModule } from '../products/products.module';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CatalogProduct]),
    ProductsModule,
    PostsModule,
  ],
  providers: [CatalogService],
  controllers: [CatalogController],
  exports: [CatalogService],
})
export class CatalogModule {}
