import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param,
  Query, Req, UseGuards, HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CatalogService } from './catalog.service';

@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  private uid(req: Request): string { return (req.user as any).id; }

  // ── List ──────────────────────────────────────────────────────────────────

  @Get()
  list(
    @Req() req: Request,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('has_post') hasPost?: string,
    @Query('search') search?: string,
  ) {
    const hp = hasPost === 'true' ? true : hasPost === 'false' ? false : undefined;
    return this.svc.list(this.uid(req), +page, +limit, status, hp, search);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  @Get('stats')
  stats(@Req() req: Request) {
    return this.svc.stats(this.uid(req));
  }

  // ── Import ────────────────────────────────────────────────────────────────

  @Post('import')
  @HttpCode(201)
  importProduct(
    @Req() req: Request,
    @Body('url') url?: string,
    @Body('product_id') productId?: string,
    @Body('category') category?: string,
  ) {
    return this.svc.importProduct(this.uid(req), { url, productId, category });
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.svc.findOne(this.uid(req), id);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  @Put(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.svc.update(this.uid(req), id, dto);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.svc.remove(this.uid(req), id);
  }

  // ── Approve ───────────────────────────────────────────────────────────────

  @Patch(':id/approve')
  @HttpCode(200)
  approve(@Req() req: Request, @Param('id') id: string) {
    return this.svc.setStatus(this.uid(req), id, 'approved');
  }

  // ── Reject ────────────────────────────────────────────────────────────────

  @Patch(':id/reject')
  @HttpCode(200)
  reject(@Req() req: Request, @Param('id') id: string) {
    return this.svc.setStatus(this.uid(req), id, 'rejected');
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  @Post(':id/sync')
  @HttpCode(200)
  sync(@Req() req: Request, @Param('id') id: string) {
    return this.svc.sync(this.uid(req), id);
  }

  // ── Affiliate link ────────────────────────────────────────────────────────

  @Post(':id/affiliate-link')
  @HttpCode(200)
  affiliateLink(@Req() req: Request, @Param('id') id: string) {
    return this.svc.affiliateLink(this.uid(req), id);
  }
}
