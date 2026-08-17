/**
 * Where the NEXT post of a campaign that paces itself should land.
 *
 * A campaign publishing to a Telegram group inherits that group's one-per-interval pacing,
 * and nextGroupSlot keeps two campaigns from colliding on it. A platform-filtered campaign
 * (Pinterest-only, Instagram-only) has no group to pace against — so it took the raw
 * "first moment inside the send window" and booked THAT, with no idea what it had already
 * booked.
 *
 * That is harmless while the window is open (the first moment is ~now) and badly wrong
 * while it is closed: every run that fires outside the window resolves to the SAME opening
 * moment. A Pinterest campaign on a New York window, driven by a cron in Israel time, fires
 * six times while New York sleeps — and booked all six pins onto the same minute, which is
 * both a spam signal and a wasted window.
 *
 * So the slot is pushed off whatever this campaign has already booked, by its own cron
 * interval, and a run whose turn lands beyond the next cron fire is SKIPPED rather than
 * queued: the next in-window run will produce a fresh post anyway, and queueing them all
 * would grow a backlog the window can never drain. The skip is conditional on something
 * already being booked, so a campaign whose cron NEVER fires inside its window still gets
 * its one post placed at the opening instead of going silent forever.
 */

export interface SoloSlotInput {
  /** windowSlots' answer: the first moment inside the send window (ms). */
  baseMs: number;
  /** The furthest-out post this campaign already has waiting (ms), or null when none. */
  furthestBookedMs: number | null;
  /** Minimum spacing between this campaign's own posts (ms). */
  gapMs: number;
  /** When this campaign's cron fires again (ms), or null when unparseable. */
  cycleEndMs: number | null;
  /** Scheduler runs may skip; a manual "run now" must always produce something. */
  fromScheduler: boolean;
  /** Walks a moment forward into the send window. Injected — the tz math lives elsewhere. */
  alignToWindow: (ms: number) => number;
}

export function soloCampaignSlot(input: SoloSlotInput): { slotMs: number; skip: boolean } {
  const { baseMs, furthestBookedMs, gapMs, cycleEndMs, fromScheduler, alignToWindow } = input;

  // Nothing waiting → today's behaviour exactly: take the window's first moment.
  if (!furthestBookedMs) return { slotMs: baseMs, skip: false };

  const afterLast = furthestBookedMs + Math.max(gapMs, 60_000);
  // The gap may push the slot past the window's end; alignToWindow walks it to the next
  // opening, which is where it genuinely belongs.
  const slotMs = alignToWindow(Math.max(baseMs, afterLast));

  // Booked beyond the next cron fire: that run will place its own post, so this one has
  // nothing to add. Only the scheduler skips — a manual run must always do something.
  if (fromScheduler && cycleEndMs && slotMs > cycleEndMs) return { slotMs, skip: true };
  return { slotMs, skip: false };
}
