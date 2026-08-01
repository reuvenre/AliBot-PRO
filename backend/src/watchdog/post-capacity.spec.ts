import {
  CampaignCadence, detectCapacityShortfalls, maxPostsPerCycle, requiredGroupInterval,
  shortfallLine,
} from './post-capacity';

const row = (over: Partial<CampaignCadence> = {}): CampaignCadence => ({
  campaignId: 'c1',
  campaignName: 'טקטי בקליק',
  userId: 'u1',
  groupId: 'g1',
  groupName: 'טקטי בקליק',
  postsPerRun: 2,
  cycleMinutes: 180,     // every 3 hours
  groupIntervalMinutes: 60,
  ...over,
});

describe('maxPostsPerCycle', () => {
  it('counts the slots that fit strictly inside the cycle', () => {
    // Posts land at 0, 60, 120 minutes — all before the next run at 180.
    expect(maxPostsPerCycle(180, 60)).toBe(3);
    expect(maxPostsPerCycle(180, 90)).toBe(2);
  });

  it('gives exactly one when the group is as slow as the cycle', () => {
    // The second post would land ON the next run, and the scheduler requires strictly
    // before it — this is the case that made "2 posts per run" deliver one.
    expect(maxPostsPerCycle(180, 180)).toBe(1);
    expect(maxPostsPerCycle(60, 60)).toBe(1);
  });

  it('gives one when the group is slower than the cycle', () => {
    expect(maxPostsPerCycle(60, 180)).toBe(1);
  });

  it('rounds up a cycle the interval does not divide evenly', () => {
    // 0, 50, 100, 150 all fit under 180 → 4.
    expect(maxPostsPerCycle(180, 50)).toBe(4);
  });

  it('claims nothing on unusable numbers, and never returns zero', () => {
    for (const [cycle, interval] of [[0, 60], [180, 0], [-180, 60], [NaN, 60], [180, NaN]]) {
      expect(maxPostsPerCycle(cycle, interval)).toBe(1);
    }
  });

  /**
   * Pinned against the scheduler's own rule: it books post i at i × interval and requires
   * that to fall strictly before the cycle end. A watchdog that is wrong about the system's
   * behaviour is worse than no watchdog, so the two are checked case by case.
   */
  it('agrees with the scheduler post by post', () => {
    const schedulerFits = (cycle: number, interval: number) => {
      let n = 0;
      while (n * interval < cycle) n++;
      return n;
    };
    for (const cycle of [30, 60, 90, 120, 180, 240, 360, 720, 1440]) {
      for (const interval of [15, 30, 45, 60, 90, 120, 180, 240]) {
        expect(maxPostsPerCycle(cycle, interval)).toBe(schedulerFits(cycle, interval));
      }
    }
  });
});

describe('detectCapacityShortfalls', () => {
  it('reports a campaign asking for more than the group can carry', () => {
    // 2 per run, but the group only allows one post every 3 hours.
    const [s] = detectCapacityShortfalls([row({ groupIntervalMinutes: 180 })]);
    expect(s).toMatchObject({ campaignId: 'c1', postsPerRun: 2, maxPostsPerCycle: 1 });
  });

  it('stays quiet when every post fits', () => {
    // 2 per run on a 3-hour cycle with a 60-minute group: 09:00 and 10:00 both land.
    expect(detectCapacityShortfalls([row()])).toEqual([]);
  });

  it('stays quiet for a campaign that promised nothing', () => {
    // One post per run cannot fall short of itself.
    expect(detectCapacityShortfalls([row({ postsPerRun: 1, groupIntervalMinutes: 999 })]))
      .toEqual([]);
  });

  it('ranks the widest gap first', () => {
    const out = detectCapacityShortfalls([
      row({ campaignId: 'small', postsPerRun: 2, groupIntervalMinutes: 180 }),   // gap 1
      row({ campaignId: 'wide', postsPerRun: 6, groupIntervalMinutes: 180 }),    // gap 5
    ]);
    expect(out.map((s) => s.campaignId)).toEqual(['wide', 'small']);
  });

  it('survives empty and malformed input', () => {
    expect(detectCapacityShortfalls([])).toEqual([]);
    expect(detectCapacityShortfalls(undefined as any)).toEqual([]);
    expect(detectCapacityShortfalls([null as any, { campaignId: '' } as any])).toEqual([]);
    expect(detectCapacityShortfalls([row({ postsPerRun: NaN })])).toEqual([]);
  });
});

describe('requiredGroupInterval', () => {
  it('names an interval that actually delivers the asked-for count', () => {
    const needed = requiredGroupInterval(180, 2);
    expect(needed).toBe(90);
    // The advice has to be true: at that interval the campaign really does get 2.
    expect(maxPostsPerCycle(180, needed)).toBeGreaterThanOrEqual(2);
  });

  it('holds for every count a campaign might ask for', () => {
    for (const cycle of [60, 120, 180, 240, 360]) {
      for (const posts of [2, 3, 4, 5]) {
        const needed = requiredGroupInterval(cycle, posts);
        if (needed > 0) expect(maxPostsPerCycle(cycle, needed)).toBeGreaterThanOrEqual(posts);
      }
    }
  });

  it('has nothing to advise on a single post or unusable numbers', () => {
    expect(requiredGroupInterval(180, 1)).toBe(0);
    expect(requiredGroupInterval(0, 3)).toBe(0);
    expect(requiredGroupInterval(NaN, 3)).toBe(0);
  });
});

describe('shortfallLine', () => {
  it('states what was asked, what arrives, and the fix', () => {
    const [s] = detectCapacityShortfalls([row({ groupIntervalMinutes: 180 })]);
    const line = shortfallLine(s);
    expect(line).toContain('טקטי בקליק');
    expect(line).toContain('2 פוסטים לריצה');
    expect(line).toContain('בפועל יוצא 1');
    expect(line).toContain('90 דק');
  });
});
