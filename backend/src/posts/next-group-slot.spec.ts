import { PostsService } from './posts.service';

/**
 * Regression tests for nextGroupSlot's pacing gate.
 *
 * Both cases below caused the same production symptom — an hourly campaign publishing
 * roughly every 2 hours, or going silent for hours — and neither raised an error, which is
 * exactly why they need locking down here rather than being left to the watchdog.
 */
describe('PostsService.nextGroupSlot', () => {
  const GROUP = '-1002382502297';
  const MINE = '788c076d-a31a-4c22-a932-dffadd51186b';
  const SIBLING = 'f0000000-0000-4000-8000-000000000000';
  const MIN = 60_000;

  /** Build a service with only the collaborators nextGroupSlot actually touches. */
  function serviceWith(rows: any[], intervalMin = 60) {
    const qb: any = new Proxy({}, {
      get: (_t, prop) => (prop === 'getRawMany' ? async () => rows : () => qb),
    });
    const repo: any = { createQueryBuilder: () => qb };
    const channels: any = {
      getIntervalMinutes: async () => intervalMin,
      // Window wide open, so these tests isolate the pacing decision from the send window.
      getScheduleWindow: async () => ({ startHour: 0, endHour: 24 }),
    };
    const credentials: any = { getRaw: async () => null };

    return new PostsService(
      repo, null as any, null as any, null as any,
      credentials, null as any, null as any, null as any,
      channels, null as any, null as any, null as any, null as any,
    );
  }

  const iso = (ms: number) => new Date(ms).toISOString();

  it('lets the campaign post when a manual post landed just before it', async () => {
    // The reported bug: a manual post sent 32s before the campaign's own post made the
    // campaign yield its next run to a "sibling" with no cadence, halving its rate.
    const now = Date.now();
    const svc = serviceWith([
      { campaign_id: MINE, pending: null, sent: iso(now - 59 * MIN) },
      { campaign_id: null, pending: null, sent: iso(now - 59 * MIN - 32_000) },
    ]);

    const { skip } = await svc.nextGroupSlot('u1', GROUP, new Date(now), MINE);
    expect(skip).toBe(false);
  });

  it('ignores a post scheduled far beyond the current interval', async () => {
    // A manual announcement queued for tonight must not mark the group busy all afternoon.
    const now = Date.now();
    const svc = serviceWith([
      { campaign_id: null, pending: iso(now + 4 * 60 * MIN), sent: null },
    ]);

    const { skip } = await svc.nextGroupSlot('u1', GROUP, new Date(now), MINE);
    expect(skip).toBe(false);
  });

  it('still treats a post booked inside the interval as busy', async () => {
    // Back-pressure must survive the horizon fix: re-spaced backlog lands one interval out.
    const now = Date.now();
    const svc = serviceWith([
      { campaign_id: null, pending: iso(now + 30 * MIN), sent: null },
    ]);

    const { skip } = await svc.nextGroupSlot('u1', GROUP, new Date(now), MINE);
    expect(skip).toBe(true);
  });

  it('still yields the slot to a campaign that is further behind', async () => {
    // Fair-share between real campaigns is the behaviour we want to keep.
    const now = Date.now();
    const svc = serviceWith([
      { campaign_id: MINE, pending: null, sent: iso(now - 59 * MIN) },
      { campaign_id: SIBLING, pending: null, sent: iso(now - 3 * 60 * MIN) },
    ]);

    const { skip } = await svc.nextGroupSlot('u1', GROUP, new Date(now), MINE);
    expect(skip).toBe(true);
  });
});
