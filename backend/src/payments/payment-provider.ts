import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { PaymentSession } from './payment-session.entity';

/** A webhook normalized to the shape our service acts on, regardless of provider. */
export interface NormalizedWebhook {
  /** Our PaymentSession.id, echoed back by the provider (we pass it at checkout). */
  sessionId: string;
  /** The provider's own transaction id — used for idempotency. */
  externalRef: string;
  status: 'paid' | 'failed';
  /** Paid amount in whole shekels, when the provider reports it (for a sanity check). */
  amount?: number;
}

export interface PaymentProvider {
  readonly name: string;
  /** Hosted-checkout redirect URL for a freshly-created session. */
  buildCheckoutUrl(session: PaymentSession): string;
  /**
   * Verify the webhook's authenticity (signature/HMAC over the RAW body) and normalize it.
   * MUST throw if the signature is missing or invalid — this is the only thing standing
   * between the internet and setPlanForUser.
   */
  verifyWebhook(rawBody: Buffer, headers: Record<string, any>): NormalizedWebhook;
}

const FRONTEND = () => (process.env.FRONTEND_URL || '').split(',')[0].trim() || 'https://nexlify.win-solutions.co.il';

/**
 * Default provider when none is configured: there is NO live gateway. Checkout falls back to
 * a "pending — an admin will activate" page, and inbound webhooks are rejected. This keeps
 * the paywall un-bypassable until a real provider is wired.
 */
class NoopProvider implements PaymentProvider {
  readonly name = 'none';
  buildCheckoutUrl(session: PaymentSession): string {
    return `${FRONTEND()}/settings?checkout=pending&session=${session.id}`;
  }
  verifyWebhook(): NormalizedWebhook {
    throw new BadRequestException('No payment provider configured');
  }
}

/**
 * Skeleton adapter for Grow (משולם) / a generic HMAC-signed provider. The checkout URL and
 * signature scheme below follow the COMMON pattern (sum + description + our session id as a
 * custom field, success/cancel URLs; HMAC-SHA256 over the raw body with a shared secret).
 * Align the field names + signature header with the provider's docs before going live, then
 * set PAYMENT_PROVIDER=grow, PAYMENT_CHECKOUT_URL and PAYMENT_WEBHOOK_SECRET.
 */
class GrowProvider implements PaymentProvider {
  readonly name = 'grow';

  buildCheckoutUrl(session: PaymentSession): string {
    const base = process.env.PAYMENT_CHECKOUT_URL;
    if (!base) throw new BadRequestException('PAYMENT_CHECKOUT_URL is not set');
    const q = new URLSearchParams({
      sum: String(session.amount),
      currency: session.currency,
      description: session.kind === 'credit_pack' ? `Nexlify credits ${session.pack_id}` : `Nexlify ${session.plan} (${session.billing})`,
      // Echoed back on the webhook so we can match the payment to this session.
      cField1: session.id,
      successUrl: `${FRONTEND()}/settings?checkout=success`,
      cancelUrl: `${FRONTEND()}/settings?checkout=cancel`,
    });
    return `${base}${base.includes('?') ? '&' : '?'}${q.toString()}`;
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, any>): NormalizedWebhook {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || '';
    if (!secret) throw new BadRequestException('PAYMENT_WEBHOOK_SECRET is not set');

    // HMAC-SHA256 over the exact raw body, compared in constant time. Adjust the header
    // name to the provider's (e.g. 'x-grow-signature').
    const provided = String(headers['x-payment-signature'] || headers['x-grow-signature'] || '');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let body: any = {};
    try { body = JSON.parse(rawBody.toString('utf8')); } catch { throw new BadRequestException('Bad webhook body'); }
    const sessionId = String(body.cField1 || body.custom || '');
    const externalRef = String(body.transactionId || body.asmachta || body.id || '');
    const paid = String(body.status || body.statusCode) === 'paid' || body.success === true || String(body.statusCode) === '2';
    if (!sessionId || !externalRef) throw new BadRequestException('Webhook missing session/txn id');
    return { sessionId, externalRef, status: paid ? 'paid' : 'failed', amount: Number(body.sum) || undefined };
  }
}

/** Resolve the configured provider (defaults to the no-gateway Noop). */
export function createPaymentProvider(): PaymentProvider {
  switch ((process.env.PAYMENT_PROVIDER || '').toLowerCase()) {
    case 'grow':
    case 'meshulam':
      return new GrowProvider();
    default:
      return new NoopProvider();
  }
}
