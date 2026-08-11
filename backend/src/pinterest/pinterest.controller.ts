import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PinterestService } from './pinterest.service';

@Controller('pinterest')
@UseGuards(JwtAuthGuard)
export class PinterestController {
  constructor(private readonly svc: PinterestService) {}

  /** Per-pin performance (30 days) + totals for the reports screen. */
  @Get('analytics')
  analytics(@Req() req: Request) {
    return this.svc.analytics((req.user as any).id);
  }

  /** The account's boards → the settings picker. The numeric board id the publish API
   *  needs is not visible anywhere in Pinterest's own UI. */
  @Get('boards')
  boards(@Req() req: Request) {
    return this.svc.boards((req.user as any).id);
  }
}
