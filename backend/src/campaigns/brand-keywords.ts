/**
 * Which campaign keywords are risky to search with.
 *
 * A keyword is not a label — it is what the autopilot TYPES INTO AliExpress, and whatever
 * comes back gets published under the owner's own brand to Telegram, Facebook, Instagram
 * and Pinterest. Two families of keyword reliably return listings that get a post (or an
 * account) taken down:
 *
 *   1. A protected brand name. AliExpress does host authorized "Brand+" stores, so a
 *      branded search is not automatically counterfeit — but the KEYWORD cannot promise
 *      it: the same search returns unauthorized sellers on the next page, and the
 *      autopilot picks by price/orders, not by badge. Meta and Pinterest both action
 *      counterfeit reports against the PAGE, not the post.
 *   2. Authenticity phrasing ("official", "authentic", "1:1", "replica", "מקורי").
 *      Sellers write it precisely because the listing needs the claim; searching for it
 *      steers the picker straight at that shelf.
 *
 * So: flag, don't block. The owner knows their niche — a tactical channel selling Casio
 * G-Shocks from an authorized store is a legitimate call. This module only makes sure the
 * call is made on purpose, and gives a generic replacement to make it one edit away.
 */

/** How bad, and what the UI colours it. */
export type KeywordRisk = 'high' | 'watch';

export interface KeywordFlag {
  keyword: string;
  risk: KeywordRisk;
  /** Shown verbatim to the owner (Hebrew). */
  reason: string;
  /** A generic keyword that searches the same shelf without the brand. */
  suggestion?: string;
}

/**
 * Brands whose AliExpress results are dominated by unauthorized sellers, and whose
 * rights-holders actively file takedowns — fashion/luxury/sneakers, plus licensed
 * characters (Disney/Marvel/Pokémon/LEGO enforce as aggressively as any fashion house).
 * A hit here is 'high': the risk isn't a bad post, it's a strike on the page.
 */
const HIGH_RISK_BRANDS: Array<[RegExp, string]> = [
  [/\bnike\b|\bair\s*max\b|\bjordan\b|\byeezy\b/i, 'running sneakers'],
  [/\badidas\b|\bpuma\b|\breebok\b|\bnew\s*balance\b|\bunder\s*armou?r\b|\bfila\b|\bvans\b|\bconverse\b/i, 'sport sneakers'],
  [/\bgucci\b|\bprada\b|\blouis\s*vuitton\b|\bchanel\b|\bdior\b|\bherm[eè]s\b|\bversace\b|\bbalenciaga\b|\bburberry\b|\bfendi\b|\bceline\b/i, 'leather handbag'],
  [/\bmichael\s*kors\b|\bcoach\b|\bkate\s*spade\b|\btommy\s*hilfiger\b|\bcalvin\s*klein\b|\blacoste\b|\bralph\s*lauren\b|\bthe\s*north\s*face\b|\bsupreme\b|\bstone\s*island\b/i, 'casual jacket'],
  [/\brolex\b|\bomega\b|\baudemars\b|\bpatek\b|\bcartier\b|\bhublot\b|\btag\s*heuer\b/i, 'luxury style watch'],
  [/\bray[\s-]*ban\b|\boakley\b|\bpersol\b/i, 'polarized sunglasses'],
  [/\bdisney\b|\bmarvel\b|\bpok[eé]mon\b|\bpikachu\b|\blego\b|\bbarbie\b|\bhello\s*kitty\b|\bstitch\b|\bharry\s*potter\b|\bstar\s*wars\b|\bsanrio\b|\bnaruto\b|\banime\s*figure\b/i, 'collectible figures'],
  [/\bapple\b|\biphone\b|\bairpods?\b|\bairtag\b|\bmacbook\b|\bapple\s*watch\b/i, 'phone accessories'],
  [/\bplaystation\b|\bps5\b|\bxbox\b|\bnintendo\b|\bswitch\s*console\b/i, 'gaming accessories'],
  [/\bdyson\b|\bgopro\b|\bstanley\s*cup\b|\byeti\s*tumbler\b/i, 'insulated tumbler'],
];

/**
 * Real brands that DO run authorized AliExpress stores and sell genuinely there. Worth a
 * second look rather than a red line: the search is fine when it lands on the official
 * store, and a lottery when it doesn't.
 */
const WATCH_BRANDS: Array<[RegExp, string]> = [
  [/\bxiaomi\b|\bredmi\b|\bhuawei\b|\bsamsung\b|\brealme\b|\bo?neplus\b/i, 'bluetooth earbuds'],
  [/\banker\b|\bbaseus\b|\bugreen\b|\bjoyroom\b|\bhoco\b/i, 'fast charger cable'],
  [/\bcasio\b|\bseiko\b|\bcitizen\b|\bamazfit\b|\bgarmin\b|\bfitbit\b|\bsuunto\b/i, 'digital sport watch'],
  [/\bbosch\b|\bmakita\b|\bdewalt\b|\bmilwaukee\b|\bdeli\b|\btotal\s*tools\b/i, 'power tool set'],
  [/\bjbl\b|\bbose\b|\bsony\b|\bbeats\b|\bmarshall\b|\bharman\b/i, 'bluetooth speaker'],
  [/\blogitech\b|\brazer\b|\bredragon\b|\bhyperx\b/i, 'gaming mouse'],
  [/\bcrocs\b|\bugg\b|\bskechers\b|\bcolumbia\b|\b5\.?11\b|\bmagpul\b/i, 'outdoor footwear'],
  [/\bdji\b|\binsta360\b|\bxiaomi\s*camera\b/i, 'action camera accessories'],
  [/\bphilips\b|\bbraun\b|\boral[\s-]*b\b|\btefal\b|\bxiaomi\s*mijia\b/i, 'grooming trimmer'],
];

/**
 * Authenticity phrasing. 'high' for the words that only exist to sell a copy ("replica",
 * "1:1", "AAA quality"), 'watch' for the ones a legitimate authorized store also uses
 * ("official", "authentic") — those merely fail to GUARANTEE what the shopper will get.
 */
const AUTHENTICITY: Array<[RegExp, KeywordRisk, string]> = [
  [/\breplica\b|\b1\s*[:：]\s*1\b|\baaa\s*(quality|grade)?\b|\bmirror\s*quality\b|\bknock\s*off\b|\bhigh\s*copy\b|העתק|חיקוי/i, 'high',
    'ניסוח שמכוון ישירות למוצרי חיקוי — פוסט כזה מסכן את העמוד בפייסבוק/פינטרסט'],
  [/\bofficial\b|\bauthentic\b|\bgenuine\b|\boriginal\b|\bbrand\s*new\s*original\b|מקורי|אורגינל/i, 'watch',
    'ניסוח "מקורי/אותנטי" לא מבטיח שהתוצאה תהיה מחנות מותג מורשית — התוצאה השנייה בחיפוש כבר יכולה להיות מזויפת'],
  [/\bstyle\b.*\b(bag|watch|shoes?)\b|\binspired\s*by\b|\bfor\s*(gucci|nike|adidas|rolex)\b/i, 'watch',
    'ניסוח "בהשראת/בסגנון" מותג — עדיין נחשב הפרת סימן מסחר בפרסום ממומן'],
];

/** Everything below this is noise, not a keyword. */
const MIN_LENGTH = 2;

/**
 * Audit ONE keyword. Returns null when nothing about it is risky.
 *
 * Order matters: the flat-out counterfeit phrasing wins over a brand hit, because that is
 * the sentence the owner needs to read first.
 */
export function auditKeyword(raw: string): KeywordFlag | null {
  const keyword = String(raw || '').trim();
  if (keyword.length < MIN_LENGTH) return null;

  for (const [re, risk, reason] of AUTHENTICITY) {
    if (re.test(keyword)) return { keyword, risk, reason };
  }
  for (const [re, suggestion] of HIGH_RISK_BRANDS) {
    if (re.test(keyword)) {
      return {
        keyword,
        risk: 'high',
        reason: 'שם מותג מוגן שנתבע הרבה על זיופים — התוצאות ב-AliExpress ברובן לא ממוכר מורשה',
        suggestion,
      };
    }
  }
  for (const [re, suggestion] of WATCH_BRANDS) {
    if (re.test(keyword)) {
      return {
        keyword,
        risk: 'watch',
        reason: 'שם מותג שיש לו חנות רשמית ב-AliExpress — תקין כשהתוצאה מהחנות הרשמית, מסוכן כשלא',
        suggestion,
      };
    }
  }
  return null;
}

/** Audit a whole list, one flag per distinct keyword, worst first. */
export function auditKeywords(keywords: string[] | null | undefined): KeywordFlag[] {
  const seen = new Set<string>();
  const flags: KeywordFlag[] = [];
  for (const kw of keywords || []) {
    const key = String(kw || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const flag = auditKeyword(kw);
    if (flag) flags.push(flag);
  }
  return flags.sort((a, b) => (a.risk === b.risk ? 0 : a.risk === 'high' ? -1 : 1));
}
