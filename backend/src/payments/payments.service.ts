import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSession } from './payment-session.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { CREDIT_PACKS, BillingCycle } from '../subscription/plans.const';
import { createPaymentProvider, PaymentProvider } from './payment-provider';

export interface CheckoutInput {
  kind?: 'subscription' | 'credit_pack';
  planId?: string;
  billing?: BillingCycle;
  packId?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly provider: PaymentProvider = createPaymentProvider();

  constructor(
    @InjectRepository(PaymentSession) private readonly sessions: Repository<PaymentSession>,
    private readonly subscription: SubscriptionService,
  ) {}

  /** Which provider is live (the frontend decides checkout vs. manual-request UX). */
  get providerName(): string {
    return this.provider.name;
  }

  /**
   * Create a checkout session with a SERVER-COMPUTED amount and return the redirect URL.
   * The amount is never taken from the client, so a tampered price can't reach the gateway.
   */
  async createCheckout(userId: string, input: CheckoutInput) {
    const kind = input.kind === 'credit_pack' ? 'credit_pack' : 'subscription';

    let amount: number;
    let plan: string | null = null;
    let billing: BillingCycle = 'monthly';
    let packId: string | null = null;

    if (kind === 'subscription') {
      const quote = await this.subscription.quote(input.planId || '', input.billing || 'monthly');
      amount = quote.price;
      plan = quote.plan.id;
      billing = quote.billing;
      if (amount <= 0) throw new BadRequestException('התוכנית הזו אינה בתשלום');
    } else {
      const pack = CREDIT_PACKS.find((p) => p.id === input.packId);
      if (!pack) throw new BadRequestException('חבילת קרדיטים לא מוכרת');
      amount = pack.price;
      packId = pack.id;
    }

    const session = await this.sessions.save(this.sessions.create({
      user_id: userId, provider: this.provider.name, kind, plan, billing, pack_id: packId,
      amount, currency: 'ILS', status: 'pending',
    }));

    // No live gateway → don't fabricate a checkout; report pending so the UI shows the
    // manual-activation state (the subscription upgrade-request email path handles notify).
    if (this.provider.name === 'none') {
      return { status: 'pending' as const, session_id: session.id, amount };
    }
    return { status: 'checkout' as const, session_id: session.id, amount, url: this.provider.buildCheckoutUrl(session) };
  }

  /**
   * Handle a provider webhook: verify the signature, then apply the purchase EXACTLY ONCE.
   * Idempotent — a replayed webhook (same session already paid, or a duplicate external_ref)
   * is a no-op.
   */
  async handleWebhook(rawBody: Buffer, headers: Record<string, any>) {
    const evt = this.provider.verifyWebhook(rawBody, headers); // throws on a bad signature

    const session = await this.sessions.findOne({ where: { id: evt.sessionId } });
    if (!session) throw new NotFoundException('Unknown checkout session');
    if (session.status === 'paid') return { ok: true, duplicate: true };

    if (evt.status !== 'paid') {
      session.status = 'failed';
      await this.sessions.save(session).catch(() => {});
      return { ok: true, status: 'failed' };
    }

    // Optional amount sanity check — never grant a plan for an underpayment.
    if (evt.amount != null && Number(evt.amount) + 0.01 < session.amount) {
      this.logger.warn(`session ${session.id}: paid ${evt.amount} < expected ${session.amount} — rejecting`);
      session.status = 'failed';
      await this.sessions.save(session).catch(() => {});
      throw new BadRequestException('Amount mismatch');
    }

    // ATOMICALLY claim the session (pending → paid) in ONE statement BEFORE granting. Two
    // simultaneous deliveries of the same webhook would otherwise both read 'pending' and
    // both apply the purchase (double credits on a pack). Only the row that flips pending→paid
    // here proceeds to grant; a concurrent duplicate gets affected=0 and is a no-op.
    const claim = await this.sessions.createQueryBuilder()
      .update(PaymentSession)
      .set({ status: 'paid', external_ref: evt.externalRef, paid_at: () => 'NOW()' })
      .where('id = :id AND status = :pending', { id: session.id, pending: 'pending' })
      .execute();
    if (!claim.affected) return { ok: true, duplicate: true };

    // We won the claim — apply the purchase exactly once. (If a grant throws here the session
    // is already 'paid' but ungranted — logged loudly for manual reconciliation; far rarer and
    // safer than a double grant.)
    try {
      if (session.kind === 'credit_pack') {
        const pack = CREDIT_PACKS.find((p) => p.id === session.pack_id);
        if (pack) await this.subscription.addCredits(session.user_id, pack.credits);
      } else if (session.plan) {
        await this.subscription.setPlanForUser(session.user_id, session.plan, session.billing as BillingCycle);
      }
    } catch (err: any) {
      this.logger.error(`session ${session.id} claimed paid but grant FAILED — reconcile manually: ${err?.message}`);
      throw err;
    }
    this.logger.log(`payment applied: session ${session.id} (${session.kind} ${session.plan || session.pack_id}) user ${session.user_id}`);
    return { ok: true };
  }
}
