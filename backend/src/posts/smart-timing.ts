/**
 * Nudging a post's slot into its group's golden hours.
 *
 * The pacing machinery (nextGroupSlot) decides WHEN the group is free; this module decides
 * only whether that free slot should slide a little later, into an hour the group's
 * audience actually clicks. The rules keep it a NUDGE, not a rewrite:
 *
 *  - Never earlier. A snapped slot is always ≥ the natural slot, so it can never collide
 *    with the interval chain (the caller stores the snapped time as the next anchor, and
 *    gaps only ever grow).
 *  - Bounded. At most MAX_SNAP_DELAY_MS later. If no golden hour starts within that range,
 *    the natural slot stands — a group must never fall silent for half a day because its
 *    audience clicks at night.
 *  - Opt-in per group, enforced by the caller: this function runs only for groups whose
 *    owner turned smart timing on.
 */

export const MAX_SNAP_DELAY_MS = 3 * 3600_000;
export const SNAP_STEP_MS = 5 * 60_000;

/** The hour-of-day (0–23) of `d` in `tz` — the audience's clock, not the server's. */
export function hourInTz(d: Date, tz = 'Asia/Jerusalem'): number {
  const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: tz })
    .format(d);
  return Number(h) % 24;
}

/**
 * The slot itself when it already falls in a golden hour; otherwise the first moment
 * (scanning forward in 5-minute steps, up to the cap) whose local hour is golden; the
 * original slot when no golden hour is reachable in range.
 */
export function snapToHotHour(slot: Date, goldenHours: number[], tz = 'Asia/Jerusalem'): Date {
  const golden = new Set((goldenHours || []).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23));
  if (!golden.size) return slot;
  if (golden.has(hourInTz(slot, tz))) return slot;
  const start = slot.getTime();
  for (let ms = start + SNAP_STEP_MS; ms <= start + MAX_SNAP_DELAY_MS; ms += SNAP_STEP_MS) {
    const t = new Date(ms);
    if (golden.has(hourInTz(t, tz))) return t;
  }
  return slot;
}
