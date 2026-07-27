import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService, CheckoutInput } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  private uid(req: Request) { return (req.user as any).id; }

  /** Which gateway is live — the UI uses this to show "Pay now" vs. "Request upgrade". */
  @Get('provider')
  provider() {
    return { provider: this.payments.providerName };
  }

  /** Create a checkout session (server-computed amount) and return the redirect URL. */
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(@Req() req: Request, @Body() body: CheckoutInput) {
    return this.payments.createCheckout(this.uid(req), body || {});
  }

  /**
   * Provider webhook — PUBLIC by design (the gateway has no JWT). Security is the signature
   * verified inside handleWebhook against the RAW body, so we read req.rawBody (enabled via
   * NestFactory rawBody:true), not the parsed body.
   */
  @Post('webhook/:provider')
  webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.payments.handleWebhook(raw, req.headers as Record<string, any>);
  }
}
