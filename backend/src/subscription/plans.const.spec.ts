import { DEFAULT_PLAN, PLANS, planAllows, planOf } from './plans.const';

describe('plans.const feature gating', () => {
  it('defaults new users to the free tier', () => {
    expect(DEFAULT_PLAN).toBe('free');
    expect(PLANS.free.price_monthly).toBe(0);
  });

  it('free tier allows only Telegram + AliExpress, nothing paid', () => {
    expect(planAllows('free', 'platform_telegram')).toBe(true);
    expect(planAllows('free', 'source_aliexpress')).toBe(true);
    expect(planAllows('free', 'platform_facebook')).toBe(false);
    expect(planAllows('free', 'sales_recovery')).toBe(false);
    expect(planAllows('free', 'image_enhancer')).toBe(false);
    expect(planAllows('free', 'token_tracking')).toBe(false);
  });

  it('gating is cumulative up the tiers', () => {
    // image_enhancer unlocks at growth
    expect(planAllows('starter', 'image_enhancer')).toBe(false);
    expect(planAllows('growth', 'image_enhancer')).toBe(true);
    expect(planAllows('scale', 'image_enhancer')).toBe(true);
    // sales_recovery unlocks at autopilot
    expect(planAllows('growth', 'sales_recovery')).toBe(false);
    expect(planAllows('autopilot', 'sales_recovery')).toBe(true);
    // token_tracking is scale-only
    expect(planAllows('autopilot', 'token_tracking')).toBe(false);
    expect(planAllows('scale', 'token_tracking')).toBe(true);
  });

  it('unknown / null plan falls back to the default plan', () => {
    expect(planOf(null).id).toBe(DEFAULT_PLAN);
    expect(planOf('nonsense').id).toBe(DEFAULT_PLAN);
    // ...and the default (free) must not grant paid features
    expect(planAllows(undefined, 'platform_facebook')).toBe(false);
  });
});
