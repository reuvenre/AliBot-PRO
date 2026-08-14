import { PostsService } from './posts.service';

/**
 * Regression: pasting several product links (smart intake) scheduled them all onto the
 * SAME minute. The slot query keeps only the MAX pending per campaign, and once one
 * intake booked beyond the pacing horizon it shadowed the nearer booking — the group
 * looked free and every further paste stacked onto the first slot. Intake now chains
 * one interval behind the group's furthest FUTURE booking (intakeNotBefore).
 */
describe('PostsService.intakeNotBefore — smart-intake slot chaining', () => {
  const MIN = 60_000;
  const now = 1_700_000_000_000;

  it('starts one interval after the furthest future booking', () => {
    const furthest = new Date(now + 2 * 60 * MIN); // two hours of pasted products already booked
    const nb = PostsService.intakeNotBefore(furthest, 60, now);
    expect(nb.getTime()).toBe(furthest.getTime() + 60 * MIN);
  });

  it('starts now when the calendar ahead is clear', () => {
    expect(PostsService.intakeNotBefore(null, 60, now).getTime()).toBe(now);
  });

  it('ignores an overdue past booking (backlog is the pacing gate, not the chain)', () => {
    const overdue = new Date(now - 10 * MIN);
    expect(PostsService.intakeNotBefore(overdue, 60, now).getTime()).toBe(now);
  });

  it('respects the group interval, not a fixed hour', () => {
    const furthest = new Date(now + 30 * MIN);
    const nb = PostsService.intakeNotBefore(furthest, 180, now);
    expect(nb.getTime()).toBe(furthest.getTime() + 180 * MIN);
  });
});

describe('PostsService.nextGroupSlot — honors a future notBefore', () => {
  const GROUP = '-1002382502297';
  const MINE = '788c076d-a31a-4c22-a932-dffadd51186b';
  const MIN = 60_000;

  function serviceWith(rows: any[], intervalMin = 60) {
    const qb: any = new Proxy({}, {
      get: (_t, prop) => (prop === 'getRawMany' ? async () => rows : () => qb),
    });
    const repo: any = { createQueryBuilder: () => qb };
    const channels: any = {
      getIntervalMinutes: async () => intervalMin,
      getScheduleWindow: async () => ({ startHour: 0, endHour: 24 }),
    };
    const credentials: any = { getRaw: async () => null };
    return new PostsService(
      repo, null as any, null as any, null as any,
      null as any,
      credentials, null as any, null as any, null as any,
      channels, null as any, null as any, null as any, null as any,
      null as any,
    );
  }

  it('never books before notBefore even when the group looks free', async () => {
    // The heart of the stacking bug: bookings beyond the horizon left the rows empty,
    // so a "free" group booked at notBefore — chaining works only if that is honored.
    const now = Date.now();
    const notBefore = new Date(now + 3 * 60 * MIN);
    const svc = serviceWith([]);
    const { slot, skip } = await svc.nextGroupSlot('u1', GROUP, notBefore, MINE);
    expect(skip).toBe(false);
    expect(slot.getTime()).toBe(notBefore.getTime());
  });
});
