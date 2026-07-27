import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { PaymentSession } from './payment-session.entity';
import { PaymentsService } from './payments.service';
import { SubscriptionService } from '../subscription/subscription.service';

describe('PaymentsService.handleWebhook', () => {
  let service: PaymentsService;
  let sessions: any;
  let subscription: any;

  const raw = Buffer.from('{}');

  async function build(fakeEvent: any) {
    sessions = { findOne: jest.fn(), save: jest.fn((s) => Promise.resolve(s)), create: jest.fn((x) => x) };
    subscription = { setPlanForUser: jest.fn().mockResolvedValue(undefined), addCredits: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(PaymentSession), useValue: sessions },
        { provide: SubscriptionService, useValue: subscription },
      ],
    }).compile();
    service = module.get(PaymentsService);
    // Override the env-selected provider with a controllable stub.
    (service as any).provider = { name: 'test', buildCheckoutUrl: () => '', verifyWebhook: () => fakeEvent };
  }

  it('applies a paid subscription exactly once', async () => {
    await build({ sessionId: 's1', externalRef: 'tx1', status: 'paid', amount: 150 });
    sessions.findOne.mockResolvedValue({ id: 's1', status: 'pending', kind: 'subscription', plan: 'growth', billing: 'monthly', amount: 150, user_id: 'u' });
    const res = await service.handleWebhook(raw, {});
    expect(subscription.setPlanForUser).toHaveBeenCalledWith('u', 'growth', 'monthly');
    expect(res).toEqual({ ok: true });
  });

  it('is idempotent — an already-paid session is a no-op', async () => {
    await build({ sessionId: 's1', externalRef: 'tx1', status: 'paid' });
    sessions.findOne.mockResolvedValue({ id: 's1', status: 'paid', kind: 'subscription', plan: 'growth' });
    const res = await service.handleWebhook(raw, {});
    expect(subscription.setPlanForUser).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, duplicate: true });
  });

  it('rejects an underpayment (amount mismatch)', async () => {
    await build({ sessionId: 's1', externalRef: 'tx1', status: 'paid', amount: 1 });
    sessions.findOne.mockResolvedValue({ id: 's1', status: 'pending', kind: 'subscription', plan: 'scale', billing: 'monthly', amount: 449, user_id: 'u' });
    await expect(service.handleWebhook(raw, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(subscription.setPlanForUser).not.toHaveBeenCalled();
  });

  it('credits a paid credit-pack purchase', async () => {
    await build({ sessionId: 's2', externalRef: 'tx2', status: 'paid' });
    sessions.findOne.mockResolvedValue({ id: 's2', status: 'pending', kind: 'credit_pack', pack_id: 'pack_5k', amount: 59, user_id: 'u' });
    await service.handleWebhook(raw, {});
    expect(subscription.addCredits).toHaveBeenCalledWith('u', 5000);
  });

  it('marks a failed payment without granting anything', async () => {
    await build({ sessionId: 's1', externalRef: 'tx1', status: 'failed' });
    sessions.findOne.mockResolvedValue({ id: 's1', status: 'pending', kind: 'subscription', plan: 'growth', amount: 150, user_id: 'u' });
    const res = await service.handleWebhook(raw, {});
    expect(subscription.setPlanForUser).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, status: 'failed' });
  });
});
