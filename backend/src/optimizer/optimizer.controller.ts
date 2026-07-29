import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptimizerService } from './optimizer.service';

/** Manual trigger for the learning optimizer (the nightly cron does the same work). */
@Controller('optimizer')
@UseGuards(JwtAuthGuard)
export class OptimizerController {
  constructor(private readonly optimizer: OptimizerService) {}

  /**
   * Run the optimizer now and return the digest. Same pass as the 03:15 cron — including
   * the retire/boost actions and the email — so what you see here is exactly what tomorrow
   * morning would have produced, rather than a preview that might diverge from it.
   */
  @Post('run')
  @HttpCode(200)
  run(@Req() req: Request) {
    return this.optimizer.runForUser((req.user as any).id);
  }
}
