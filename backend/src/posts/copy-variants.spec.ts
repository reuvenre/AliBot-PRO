import {
  COPY_VARIANTS, EXPLORE_RATE, FLYLINK_VARIANTS, MIN_CLICKS_TO_PICK_WINNER,
  MIN_POSTS_PER_VARIANT, TRUST_VARIANT, VariantStat,
  bestVariant, pickVariant, scoreVariants, variantById, variantHint,
} from './copy-variants';

/** Every angle sampled enough to be comparable, so the "untried first" rule is satisfied. */
const sampled = (over: Record<string, Partial<VariantStat>> = {}): VariantStat[] =>
  COPY_VARIANTS.map((v) => ({
    variant: v.id,
    posts: over[v.id]?.posts ?? MIN_POSTS_PER_VARIANT,
    clicks: over[v.id]?.clicks ?? 1,
  }));

describe('scoreVariants', () => {
  it('ranks by clicks per post, not by raw clicks', () => {
    // The angles get unequal airtime, so the raw total says more about exposure than merit.
    const scored = scoreVariants([
      { variant: 'benefit', posts: 100, clicks: 20 },
      { variant: 'problem', posts: 10, clicks: 8 },
    ]);
    expect(scored.map((s) => s.variant)).toEqual(['problem', 'benefit']);
    expect(scored[0].clicksPerPost).toBe(0.8);
  });

  it('breaks a tie toward the better-sampled angle', () => {
    const scored = scoreVariants([
      { variant: 'benefit', posts: 10, clicks: 5 },
      { variant: 'problem', posts: 40, clicks: 20 },
    ]);
    expect(scored[0].variant).toBe('problem');
  });

  it('ignores an angle with no posts behind it', () => {
    expect(scoreVariants([{ variant: 'benefit', posts: 0, clicks: 0 }])).toEqual([]);
    expect(scoreVariants([])).toEqual([]);
    expect(scoreVariants(undefined as any)).toEqual([]);
  });
});

describe('bestVariant', () => {
  it('names a winner once the evidence supports one', () => {
    const stats = sampled({ problem: { posts: 40, clicks: 30 }, benefit: { posts: 40, clicks: 5 } });
    expect(bestVariant(stats)?.variant).toBe('problem');
  });

  it('refuses to name one on too few clicks account-wide', () => {
    // Same shape, a tenth of the traffic: a 3-click lead is noise, not a finding.
    expect(bestVariant([
      { variant: 'problem', posts: 40, clicks: 3 },
      { variant: 'benefit', posts: 40, clicks: 0 },
    ])).toBeNull();
  });

  it('refuses to crown an angle that has barely been used', () => {
    // A lucky 2-for-2 must not beat an angle measured over 60 posts.
    expect(bestVariant([
      { variant: 'curiosity', posts: 2, clicks: 2 },
      { variant: 'benefit', posts: 60, clicks: 20 },
    ])?.variant).not.toBe('curiosity');
  });

  it('never crowns an angle with zero clicks', () => {
    expect(bestVariant([
      { variant: 'benefit', posts: 40, clicks: 0 },
      { variant: 'problem', posts: 40, clicks: 0 },
    ])).toBeNull();
  });

  it('has no winner before anything has been published', () => {
    expect(bestVariant([])).toBeNull();
  });
});

describe('pickVariant', () => {
  it('tries an under-sampled angle before comparing any of them', () => {
    // "curiosity" has had 1 post; the bandit cannot rank what it has not measured.
    const stats = sampled({ curiosity: { posts: 1, clicks: 0 }, problem: { posts: 90, clicks: 80 } });
    for (const roll of [0, 0.3, 0.6, 0.99]) {
      expect(pickVariant(stats, roll).id).toBe('curiosity');
    }
  });

  it('writes in the winner once there is one', () => {
    const stats = sampled({ problem: { posts: 40, clicks: 35 } });
    // A roll above the explore share means exploit.
    expect(pickVariant(stats, 0.9).id).toBe('problem');
  });

  it('still explores a share of the time, so a better angle can overtake', () => {
    // Without this the first lucky angle wins forever and the rest are never measured again.
    const stats = sampled({ problem: { posts: 40, clicks: 35 } });
    const explored = [0, 0.05, 0.1, 0.2]
      .map((roll) => pickVariant(stats, roll).id)
      .filter((id) => id !== 'problem');
    expect(explored.length).toBeGreaterThan(0);
    expect(EXPLORE_RATE).toBeGreaterThan(0);
  });

  it('spreads evenly while no winner has been established', () => {
    // Equal, low-signal stats: every angle must remain reachable.
    const stats = sampled();
    const picked = new Set([0, 0.26, 0.51, 0.76, 0.99].map((r) => pickVariant(stats, r).id));
    expect(picked.size).toBeGreaterThan(1);
  });

  it('always returns a usable angle, including on a cold start', () => {
    for (const roll of [0, 0.5, 0.999]) {
      expect(COPY_VARIANTS).toContainEqual(pickVariant([], roll));
    }
  });
});

describe('variantHint', () => {
  it('speaks the post language, falling back to English', () => {
    const v = COPY_VARIANTS[0];
    expect(variantHint(v, 'he')).toBe(v.hint.he);
    expect(variantHint(v, 'ar')).toBe(v.hint.ar);
    expect(variantHint(v, 'fr')).toBe(v.hint.en);
    expect(variantHint(v, '')).toBe(v.hint.he);
  });

  it('gives every angle a hint in every supported language', () => {
    for (const v of COPY_VARIANTS) {
      for (const lang of ['he', 'en', 'ar']) {
        expect(v.hint[lang]?.length).toBeGreaterThan(20);
      }
    }
  });
});

describe('variantById', () => {
  it('resolves a stored id back to its angle', () => {
    expect(variantById('benefit')?.label).toBe('תועלת');
  });

  it('shrugs at an unknown or missing id', () => {
    // Posts written before the bandit existed carry null, and an angle could be retired.
    expect(variantById(null)).toBeNull();
    expect(variantById('retired-angle')).toBeNull();
  });
});

describe('the trust angle (FLYLINK pool)', () => {
  it('is reachable from the FLYLINK pool but NEVER from the default one', () => {
    // "כן, זו גרסה" on an AliExpress post would be flatly wrong — the pools must not mix.
    const fullSample = COPY_VARIANTS.map((v) => ({ variant: v.id, posts: 40, clicks: 1 }));
    for (const roll of [0, 0.3, 0.7, 0.99]) {
      expect(pickVariant(fullSample, roll).id).not.toBe('trust');
    }
    // With every shared angle sampled and trust untried, the FLYLINK pool tries it first.
    expect(pickVariant(fullSample, 0.5, FLYLINK_VARIANTS).id).toBe('trust');
  });

  it('holds the honesty line in its own instructions', () => {
    // The hint must carry the prohibition, not rely on the model's judgement.
    expect(TRUST_VARIANT.hint.he).toContain('אסור');
    expect(TRUST_VARIANT.hint.en).toContain('Never claim');
  });

  it('resolves from a stored post id, so digests can label it', () => {
    expect(variantById('trust')?.label).toBe('ביטחון');
  });
});

describe('the angles themselves', () => {
  it('are distinct and few enough to tell apart on real traffic', () => {
    const ids = COPY_VARIANTS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(COPY_VARIANTS.length).toBeLessThanOrEqual(5);
  });

  it('need less evidence to keep exploring than to crown a winner', () => {
    expect(MIN_CLICKS_TO_PICK_WINNER).toBeGreaterThan(MIN_POSTS_PER_VARIANT / 2);
  });
});
