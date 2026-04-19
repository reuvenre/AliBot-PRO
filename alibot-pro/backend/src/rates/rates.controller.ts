import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RatesService } from './rates.service';

@Controller('rates')
@UseGuards(JwtAuthGuard)
export class RatesController {
  constructor(private readonly svc: RatesService) {}

  @Get()
  get() {
    return this.svc.getRates();
  }
}
