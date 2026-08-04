import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly svc: StatsService) {}

  /**
   * One round trip for the whole dashboard header — three metrics, each with its weekly
   * series and period-over-period change. Deliberately ungated: these are the user's own
   * headline numbers, and a dashboard that hides them behind a plan tier is a bad first run.
   */
  @Get('overview')
  overview(@Req() req: Request, @Query('weeks') weeks?: string) {
    return this.svc.overview((req.user as any).id, weeks ? +weeks : 12);
  }

  /** Clicks per platform (tg/fb/ig/wa, 'other' = untagged history) over the last N days. */
  @Get('click-sources')
  clickSources(@Req() req: Request, @Query('days') days?: string) {
    return this.svc.clickSources((req.user as any).id, days ? +days : 30);
  }
}
