import { Controller, Get, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { planAllows } from '../subscription/plans.const';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  /** Scale-tier feature — admins bypass. Uses the shared feature map, not a hardcoded
   *  plan string, so an admin on any plan (and future tier changes) resolve consistently. */
  private assertLandingPages(user: any) {
    const ok = user?.role === 'admin' || planAllows(user?.subscription_plan, 'landing_pages');
    if (!ok) throw new ForbiddenException('דפי הנחיתה (ClickLead) זמינים בתוכנית Scale בלבד');
  }

  /**
   * Scale-only. Returns a Firebase custom token + ClickLead URL so the frontend can open
   * ClickLead already signed in. `token` is null when SSO isn't configured yet (no service
   * account) — the frontend then just opens ClickLead with its own login (stage 1 fallback).
   */
  @Get('clicklead/sso')
  async clickleadSso(@Req() req: Request) {
    const user = req.user as any;
    this.assertLandingPages(user);
    const token = await this.svc.clickleadSsoToken(user?.email);
    return { token, url: this.svc.clickleadUrl };
  }

  /**
   * Scale-only. The user's ClickLead campaigns joined with the commissions
   * their groups earned here — the dashboard ROI widget.
   */
  @Get('clicklead/roi')
  async clickleadRoi(@Req() req: Request) {
    const user = req.user as any;
    this.assertLandingPages(user);
    return this.svc.clickleadRoi(user?.email);
  }
}
