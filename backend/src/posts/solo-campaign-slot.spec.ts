import { soloCampaignSlot } from './solo-campaign-slot';

/**
 * The scenario these tests are built around is the real one: a Pinterest-only campaign on a
 * 12:00-23:00 New York window, driven by a cron every 2 hours in Israel time. New York's
 * window is Israel 19:00-06:00, so six of the twelve daily runs fire while it is CLOSED —
 * and every one of them resolved to the same opening minute.
 */
const H = 3600_000;
const NOW = Date.UTC(2026, 7, 17, 5, 0); // Israel 08:00 — window closed
const OPENING = Date.UTC(2026, 7, 17, 16, 0); // Israel 19:00 = New York 12:00
const CLOSE = Date.UTC(2026, 7, 18, 3, 0); // Israel 06:00 = New York 23:00

/** Stand-in for the real tz walk: anything past the close jumps to the next opening. */
const alignToWindow = (ms: number) => (ms > CLOSE ? OPENING + 24 * H : Math.max(ms, OPENING));

const call = (over: Partial<Parameters<typeof soloCampaignSlot>[0]> = {}) => soloCampaignSlot({
  baseMs: OPENING,
  furthestBookedMs: null,
  gapMs: 2 * H,
  cycleEndMs: NOW + 2 * H,
  fromScheduler: true,
  alignToWindow,
  ...over,
});

describe('soloCampaignSlot', () => {
  it('books the window opening when nothing is waiting', () => {
    // A campaign whose cron never fires inside its own window must still publish — this is
    // the branch that keeps it from going silent forever.
    expect(call()).toEqual({ slotMs: OPENING, skip: false });
  });

  it('never stacks a second post onto the same opening minute', () => {
    // THE bug: six closed-window runs each booked OPENING. Now the second one is pushed a
    // full cron interval past what is already booked.
    const { slotMs } = call({ furthestBookedMs: OPENING, fromScheduler: false });
    expect(slotMs).toBe(OPENING + 2 * H);
  });

  it('skips a scheduler run whose turn lands past the next cron fire', () => {
    // Nothing is lost: that run will place its own post. Queueing every one instead grows a
    // backlog the window can never drain.
    expect(call({ furthestBookedMs: OPENING }).skip).toBe(true);
  });

  it('never skips a manual run — the owner pressed the button', () => {
    expect(call({ furthestBookedMs: OPENING, fromScheduler: false }).skip).toBe(false);
  });

  it('takes the later of the window opening and the spacing', () => {
    // Window already open (base ~now) but a post is booked two hours out: spacing wins.
    const booked = OPENING + 5 * H;
    expect(call({ baseMs: OPENING, furthestBookedMs: booked, cycleEndMs: null }).slotMs)
      .toBe(booked + 2 * H);
  });

  it('walks a slot that overflows the window into the next opening', () => {
    expect(call({ furthestBookedMs: CLOSE, cycleEndMs: null }).slotMs).toBe(OPENING + 24 * H);
  });

  it('keeps a minimum minute of spacing even with a broken cron', () => {
    expect(call({ furthestBookedMs: OPENING + H, gapMs: 0, cycleEndMs: null }).slotMs)
      .toBe(OPENING + H + 60_000);
  });

  it('cannot skip when the cron is unparseable — there is no next fire to defer to', () => {
    expect(call({ furthestBookedMs: OPENING, cycleEndMs: null }).skip).toBe(false);
  });
});
