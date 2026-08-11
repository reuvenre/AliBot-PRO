import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PinterestService } from './pinterest.service';

/** The dashboard page the owner lands back on after approving (or refusing) on Pinterest. */
function settingsUrl(ok: boolean, message?: string): string {
  const frontend = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  const params = new URLSearchParams({ pinterest: ok ? 'connected' : 'failed' });
  if (message) params.set('reason', message.slice(0, 200));
  return `${frontend}/settings?${params.toString()}`;
}

@Controller('pinterest')
export class PinterestController {
  constructor(private readonly svc: PinterestService) {}

  /** Per-pin performance (30 days) + totals for the reports screen. */
  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  analytics(@Req() req: Request) {
    return this.svc.analytics((req.user as any).id);
  }

  /** The account's boards → the settings picker. The numeric board id the publish API
   *  needs is not visible anywhere in Pinterest's own UI. */
  @Get('boards')
  @UseGuards(JwtAuthGuard)
  boards(@Req() req: Request) {
    return this.svc.boards((req.user as any).id);
  }

  /** Step 1: where to send the owner to approve the connection. */
  @Get('connect')
  @UseGuards(JwtAuthGuard)
  connect(@Req() req: Request) {
    return this.svc.connectUrl((req.user as any).id);
  }

  /**
   * Step 2: Pinterest redirects the owner here with the authorization code.
   *
   * PUBLIC on purpose — the caller is Pinterest's redirect, which carries none of our
   * auth. The signed `state` is what identifies and authenticates the request (see
   * pinterest-oauth.ts). Always ends in a redirect back to the settings screen: this URL
   * is opened in the owner's browser, so a JSON error body would be the end of the road.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error || !code) {
      // The owner pressed "cancel" on Pinterest, or Pinterest refused outright.
      res.redirect(settingsUrl(false, error || 'no code'));
      return;
    }
    try {
      await this.svc.handleCallback(code, state);
      res.redirect(settingsUrl(true));
    } catch (err: any) {
      res.redirect(settingsUrl(false, err?.message || 'connection failed'));
    }
  }
}
