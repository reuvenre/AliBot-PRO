import { pendingVerdict } from './pending-posts';

describe('pendingVerdict', () => {
  const NOW = 1_755_000_000_000;

  it('calls a future slot BOOKED — the campaign is between runs, not stuck', () => {
    // The false positive this exists for: a campaign whose next post is queued for 23:00
    // is quiet by design, and raised a watchdog issue every night.
    expect(pendingVerdict(NOW + 3 * 3600_000, NOW)).toBe('booked');
  });

  it('calls a slot whose time has passed OVERDUE — that one really is stuck', () => {
    expect(pendingVerdict(NOW - 20 * 60_000, NOW)).toBe('overdue');
  });

  it('treats the exact due moment as overdue rather than booked', () => {
    // It should have gone out at that instant; "not yet" only means strictly later.
    expect(pendingVerdict(NOW, NOW)).toBe('overdue');
  });

  it('says nothing when the campaign has no pending post at all', () => {
    expect(pendingVerdict(0, NOW)).toBe('none');
    expect(pendingVerdict(null, NOW)).toBe('none');
    expect(pendingVerdict(undefined, NOW)).toBe('none');
  });
});
