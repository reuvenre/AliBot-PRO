import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CouponsService } from './coupons.service';
import { CredentialsService } from '../credentials/credentials.service';

@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
  constructor(
    private readonly svc: CouponsService,
    private readonly credentials: CredentialsService,
  ) {}

  private uid(req: Request) { return (req.user as any).id; }

  @Get()
  list(@Req() req: Request) {
    return this.svc.list(this.uid(req));
  }

  /** Parse a pasted block WITHOUT saving — lets the UI show what was detected first. */
  @Post('preview')
  @HttpCode(200)
  preview(@Body('text') text: string) {
    return { coupons: this.svc.preview(text || '') };
  }

  /**
   * AI fallback for wording the regex can't parse. Costs one AI generation, so it's a
   * separate on-demand call rather than part of the live preview. Still returns only
   * schema-validated rows.
   */
  @Post('preview-ai')
  @HttpCode(200)
  async previewAi(@Req() req: Request, @Body('text') text: string) {
    const creds = await this.credentials.getRaw(this.uid(req));
    return { coupons: await this.svc.parseWithAi(creds, text || '') };
  }

  /** Import a pasted coupon block. Re-importing the same code refreshes it. */
  @Post('import')
  @HttpCode(201)
  async import(
    @Req() req: Request,
    @Body('text') text: string,
    @Body('campaign') campaign?: string,
    @Body('starts_at') startsAt?: string,
    @Body('ends_at') endsAt?: string,
    @Body('deals_url') dealsUrl?: string,
  ) {
    const result = await this.svc.importText(this.uid(req), text || '', { campaign, starts_at: startsAt, ends_at: endsAt, deals_url: dealsUrl });
    // Saving the batch also (re)builds its launch sequence — teaser, launch, mid-window
    // anchor, last-hours urgency (coupon-sequence.ts). Best-effort by contract: the
    // import itself already succeeded.
    const creds = await this.credentials.getRaw(this.uid(req)).catch(() => null);
    const sequence = await this.svc.syncLaunchSequence(this.uid(req), creds);
    return { ...result, sequence };
  }

  /** Manually add/update one coupon — the fallback when AliExpress changes its wording. */
  @Post()
  @HttpCode(201)
  async addOne(@Req() req: Request, @Body() dto: {
    code: string; discount_usd: number; min_spend_usd: number;
    campaign?: string; starts_at?: string; ends_at?: string; deals_url?: string;
  }) {
    const coupon = await this.svc.upsertOne(this.uid(req), dto);
    const creds = await this.credentials.getRaw(this.uid(req)).catch(() => null);
    const sequence = await this.svc.syncLaunchSequence(this.uid(req), creds);
    return { ...coupon, sequence };
  }

  /** Which coupon a given product price would get — used for the live preview. */
  @Get('best')
  async best(@Req() req: Request, @Query('price_usd') priceUsd: string) {
    const match = await this.svc.bestFor(this.uid(req), Number(priceUsd) || 0);
    return {
      coupon: match?.coupon ?? null,
      // false = the price is below every tier, so this is the "add another item" nudge.
      qualifies: match?.qualifies ?? false,
      line: match ? this.svc.couponLine(match.coupon, match.qualifies) : null,
    };
  }

  /** is_active on its own keeps the old toggle contract; any other field edits the coupon. */
  @Patch(':id')
  patch(
    @Req() req: Request, @Param('id') id: string,
    @Body() body: { is_active?: boolean; campaign?: string | null; starts_at?: string | null; ends_at?: string | null },
  ) {
    const editing = body?.campaign !== undefined
      || body?.starts_at !== undefined || body?.ends_at !== undefined;
    if (!editing) return this.svc.setActive(this.uid(req), id, body?.is_active !== false);
    return this.svc.update(this.uid(req), id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.svc.remove(this.uid(req), id);
  }
}
