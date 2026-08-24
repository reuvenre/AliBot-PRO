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

  /**
   * The whole query object rather than a parameter per filter.
   *
   * Listing them one by one is how the category filter shipped broken: the panel sent
   * `?category=נעליים`, nothing here read it, and the shelf came back unfiltered with the
   * chip showing — a filter that looks applied and isn't. Reading the object means adding
   * a filter to the service is the only place it can be forgotten.
   */
  @Get(':slug/products')
  products(@Param('slug') slug: string, @Query() query: Record<string, string> = {}) {
    // A blank or non-numeric bound is "no bound", never NaN — NaN in a comparison is
    // silently false and would empty the shelf.
    const bound = (v?: string) => (v !== undefined && v !== '' && Number.isFinite(Number(v))
      ? Number(v) : undefined);
    const text = (v?: string) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

    return this.store.publicProducts(slug, {
      page: Number(query.page) || 1,
      brand: text(query.brand),
      category: text(query.category),
      group: text(query.group),
      q: text(query.q),
      sort: text(query.sort),
      minPrice: bound(query.min_price),
      maxPrice: bound(query.max_price),
    });
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
