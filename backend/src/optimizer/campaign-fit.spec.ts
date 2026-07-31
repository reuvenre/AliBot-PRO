import { CategoryScore } from './order-learning';
import {
  CampaignProfile, buildFitPrompt, lexicalFit, parseFitVerdicts, rankFitted, tokenize,
} from './campaign-fit';

const profile = (over: Partial<CampaignProfile> = {}): CampaignProfile => ({
  name: 'טקטי בקליק',
  keywords: ['tactical backpack', 'hunting knife', 'camping gear'],
  retired: [],
  channels: ['טקטי בקליק — ציוד טקטי, שטח וקמפינג'],
  earning: [],
  ...over,
});

const cat = (keyword: string, commissionIls: number, orders = 2): CategoryScore =>
  ({ keyword, commissionIls, orders, products: 2 });

describe('tokenize', () => {
  it('splits on punctuation and normalises plurals', () => {
    expect(tokenize('Camping & Hiking')).toEqual(['camping', 'hiking']);
    // Plural and singular must read as the same word, or "Backpacks" would miss a group
    // whose rotation says "tactical backpack".
    expect(tokenize('Backpacks')).toEqual(tokenize('backpack'));
  });

  it('drops words that describe no niche', () => {
    // "Pet Products" must fit on "pet", never on "products" — which every category has.
    expect(tokenize('Pet Products')).toEqual(['pet']);
    expect(tokenize('Other Accessories')).toEqual([]);
  });
});

describe('lexicalFit', () => {
  it('accepts a category the group already talks about', () => {
    expect(lexicalFit('Hunting Knife', profile())).toBe(true);
    expect(lexicalFit('Camping', profile())).toBe(true);
  });

  it('rejects a category unrelated to the rotation', () => {
    expect(lexicalFit('Baby Toys', profile())).toBe(false);
  });

  it('requires every meaningful word, not one lucky match', () => {
    // "hunting" is in the vocabulary, "drone" is not — half a match is not a match.
    expect(lexicalFit('Hunting Drone', profile())).toBe(false);
  });

  it('ignores the campaign name, which matches everything', () => {
    // "מוצרים כללי" would otherwise wave through every candidate on earth.
    expect(lexicalFit('Hunting', profile({ name: 'Hunting deals', keywords: ['baby toys'] })))
      .toBe(false);
  });

  it('counts what the group proved it earns from', () => {
    expect(lexicalFit('Multitools', profile({ keywords: [], earning: ['multitool'] }))).toBe(true);
  });

  it('adds nothing for a campaign with no vocabulary at all', () => {
    expect(lexicalFit('Hunting', profile({ keywords: [], earning: [] }))).toBe(false);
  });
});

describe('buildFitPrompt', () => {
  it('states the group, its rotation and its groups', () => {
    const text = buildFitPrompt(profile({ earning: ['hunting knife'] }), [cat('Baby Toys', 30)]);
    expect(text).toContain('טקטי בקליק');
    expect(text).toContain('tactical backpack');
    expect(text).toContain('ציוד טקטי, שטח וקמפינג');
    expect(text).toContain('PROVEN EARNERS IN THIS GROUP: hunting knife');
    expect(text).toContain('Baby Toys');
  });

  it('carries the sales evidence so the judge sees the trade-off', () => {
    expect(buildFitPrompt(profile(), [cat('Hunting', 55.25, 11)]))
      .toContain('Hunting (₪55.25, 11 orders)');
  });
});

describe('parseFitVerdicts', () => {
  const candidates = [cat('Hunting', 55), cat('Baby Toys', 30)];

  it('reads a clean verdict list', () => {
    const out = parseFitVerdicts(
      '[{"keyword":"Hunting","fits":true,"reason":"קהל שטח"},'
      + '{"keyword":"Baby Toys","fits":false,"reason":"לא הקהל"}]',
      candidates,
    );
    expect(out).toEqual([
      { keyword: 'Hunting', fits: true, reason: 'קהל שטח' },
      { keyword: 'Baby Toys', fits: false, reason: 'לא הקהל' },
    ]);
  });

  it('survives code fences and surrounding prose', () => {
    const out = parseFitVerdicts(
      'Here you go:\n```json\n[{"keyword":"Hunting","fits":true,"reason":"ok"}]\n```',
      candidates,
    );
    expect(out.map((v) => v.keyword)).toEqual(['Hunting']);
  });

  it('matches the candidate case-insensitively', () => {
    expect(parseFitVerdicts('[{"keyword":"hUnTiNg","fits":true,"reason":"x"}]', candidates)[0].keyword)
      .toBe('Hunting');
  });

  it('drops a category that was never on the ballot', () => {
    // The judge picks from the list; it does not get to invent keywords for a real channel.
    expect(parseFitVerdicts('[{"keyword":"Crossbows","fits":true,"reason":"x"}]', candidates))
      .toEqual([]);
  });

  it('treats anything short of an explicit true as a rejection', () => {
    const out = parseFitVerdicts(
      '[{"keyword":"Hunting","fits":"yes"},{"keyword":"Baby Toys"}]', candidates,
    );
    expect(out.every((v) => !v.fits)).toBe(true);
  });

  it('returns nothing for a malformed or empty answer', () => {
    // Nothing parsed must mean nothing added — never "add them all".
    expect(parseFitVerdicts('sorry, I cannot help with that', candidates)).toEqual([]);
    expect(parseFitVerdicts('[{"keyword":"Hunting", tru', candidates)).toEqual([]);
    expect(parseFitVerdicts('', candidates)).toEqual([]);
  });

  it('ignores a duplicated verdict for the same candidate', () => {
    const out = parseFitVerdicts(
      '[{"keyword":"Hunting","fits":true,"reason":"a"},{"keyword":"Hunting","fits":false}]',
      candidates,
    );
    expect(out).toHaveLength(1);
    expect(out[0].fits).toBe(true);
  });
});

describe('rankFitted', () => {
  const candidates = [cat('Hunting', 55, 11), cat('Entertainment', 15, 2), cat('Camping', 7, 3)];
  const verdicts = candidates.map((c) => ({ keyword: c.keyword, fits: true, reason: 'ok' }));

  it('keeps only what the judge approved', () => {
    const mixed = [
      { keyword: 'Hunting', fits: false, reason: 'לא הקהל' },
      { keyword: 'Camping', fits: true, reason: 'קהל שטח' },
    ];
    expect(rankFitted(candidates, mixed, profile(), new Set(), 5).map((c) => c.keyword))
      .toEqual(['Camping']);
  });

  it('prefers what the group already proves an appetite for over the bigger earner', () => {
    // Entertainment earns twice what Camping does account-wide — but this group sells
    // camping gear, and the group's own niche outranks the account's biggest number.
    const pair = [cat('Entertainment', 15, 2), cat('Camping', 7, 3)];
    const both = pair.map((c) => ({ keyword: c.keyword, fits: true, reason: 'ok' }));
    expect(rankFitted(pair, both, profile(), new Set(), 1)[0].keyword).toBe('Camping');
  });

  it('breaks a tie toward a category no other group took tonight', () => {
    // Neither is in the rotation, Hunting earns more — but Hunting already went elsewhere,
    // so the groups drift apart instead of converging on the same winning list.
    const general = profile({ name: 'כללי', keywords: ['phone case'], channels: [] });
    const [top] = rankFitted(candidates, verdicts, general, new Set(['hunting']), 1);
    expect(top.keyword).toBe('Entertainment');
  });

  it('falls back to money when nothing else separates the candidates', () => {
    const general = profile({ name: 'כללי', keywords: ['phone case'], channels: [] });
    expect(rankFitted(candidates, verdicts, general, new Set(), 1)[0].keyword).toBe('Hunting');
  });

  it('caps how many a group gains per run', () => {
    expect(rankFitted(candidates, verdicts, profile(), new Set(), 2)).toHaveLength(2);
    expect(rankFitted(candidates, verdicts, profile(), new Set(), 0)).toEqual([]);
  });

  it('carries the reason through for the digest', () => {
    const [top] = rankFitted(
      candidates, [{ keyword: 'Camping', fits: true, reason: 'קהל שטח וקמפינג' }],
      profile(), new Set(), 1,
    );
    expect(top).toMatchObject({ keyword: 'Camping', reason: 'קהל שטח וקמפינג', orders: 3 });
  });

  it('adds nothing when the judge approved nothing', () => {
    const none = candidates.map((c) => ({ keyword: c.keyword, fits: false, reason: 'לא מתאים' }));
    expect(rankFitted(candidates, none, profile(), new Set(), 5)).toEqual([]);
  });
});
