import { Controller, Get, Post, Query, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly svc: ProductsService) {}

  @Get('search')
  search(
    @Req() req: Request,
    @Query('keyword') keyword: string,
    @Query('category_id') category_id?: string,
    @Query('min_price') min_price?: string,
    @Query('max_price') max_price?: string,
    @Query('min_discount') min_discount?: string,
    @Query('sort') sort?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    return this.svc.search((req.user as any).id, {
      keyword,
      category_id,
      min_price: min_price ? +min_price : undefined,
      max_price: max_price ? +max_price : undefined,
      min_discount: min_discount ? +min_discount : undefined,
      sort,
      page: +page,
      limit: +limit,
    });
  }

  @Get('featured')
  featured(
    @Req() req: Request,
    @Query('category_id') category_id?: string,
    @Query('sort') sort?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    return this.svc.getFeatured((req.user as any).id, {
      category_id,
      sort: sort as any,
      page: +page,
      limit: +limit,
    });
  }

  @Get(':id/refresh-price')
  refreshPrice(@Req() req: Request, @Param('id') id: string) {
    return this.svc.refreshPrice((req.user as any).id, id);
  }

  @Get('promotional')
  promotional(
    @Req() req: Request,
    @Query('category_id') category_id?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    return this.svc.getPromotional((req.user as any).id, {
      category_id,
      page: +page,
      limit: +limit,
    });
  }

  @Get('categories')
  categories(@Req() req: Request) {
    return this.svc.getCategories((req.user as any).id);
  }

  @Post('affiliate-link')
  affiliateLink(@Req() req: Request, @Body('product_id') productId: string) {
    return this.svc.affiliateLink((req.user as any).id, productId);
  }
}
