/**
 * The BONUS AliExpress actually paid on an order, read from the order feed itself.
 *
 * Until now the system decided "is this a bonus order?" by matching the order's keyword
 * against the pool's keyword list. AliExpress decides it by the product's CATEGORY, so the
 * two disagree constantly: an order with no attributed post carries no keyword at all and
 * could never count, and an attributed one only counted when our search phrase happened to
 * be literally in the pool's list — while the bonus is paid across the whole category,
 * including products found through other phrases. The owner saw many double-commission
 * orders in the portal against a much smaller count here.
 *
 * The order feed carries the figure, so the guess is unnecessary. The exact field name
 * varies across gateway versions (the sync already has to try several spellings for the
 * payment time), so rather than pin one name this reads any field whose name says
 * "incentive commission" — and reports what it found, so the real shape is learned from
 * live data instead of assumed.
 */

/** Money in this feed arrives as integer CENTS of the settled currency. */
function centsToUsd(raw: unknown): number {
  const n = parseFloat(String(raw ?? ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return +(n / 100).toFixed(2);
}

/** Names seen in the docs/portal, tried first so the common case costs one lookup. */
const KNOWN_FIELDS = [
  'estimated_finished_incentive_commission',
  'estimated_paid_incentive_commission',
  'incentive_commission',
  'finished_incentive_commission',
  'paid_incentive_commission',
];

/**
 * The order's incentive (bonus) commission in USD, and which field carried it.
 *
 * Returns 0 with `field: null` when the order has none — that is the normal case for a
 * product outside every registered pool, and it must never be confused with "we could not
 * read it". A caller that wants to know whether the FEED carries the figure at all should
 * look at `field` across many orders, not at a single zero.
 */
export function incentiveCommissionUsd(order: any): { usd: number; field: string | null } {
  if (!order || typeof order !== 'object') return { usd: 0, field: null };

  for (const name of KNOWN_FIELDS) {
    if (order[name] !== undefined) {
      const usd = centsToUsd(order[name]);
      if (usd > 0) return { usd, field: name };
    }
  }

  // Unknown spelling: take any field that names itself an incentive/bonus commission.
  // Rates ("incentive_rate", "..._percent") are deliberately excluded — a percentage
  // parsed as cents would invent money.
  for (const [name, value] of Object.entries(order)) {
    if (!/incentive|bonus/i.test(name)) continue;
    if (!/commission|amount/i.test(name)) continue;
    if (/rate|percent|ratio/i.test(name)) continue;
    const usd = centsToUsd(value);
    if (usd > 0) return { usd, field: name };
  }

  return { usd: 0, field: null };
}
