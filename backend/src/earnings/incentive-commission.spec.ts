import { incentiveCommissionUsd } from './incentive-commission';

describe('incentiveCommissionUsd', () => {
  it('reads the documented field and converts cents to dollars', () => {
    // The feed's money fields are integer cents — 296 is $2.96, the figure beside a
    // 26.92 order in the portal.
    expect(incentiveCommissionUsd({ estimated_paid_incentive_commission: '296' }))
      .toEqual({ usd: 2.96, field: 'estimated_paid_incentive_commission' });
  });

  it('prefers the finished figure over the estimated one', () => {
    const res = incentiveCommissionUsd({
      estimated_finished_incentive_commission: '437',
      estimated_paid_incentive_commission: '400',
    });
    expect(res.usd).toBe(4.37);
    expect(res.field).toBe('estimated_finished_incentive_commission');
  });

  it('finds the figure under a spelling we have not seen', () => {
    // The gateway renames fields between versions — the sync already has to try several
    // spellings for the payment time. Better to recognise the shape than to guess a name.
    expect(incentiveCommissionUsd({ incentive_commission_amount: '150' }).usd).toBe(1.5);
  });

  it('never reads a RATE as money — 11% is not $0.11', () => {
    expect(incentiveCommissionUsd({ incentive_rate: '11' })).toEqual({ usd: 0, field: null });
    expect(incentiveCommissionUsd({ incentive_commission_percent: '11' })).toEqual({ usd: 0, field: null });
  });

  it('reports no bonus as a plain zero — that is the normal case, not a failure', () => {
    expect(incentiveCommissionUsd({ estimated_paid_commission: '484' }))
      .toEqual({ usd: 0, field: null });
  });

  it('survives junk instead of throwing inside the sync loop', () => {
    expect(incentiveCommissionUsd(null)).toEqual({ usd: 0, field: null });
    expect(incentiveCommissionUsd({ incentive_commission: 'abc' })).toEqual({ usd: 0, field: null });
    expect(incentiveCommissionUsd({ incentive_commission: '-50' })).toEqual({ usd: 0, field: null });
  });
});
