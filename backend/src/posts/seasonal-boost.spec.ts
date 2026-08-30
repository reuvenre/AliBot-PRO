import {
  MAX_SEASONAL_POSTS_PER_RUN, SEASONAL_EXTRA_POSTS_PER_RUN, seasonalPostsPerRun,
} from './seasonal-boost';
import { weightedRotation } from './keyword-rotation';

describe('seasonalPostsPerRun — the holiday buys one more post', () => {
  it('adds the seasonal slot while a window is open', () => {
    expect(seasonalPostsPerRun(2, true)).toBe(2 + SEASONAL_EXTRA_POSTS_PER_RUN);
    expect(seasonalPostsPerRun(1, true)).toBe(1 + SEASONAL_EXTRA_POSTS_PER_RUN);
  });

  it('changes nothing when no window is open', () => {
    expect(seasonalPostsPerRun(2, false)).toBe(2);
    expect(seasonalPostsPerRun(5, false)).toBe(5);
  });

  it('stops at the ceiling — a heavy campaign needs the group readable more than one more post', () => {
    expect(seasonalPostsPerRun(MAX_SEASONAL_POSTS_PER_RUN, true)).toBe(MAX_SEASONAL_POSTS_PER_RUN);
    expect(seasonalPostsPerRun(20, true)).toBe(20);   // already above the ceiling: left alone
  });

  it('never returns less than one post, whatever the row holds', () => {
    expect(seasonalPostsPerRun(0, false)).toBe(1);
    expect(seasonalPostsPerRun(-3, true)).toBe(1 + SEASONAL_EXTRA_POSTS_PER_RUN);
    expect(seasonalPostsPerRun(NaN, false)).toBe(1);
  });
});

describe('seasonal keywords in the rotation', () => {
  const own = ['ציוד טקטי', 'פנסים', 'סכיני כיס'];
  const seasonal = ['מתנות לחג'];

  it('gives a holiday keyword more of the cycle than an unproven one', () => {
    const plain = weightedRotation([...own, ...seasonal], new Map());
    const boosted = weightedRotation([...own, ...seasonal], new Map(), new Set(seasonal));
    const share = (list: string[]) => list.filter((k) => k === 'מתנות לחג').length;
    expect(share(boosted)).toBeGreaterThan(share(plain));
  });

  it('is emphasis, not a takeover — every other keyword keeps its slot', () => {
    const boosted = weightedRotation([...own, ...seasonal], new Map(), new Set(seasonal));
    for (const kw of own) expect(boosted).toContain(kw);
  });

  it('never outranks a keyword that actually earns', () => {
    const perf = new Map([['פנסים', { posts: 20, clicks: 40, revenue: 120 }]]);
    const boosted = weightedRotation([...own, ...seasonal], perf, new Set(seasonal));
    const count = (k: string) => boosted.filter((x) => x === k).length;
    expect(count('פנסים')).toBeGreaterThan(count('מתנות לחג'));
  });
});
