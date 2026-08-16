/**
 * Date-range boundaries on the SAME clock the AliExpress portal counts by.
 *
 * Every timestamp in this table came from AliExpress, which reports in platform time
 * (GMT+8) — and the orders screen already DISPLAYS them in that zone so the rows read
 * exactly like the portal. The month filter, though, was cutting the range on UTC
 * midnight, and the two clocks disagree for eight hours of every day.
 *
 * That is not a rounding detail: an order paid 2026-08-01 06:28 GMT+8 is stored as
 * 2026-07-31 22:28 UTC, so "August" excluded it while the portal counted it — the whole
 * "the portal says 67, the system says 66" gap, with nothing actually missing from the DB.
 * Cutting on GMT+8 midnight makes the count match the portal 1:1.
 */

/** AliExpress platform time. Fixed: China does not observe DST. */
export const PORTAL_UTC_OFFSET = '+08:00';

/** Start of `yyyy-mm-dd` in portal time, or null when no bound was given. */
export function portalRangeStart(from?: string | null): Date | null {
  const day = String(from || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T00:00:00.000${PORTAL_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** End of `yyyy-mm-dd` in portal time — inclusive of the whole day the owner picked. */
export function portalRangeEnd(to?: string | null): Date | null {
  const day = String(to || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T23:59:59.999${PORTAL_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}
