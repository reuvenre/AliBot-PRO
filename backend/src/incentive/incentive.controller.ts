import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IncentiveService, IncentiveInput } from './incentive.service';

/** The owner's registered AliExpress bonus pools — see incentive-program.entity.ts. */
@Controller('incentive-programs')
@UseGuards(JwtAuthGuard)
export class IncentiveController {
  constructor(private readonly svc: IncentiveService) {}

  private uid(req: Request) { return (req.user as any).id; }

  @Get()
  list(@Req() req: Request) {
    return this.svc.list(this.uid(req));
  }

  /** Per-pool performance inside its window — posts/clicks/orders/base commission. */
  @Get('stats')
  stats(@Req() req: Request) {
    return this.svc.stats(this.uid(req));
  }

  /** Suggested keywords for a pool name — known pools answer instantly, else one AI call. */
  @Post('suggest-keywords')
  @HttpCode(200)
  suggest(@Req() req: Request, @Body('name') name: string) {
    return this.svc.suggestKeywords(this.uid(req), name || '');
  }

  @Post()
  create(@Req() req: Request, @Body() body: IncentiveInput) {
    return this.svc.create(this.uid(req), body || {});
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: IncentiveInput) {
    return this.svc.update(this.uid(req), id, body || {});
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.svc.remove(this.uid(req), id);
  }
}
