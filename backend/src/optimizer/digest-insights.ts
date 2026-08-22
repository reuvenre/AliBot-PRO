/**
 * The parts of the morning report that draw a CONCLUSION rather than print a number.
 *
 * They live apart from the service because this is where a report stops being a
 * thermometer: a recommendation the owner acts on has to be right, and rules that decide
 * what to tell someone to do are exactly the ones worth pinning down with tests.
 */

/** Movement against the recent norm, as an arrow the eye reads before the number. */
export function trendArrow(current: number, baseline: number): string {
  // No baseline = no claim. A first day would otherwise always read as a triumph.
  if (!baseline || baseline <= 0) return '';
  const pct = Math.round(((current - baseline) / baseline) * 100);
  if (Math.abs(pct) < 10) return ' ⟷'; // inside the noise — say "steady", don't cry wolf
  return pct > 0 ? ` ↑${pct}%` : ` ↓${Math.abs(pct)}%`;
}

export interface GroupBalance {
  name: string;
  posts: number;
  clicks: number;
}

export interface FrictionProduct {
  title: string;
  clicks: number;
}

export interface ActionInputs {
  /** Posts vs clicks per group over the window — the attention/effort mismatch. */
  groups: GroupBalance[];
  /** Products that drew real clicks and produced no order at all. */
  friction: FrictionProduct[];
  /** Campaigns active but silent for a day or more. */
  silentCampaigns: string[];
  /** Orders yesterday, and how many came from bonus-pool keywords. */
  orders: number;
  bonusOrders: number;
  /** Live bonus pools exist at all — without them the bonus advice is noise. */
  hasBonusPools: boolean;
  /** Keyword rotation is being judged on real signal (see the engine's click floor). */
  enoughSignal: boolean;
}

/**
 * The ONE thing worth doing today, or null when nothing stands out.
 *
 * Ranked by how directly it moves money, and deliberately singular: a report that ends in
 * six suggestions ends in none. Silence is a valid answer — inventing an action on a quiet
 * day trains the owner to skip the line that matters on the day it isn't quiet.
 */
export function pickTopAction(input: ActionInputs): string | null {
  // 1. A campaign that stopped publishing beats every optimisation — nothing else in the
  //    report matters while a group is getting nothing.
  if (input.silentCampaigns.length) {
    return `הטייס "${input.silentCampaigns[0]}" לא פרסם מעל יממה — בדוק אותו לפני כל דבר אחר`;
  }

  // 2. Effort in the wrong room: a group drawing a large share of the clicks on a small
  //    share of the posts is the cheapest gain on the board — the audience is already
  //    there, only the schedule isn't.
  const totalPosts = input.groups.reduce((n, g) => n + g.posts, 0);
  const totalClicks = input.groups.reduce((n, g) => n + g.clicks, 0);
  if (totalPosts >= 10 && totalClicks >= 10) {
    const scored = input.groups
      .map((g) => ({
        name: g.name,
        postShare: g.posts / totalPosts,
        clickShare: g.clicks / totalClicks,
      }))
      // A group with a real appetite (≥25% of clicks) getting materially less than its
      // share of the posts. The 1.5× gap keeps ordinary variation out of the headline.
      .filter((g) => g.clickShare >= 0.25 && g.clickShare > g.postShare * 1.5)
      .sort((a, b) => (b.clickShare - b.postShare) - (a.clickShare - a.postShare));
    if (scored.length) {
      const g = scored[0];
      return `"${g.name}" מקבלת ${Math.round(g.clickShare * 100)}% מהקליקים אבל רק `
        + `${Math.round(g.postShare * 100)}% מהפוסטים — הוסף לה תדירות`;
    }
  }

  // 3. Clicks without a sale are the shopper telling you the page disappointed him —
  //    usually price or shipping. One product named beats a list nobody opens.
  if (input.friction.length) {
    const f = input.friction[0];
    return `"${f.title}" קיבל ${f.clicks} קליקים ואפס הזמנות — בדוק מחיר/משלוח מול המתחרים או החלף אותו`;
  }

  // 4. Bonus pools registered and nothing sold through them: the registration is doing
  //    nothing until the rotation actually publishes those categories.
  if (input.hasBonusPools && input.orders > 0 && input.bonusOrders === 0) {
    return 'אף הזמנה לא הגיעה ממילות מסלולי הבונוס — שקול להגביר את המילים שלהם ברוטציה';
  }

  // 5. The engine cannot judge anything yet. Say so as an action ("get more traffic"),
  //    not as an apology, and only when nothing above applied.
  if (!input.enoughSignal) {
    return 'אין עדיין מספיק קליקים כדי לשפוט מילות מפתח — כל פוסט נוסף מקרב את המנוע להחלטות אמיתיות';
  }

  return null;
}

/** Products that drew clicks and sold nothing, worst first. */
export function frictionProducts(
  rows: Array<{ title: string; clicks: number; orders: number }>,
  minClicks = 5,
  limit = 3,
): FrictionProduct[] {
  return rows
    .filter((r) => r.orders === 0 && r.clicks >= minClicks)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit)
    .map((r) => ({ title: String(r.title || '').slice(0, 50), clicks: r.clicks }));
}
