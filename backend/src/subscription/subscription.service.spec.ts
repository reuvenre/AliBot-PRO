import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { PromotionsService } from '../promotions/promotions.service';
import { SubscriptionService } from './subscription.service';

const future = new Date(Date.now() + 30 * 86_400_000);

function makeQb(affected: number) {
  const qb: any = {};
  qb.update = () => qb;
  qb.set = () => qb;
  qb.where = () => qb;
  qb.execute = jest.fn().mockResolvedValue({ affected });
  return qb;
}

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let users: any;

  async function build(qbAffected = 1) {
    users = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => makeQb(qbAffected)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: MailService, useValue: { isConfigured: () => false, sendHtml: jest.fn() } },
        { provide: PromotionsService, useValue: { active: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    service = module.get(SubscriptionService);
  }

  describe('tryConsume', () => {
    it('admins never consume (returns true, no decrement)', async () => {
      await build(0); // even if the UPDATE would affect 0 rows, admin short-circuits
      users.findOne.mockResolvedValue({ id: 'a', role: 'admin', plan_renews_at: future, subscription_plan: 'scale' });
      expect(await service.tryConsume('a', 10, 'publish')).toBe(true);
      expect(users.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns false when the balance does not cover the cost', async () => {
      await build(0); // atomic UPDATE affects 0 rows → insufficient
      users.findOne.mockResolvedValue({ id: 'u', role: 'user', plan_renews_at: future, subscription_plan: 'free', credits_remaining: 3 });
      expect(await service.tryConsume('u', 10, 'publish')).toBe(false);
    });

    it('returns true when the balance covers the cost', async () => {
      await build(1);
      users.findOne.mockResolvedValue({ id: 'u', role: 'user', plan_renews_at: future, subscription_plan: 'growth', credits_remaining: 500 });
      expect(await service.tryConsume('u', 10, 'publish')).toBe(true);
    });
  });

  describe('refund', () => {
    it('is a no-op for admins', async () => {
      await build();
      users.findOne.mockResolvedValue({ id: 'a', role: 'admin' });
      await service.refund('a', 10, 'publish-failed');
      expect(users.increment).not.toHaveBeenCalled();
    });

    it('credits a normal user back', async () => {
      await build();
      users.findOne.mockResolvedValue({ id: 'u', role: 'user' });
      await service.refund('u', 10, 'publish-failed');
      expect(users.increment).toHaveBeenCalledWith({ id: 'u' }, 'credits_remaining', 10);
    });

    it('ignores non-positive amounts', async () => {
      await build();
      await service.refund('u', 0, 'x');
      expect(users.findOne).not.toHaveBeenCalled();
    });
  });

  describe('setPlanForUser', () => {
    it('keeps the higher of current balance vs new plan quota (no wipe)', async () => {
      await build();
      // current balance (6000) exceeds growth's quota (5000) → must not be reduced
      users.findOne.mockResolvedValue({ id: 'u', role: 'user', plan_renews_at: future, subscription_plan: 'growth', credits_remaining: 6000 });
      await service.setPlanForUser('u', 'growth');
      const arg = users.update.mock.calls[0][1];
      expect(arg.credits_remaining).toBe(6000);
      expect(arg.subscription_plan).toBe('growth');
    });
  });

  describe('allows', () => {
    it('fails CLOSED on a DB error (does not grant paid features)', async () => {
      await build();
      users.findOne.mockRejectedValue(new Error('db down'));
      expect(await service.allows('u', 'platform_facebook')).toBe(false);
    });

    it('admins bypass all gates', async () => {
      await build();
      users.findOne.mockResolvedValue({ id: 'a', role: 'admin', subscription_plan: 'free' });
      expect(await service.allows('a', 'token_tracking')).toBe(true);
    });
  });
});
