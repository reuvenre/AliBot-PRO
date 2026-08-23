/**
 * The morning report as the owner actually reads it: a glance, not a document.
 *
 * The long report told him the numbers, the reasoning, what was rejected and why, and then
 * a list of things HE should go do. Fifty lines that got skimmed. This builds the other
 * half of that trade: the day in two lines, what the engine CHANGED in a few more, and
 * nothing else — the evidence lives behind a button, and the instructions became actions.
 *
 * Pure on purpose. The wording is the product here, so it has to be testable without a
 * database, a Telegram token or a clock.
 */

/** One change the engine made, addressable so a button can undo exactly this one. */
export interface BriefAction {
  /** manager_actions row id — the undo handle. */
  id: string;
  /** Already-written Hebrew line, without the bullet. */
  text: string;
}

export interface BriefInput {
  /** dd.MM of the run itself. */
  dateLabel: string;
  posts: number;
  postsArrow: string;
  clicks: number;
  clicksArrow: string;
  orders: number;
  ordersArrow: string;
  revenueIls: number;
  /** dd.MM of the AliExpress accounting day the orders belong to. */
  portalDayLabel: string | null;
  bonusOrders: number;
  bonusPaidUsd: number;
  actions: BriefAction[];
  /** How many changes to name before collapsing the rest into a count. */
  maxActions?: number;
}

export const DEFAULT_MAX_ACTIONS = 4;

/**
 * Hebrew plural for a count of changes. "1 שינויים" is the kind of small wrongness that
 * makes an automated report feel automated.
 */
function changesLabel(n: number): string {
  return n === 1 ? 'שינוי אחד' : `${n} שינויים`;
}

export function buildBrief(input: BriefInput): string {
  const max = input.maxActions ?? DEFAULT_MAX_ACTIONS;
  const lines: string[] = [];

  lines.push(`🧠 המוח הלומד · ${input.dateLabel}`);
  lines.push('');
  lines.push(`📊 ${input.posts} פוסטים${input.postsArrow} · ${input.clicks} קליקים${input.clicksArrow}`);

  // Orders carry the AliExpress accounting date, because that is the row the owner can
  // hold this figure against in the portal — "yesterday" is not the same day there.
  const day = input.portalDayLabel ? ` (${input.portalDayLabel})` : '';
  const money: string[] = [`${input.orders} הזמנות${input.ordersArrow}${day}`, `₪${input.revenueIls} עמלות`];
  if (input.bonusOrders > 0) {
    money.push(input.bonusPaidUsd > 0
      ? `🎁 ${input.bonusOrders} מהבונוס ($${input.bonusPaidUsd})`
      : `🎁 ${input.bonusOrders} מהבונוס`);
  }
  lines.push(`💰 ${money.join(' · ')}`);

  lines.push('');
  if (!input.actions.length) {
    // Not an apology and not padding: "balanced" is a real verdict, and saying it in one
    // line is what keeps the report honest on a quiet night.
    lines.push('⚡ לא נדרש שינוי — הרוטציה מאוזנת.');
    return lines.join('\n');
  }

  lines.push(`⚡ ביצעתי ${changesLabel(input.actions.length)}:`);
  for (const a of input.actions.slice(0, max)) lines.push(`• ${a.text}`);
  const rest = input.actions.length - max;
  if (rest > 0) lines.push(`• ועוד ${changesLabel(rest)} — לחץ "פירוט מלא"`);

  return lines.join('\n');
}
