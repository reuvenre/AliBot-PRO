import { occupiesCurrentInterval } from './group-pacing';

const MIN = 60_000;
const now = Date.UTC(2026, 7, 11, 11, 0, 0); // 11:00, an hourly campaign's run

describe('occupiesCurrentInterval', () => {
  it('a post from this interval still occupies it', () => {
    expect(occupiesCurrentInterval(now - 30 * MIN, now, 60)).toBe(true);
  });

  it('a full interval later, the group is free again', () => {
    expect(occupiesCurrentInterval(now - 60 * MIN, now, 60)).toBe(false);
  });

  it('the grace absorbs cron jitter — a run firing seconds early is not blocked', () => {
    // Slot 10:00, run fires at 10:59:57 → 59.95 minutes, just under a full interval.
    expect(occupiesCurrentInterval(now - 60 * MIN + 3_000, now, 60)).toBe(false);
  });

  it('THE REGRESSION: a slow send does not steal the next interval', () => {
    // The 10:00 post finished uploading at 10:12 (AI images + album). Anchored on the SLOT
    // the 11:00 run is free; anchored on the send time it would read as busy and skip,
    // which is what halved the campaign's cadence to ~122 minutes.
    const slot = now - 60 * MIN;
    const actualSend = now - 48 * MIN;
    expect(occupiesCurrentInterval(slot, now, 60)).toBe(false);
    expect(occupiesCurrentInterval(actualSend, now, 60)).toBe(true); // the old, wrong input
  });

  it('scales with the group interval', () => {
    expect(occupiesCurrentInterval(now - 90 * MIN, now, 120)).toBe(true);
    expect(occupiesCurrentInterval(now - 120 * MIN, now, 120)).toBe(false);
  });

  it('no anchor means nothing occupies the interval', () => {
    expect(occupiesCurrentInterval(0, now, 60)).toBe(false);
  });
});
