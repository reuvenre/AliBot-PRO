import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptimizerService } from './optimizer.service';

/** The learning engine's own screen: what it changed, why, and how to take it back. */
@Controller('optimizer')
@UseGuards(JwtAuthGuard)
export class OptimizerController {
  constructor(private readonly optimizer: OptimizerService) {}

  /**
   * Run the optimizer now and return the digest. Same pass as the scheduled one — including
   * the retire/boost actions and the email — so what you see here is exactly what tomorrow
   * morning would have produced, rather than a preview that might diverge from it.
   */
  @Post('run')
  @HttpCode(200)
  run(@Req() req: Request) {
    return this.optimizer.runForUser((req.user as any).id);
  }

  /** Every change the engine made lately, newest first, each flagged undoable or not. */
  @Get('actions')
  actions(@Req() req: Request, @Query('days') days?: string) {
    const window = Math.min(Math.max(Number(days) || 7, 1), 90);
    return this.optimizer.recentActions((req.user as any).id, window);
  }

  /** Put one change back. The engine acts on its own authority; this is the other half. */
  @Post('actions/undo')
  @HttpCode(200)
  undo(@Req() req: Request, @Body() body: { id?: string }) {
    return this.optimizer.undoAction((req.user as any).id, String(body?.id || ''));
  }

  /** The full report behind the last brief — the evidence, on request. */
  @Get('detail')
  async detail(@Req() req: Request, @Query('run_id') runId?: string) {
    const text = await this.optimizer.lastRunDetail((req.user as any).id, runId || null);
    return { detail: text };
  }
}
