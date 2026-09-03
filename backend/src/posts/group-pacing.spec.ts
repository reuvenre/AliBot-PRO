import { DEFAULT_INTERVAL_MIN, occupiesCurrentInterval, pacingIntervalMinutes } from './group-pacing';

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

/**
 * The complaint: "הגדרתי את הטייס של טקטי לכל חצי שעה ועדיין הוא מפרסם כל שעה."
 *
 * A campaign publishing to a Telegram group is paced by the GROUP's interval, not by its
 * own cron — that part is deliberate, it is what stops two campaigns sharing a group from
 * colliding. What was broken is which interval the group was read as having: the group's
 * own field is empty by default and the groups screen calls that state "גלובלי", but the
 * resolution fell straight through to a hardcoded hour and never consulted the account. So
 * lowering the interval in Settings moved the queue and left campaign pacing at 60.
 */
describe('pacingIntervalMinutes', () => {
  it('uses the account interval when the group inherits ("גלובלי")', () => {
    expect(pacingIntervalMinutes(null, 30)).toBe(30);
    expect(pacingIntervalMinutes(undefined, 15)).toBe(15);
  });

  it('lets a group override the account', () => {
    expect(pacingIntervalMinutes(30, 60)).toBe(30);
    expect(pacingIntervalMinutes(120, 30)).toBe(120);
  });

  it('falls back to an hour only when nothing is configured anywhere', () => {
    expect(pacingIntervalMinutes(null, null)).toBe(DEFAULT_INTERVAL_MIN);
    expect(pacingIntervalMinutes(undefined, undefined)).toBe(60);
  });

  it('ignores a nonsense value instead of pacing on it', () => {
    // A 0 would make every run "outside the interval" and turn the group into a firehose;
    // NaN would make every comparison false, which is the same thing.
    expect(pacingIntervalMinutes(0, 30)).toBe(30);
    expect(pacingIntervalMinutes(-5, null)).toBe(60);
    expect(pacingIntervalMinutes(NaN, 30)).toBe(30);
  });

  it('is what makes a half-hourly campaign actually publish half-hourly', () => {
    // The gate the campaign run passes through. At a resolved 30 minutes the second run of
    // the hour gets through; at the old hardcoded 60 it was skipped, every time.
    const slot = new Date('2026-09-03T10:00:00Z').getTime();
    const halfPast = new Date('2026-09-03T10:30:00Z').getTime();
    expect(occupiesCurrentInterval(slot, halfPast, pacingIntervalMinutes(null, 30))).toBe(false);
    expect(occupiesCurrentInterval(slot, halfPast, pacingIntervalMinutes(null, null))).toBe(true);
  });
});
