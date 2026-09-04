import {
  DEFAULT_PLAN, PLANS, TRIAL_DAYS, effectivePlan, planAllows, planOf, trialDaysLeft, trialEndsAt,
} from './plans.const';

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

/**
 * The free trial. It lifts FEATURE gates and nothing else — see TRIAL_DAYS for why. That
 * asymmetry is the whole design: credits and group count stay on the real plan, so a lapsed
 * trial needs no cleanup and can take nothing away that the user was relying on.
 */
describe('effectivePlan', () => {
  const NOW = new Date('2026-09-04T12:00:00Z');
  const future = new Date('2026-09-10T12:00:00Z');
  const past = new Date('2026-09-01T12:00:00Z');

  it('gates a trialling free account at the trial tier', () => {
    expect(effectivePlan('free', future, NOW)).toBe('autopilot');
    expect(planAllows(effectivePlan('free', future, NOW), 'ai_agents')).toBe(true);
    expect(planAllows(effectivePlan('free', future, NOW), 'platform_instagram')).toBe(true);
  });

  it('closes the gates again the moment the trial lapses', () => {
    expect(effectivePlan('free', past, NOW)).toBe('free');
    expect(planAllows(effectivePlan('free', past, NOW), 'ai_agents')).toBe(false);
  });

  it('never DEMOTES a paying customer inside their own trial window', () => {
    // A Scale account signing up today has a trial too; reading it as "autopilot" would
    // quietly switch off the two features Scale alone pays for.
    expect(effectivePlan('scale', future, NOW)).toBe('scale');
    expect(planAllows(effectivePlan('scale', future, NOW), 'paid_boost')).toBe(true);
  });

  it('treats a missing or unreadable trial as no trial', () => {
    expect(effectivePlan('free', null, NOW)).toBe('free');
    expect(effectivePlan('free', undefined, NOW)).toBe('free');
    expect(effectivePlan('free', 'not a date' as any, NOW)).toBe('free');
  });

  it('reads a stored ISO string, which is what the DB hands back', () => {
    expect(effectivePlan('free', future.toISOString(), NOW)).toBe('autopilot');
  });

  it('does not touch credits or group count — those stay on the real plan', () => {
    // Stated as a test because it is the property that makes expiry free of cleanup.
    expect(planOf('free').monthly_credits).toBe(450);
    expect(planOf('free').max_groups).toBe(1);
  });
});

describe('trialDaysLeft', () => {
  const NOW = new Date('2026-09-04T12:00:00Z');

  it('counts the days a banner should show', () => {
    expect(trialDaysLeft(new Date('2026-09-18T12:00:00Z'), NOW)).toBe(14);
    expect(trialDaysLeft(new Date('2026-09-05T12:00:00Z'), NOW)).toBe(1);
  });

  it('rounds UP inside the final day', () => {
    // "נותרו 0 ימים" on the last afternoon reads as already over, and the user stops
    // trying the thing we want them to try.
    expect(trialDaysLeft(new Date('2026-09-04T23:00:00Z'), NOW)).toBe(1);
  });

  it('is zero once it has passed, and for no trial at all', () => {
    expect(trialDaysLeft(new Date('2026-09-04T11:59:00Z'), NOW)).toBe(0);
    expect(trialDaysLeft(null, NOW)).toBe(0);
  });
});

describe('trialEndsAt', () => {
  it('lands exactly TRIAL_DAYS out', () => {
    const from = new Date('2026-09-04T12:00:00Z');
    expect(trialEndsAt(from).toISOString()).toBe('2026-09-18T12:00:00.000Z');
    expect(trialDaysLeft(trialEndsAt(from), from)).toBe(TRIAL_DAYS);
  });
});
