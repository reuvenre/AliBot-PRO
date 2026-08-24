import {
  Body, Controller, Get, HttpCode, Param, Patch, Query, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorefrontService } from './storefront.service';
import { Storefront } from './storefront.entity';

/**
 * The PUBLIC storefront API — no guard, by design: this is what a follower's browser
 * calls. Everything it can reach belongs to a store its owner explicitly switched on, and
 * a disabled store answers 404 rather than "exists but hidden".
 */
@Controller('store')
export class PublicStorefrontController {
  constructor(private readonly store: StorefrontService) {}

  @Get(':slug')
  meta(@Param('slug') slug: string) {
    return this.store.publicMeta(slug);
  }

  @Get(':slug/products')
  products(
    @Param('slug') slug: string,
      @Query('page') page?: string,
      @Query('brand') brand?: string,
      @Query('group') group?: string,
      @Query('q') q?: string,
  ) {
    return this.store.publicProducts(slug, { page: Number(page) || 1, brand, group, q });
  }

  @Get(':slug/products/:id')
  product(@Param('slug') slug: string, @Param('id') id: string) {
    return this.store.publicProduct(slug, id);
  }
}

/** The owner's side: name it, address it, switch it on. */
@Controller('storefront')
@UseGuards(JwtAuthGuard)
export class StorefrontController {
  constructor(private readonly store: StorefrontService) {}

  @Get()
  async mine(@Req() req: Request) {
    const s = await this.store.mine((req.user as any).id);
    return { ...s, url: this.store.storeUrl(s.slug) };
  }

  @Patch()
  @HttpCode(200)
  async update(@Req() req: Request, @Body() dto: Partial<Storefront>) {
    const s = await this.store.update((req.user as any).id, dto);
    return { ...s, url: this.store.storeUrl(s.slug) };
  }
}
