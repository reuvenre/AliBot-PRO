import { manualQueueTurn } from './queue-fairness';

describe('manualQueueTurn', () => {
  const base = { waiting: 7, dripEnabled: true, lastSentCampaignId: 'camp-1', hasSentAny: true };

  it('gives the queue the slot after a campaign send — the starvation this exists to end', () => {
    // The observed bug: campaigns booked every interval, seven queued posts slid an hour
    // forward each hour and never published.
    expect(manualQueueTurn(base)).toBe(true);
  });

  it('gives campaigns the slot after a manual send — alternation, not takeover', () => {
    // Seven waiting posts must not silence the autopilot for seven hours.
    expect(manualQueueTurn({ ...base, lastSentCampaignId: null })).toBe(false);
    expect(manualQueueTurn({ ...base, lastSentCampaignId: '' })).toBe(false);
  });

  it('never yields to an empty queue', () => {
    expect(manualQueueTurn({ ...base, waiting: 0 })).toBe(false);
  });

  it('never yields to a drip that cannot fire — a paused queue must not silence the group', () => {
    expect(manualQueueTurn({ ...base, dripEnabled: false })).toBe(false);
  });

  it('lets the queue open a group that has never sent', () => {
    expect(manualQueueTurn({ ...base, hasSentAny: false, lastSentCampaignId: undefined })).toBe(true);
  });
});
