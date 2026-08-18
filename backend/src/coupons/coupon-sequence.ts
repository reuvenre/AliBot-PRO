/**
 * The coupon LAUNCH SEQUENCE — the campaign around a coupon batch, not just its import.
 *
 * A saved batch used to sit silently in the table until a product post happened to attach
 * a code. The moments that actually convert are the ones around the window itself:
 *
 *   teaser   (evening before) — "fill your cart now" plants a commitment; a shopper who
 *                               built a cart tonight comes back to close it tomorrow.
 *   launch   (start morning)  — the ladder goes live. The LADDER is the message: "$4 more
 *                               and the next code kicks in" is what adds items to carts.
 *   mid      (window middle)  — an anchor product priced just above a tier makes the
 *                               saving concrete instead of abstract.
 *   urgency  (12h before end) — the strongest converter of the four. A deadline moves the
 *                               people a promise never did.
 *
 * All numbers, codes and dates are BUILT IN CODE from the coupon rows — same reasoning as
 * the price/proof block: money-figures are data, and a model paraphrasing data is how a
 * wrong number reaches a live group. The AI contributes one hook line, validated to carry
 * no digits, so it can color the post but never mis-state it.
 *
 * Output is fed into custom_posts, whose dispatcher places each post into the target
 * group's next free queue slot — the sequence INTERLEAVES with the autopilot instead of
 * stacking on top of it.
 */

export interface CouponTier {
  code: string;
  discount_usd: number;
  min_spend_usd: number;
}

/** A real, already-posted product priced just above a tier — the mid-post's example. */
export interface SequenceAnchor {
  title: string;
  priceUsd: number;
  tierMin: number;
  code: string;
  saveUsd: number;
  link: string;
}

export type SequenceStage = 'teaser' | 'launch' | 'mid' | 'urgency';

export interface SequencePost {
  stage: SequenceStage;
  sendAt: Date;
  name: string;
  body: string;
}

/** Rows carrying this prefix are OURS — a re-import replaces only them, never the
 *  owner's hand-written custom posts. */
export const SEQUENCE_NAME_PREFIX = '🎟️ רצף קופונים';

const DAY_MS = 24 * 3600_000;
const TZ = 'Asia/Jerusalem';

/** Wall-clock offset of `tz` at `date` (ms). Israel flips +02/+03 with DST, so this is
 *  computed per date rather than hardcoded. */
function zoneOffsetMs(date: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return asUtc - date.getTime();
}

/** The moment that is `hour:minute` on `base`'s local day (+dayShift) in `tz`. */
function atLocalTime(base: Date, hour: number, minute: number, tz: string, dayShift = 0): Date {
  const off = zoneOffsetMs(base, tz);
  const local = new Date(base.getTime() + off);
  const wall = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayShift, hour, minute, 0);
  // The offset can differ AT the target (DST edge) — recompute once against the estimate.
  return new Date(wall - zoneOffsetMs(new Date(wall - off), tz));
}

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', timeZone: TZ }).format(d);
const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d);

/** The ladder, one line per tier, cheapest first — the message itself. */
export function ladderLines(tiers: CouponTier[]): string {
  return [...tiers]
    .sort((a, b) => a.min_spend_usd - b.min_spend_usd)
    .map((t) => `💵 קנייה מעל $${t.min_spend_usd} → הנחה של $${t.discount_usd} · קוד: <code>${t.code}</code>`)
    .join('\n');
}

/**
 * Validate the AI's hook line: one short sentence of color, NO digits — a number the
 * model invented next to a code-built ladder is exactly the defect this design exists
 * to make impossible. Anything suspect falls back to the stock hook.
 */
export function sanitizeHook(raw: string | null | undefined): string {
  const hook = String(raw || '').trim().split('\n')[0].trim();
  if (!hook || hook.length > 120 || /\d/.test(hook)) return '🎁 חדשות טובות לחוסכים:';
  return hook;
}

export function buildCouponSequence(input: {
  tiers: CouponTier[];
  startsAt: Date;
  endsAt: Date | null;
  now: Date;
  hook?: string | null;
  anchor?: SequenceAnchor | null;
}): SequencePost[] {
  const { tiers, startsAt, endsAt, now } = input;
  if (!tiers.length) return [];
  const ladder = ladderLines(tiers);
  const hook = sanitizeHook(input.hook);
  const validity = endsAt ? `⏳ בתוקף עד ${fmtDate(endsAt)}` : '';
  const out: SequencePost[] = [];
  const push = (stage: SequenceStage, sendAt: Date, body: string) => {
    // Never schedule into the past, and never after the codes have already died.
    if (sendAt.getTime() <= now.getTime()) return;
    if (endsAt && sendAt.getTime() >= endsAt.getTime()) return;
    out.push({ stage, sendAt, name: `${SEQUENCE_NAME_PREFIX} · ${stage} · ${fmtDate(startsAt)}`, body });
  };

  push('teaser', atLocalTime(startsAt, 18, 0, TZ, -1), [
    hook,
    `🎟️ מחר (${fmtDate(startsAt)}) נכנסים לתוקף קופוני אלי אקספרס החדשים:`,
    '',
    ladder,
    '',
    '💡 טיפ: תתחילו למלא את העגלה כבר הערב — מחר פשוט מדביקים את הקוד בקופה, וההנחה יורדת מיד.',
    validity,
  ].filter(Boolean).join('\n'));

  // The window may open mid-day; the launch never fires before the codes actually work.
  const launchAt = new Date(Math.max(atLocalTime(startsAt, 9, 30, TZ).getTime(), startsAt.getTime()));
  push('launch', launchAt, [
    '🚀 הקופונים יצאו לדרך!',
    endsAt ? `מהיום ועד ${fmtDate(endsAt)} — הנחה על כל קנייה באלי אקספרס:` : 'החל מהיום — הנחה על כל קנייה באלי אקספרס:',
    '',
    ladder,
    '',
    '📋 מעתיקים את הקוד, מדביקים בקופה — וההנחה יורדת מיד. הקודים מצטברים עם מבצעי האתר.',
  ].filter(Boolean).join('\n'));

  // Mid-window only when there is a real middle: a short window jumps straight from
  // launch to urgency, because three posts in four days is presence, not spam.
  if (endsAt && endsAt.getTime() - startsAt.getTime() >= 4 * DAY_MS) {
    const midDays = Math.floor((endsAt.getTime() - startsAt.getTime()) / DAY_MS / 2);
    const midAt = atLocalTime(startsAt, 12, 0, TZ, midDays);
    const anchor = input.anchor;
    push('mid', midAt, (anchor ? [
      '🛒 ככה זה עובד בפועל:',
      `"${anchor.title}" עולה $${anchor.priceUsd} — מעל $${anchor.tierMin} הקוד <code>${anchor.code}</code> מוריד $${anchor.saveUsd} במקום.`,
      anchor.link,
      '',
      'כל הסולם:',
      ladder,
      '',
      validity,
    ] : [
      '🎟️ תזכורת: הקופונים עדיין פעילים —',
      '',
      ladder,
      '',
      '💡 כמה שהעגלה גדולה יותר, הקוד הבא בסולם משתלם יותר.',
      validity,
    ]).filter(Boolean).join('\n'));
  }

  if (endsAt) {
    push('urgency', new Date(endsAt.getTime() - 12 * 3600_000), [
      `⏰ תזכורת אחרונה: הקופונים פוקעים ב-${fmtDate(endsAt)} בשעה ${fmtTime(endsAt)}!`,
      '',
      ladder,
      '',
      'מי שדחה את הקנייה — זה הרגע. אחרי זה הקודים פשוט לא יעבדו.',
    ].join('\n'));
  }

  return out.sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
}
