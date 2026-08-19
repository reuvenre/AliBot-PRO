import { IncentiveService } from './incentive.service';

/**
 * The contract the autopilot depends on: WHICH bonus keywords a campaign gets, and when.
 *
 * This is the whole point of the feature — a pool that pays extra only pays while it is
 * live, and only for the campaigns the owner pointed it at. Getting any of these wrong is
 * silent: the campaign keeps publishing, just not what earns the bonus.
 */
describe('IncentiveService.keywordsFor', () => {
  const USER = 'u1';
  const MAMA = 'c1000000-0000-4000-8000-000000000001';
  const TACTICAL = 'c1000000-0000-4000-8000-000000000002';
  const GROUP = '-1002667847653';

  const day = 86_400_000;
  const row = (over: Partial<any> = {}) => ({
    id: 'p1', user_id: USER, name: 'Home & Living Pool',
    keywords_json: JSON.stringify(['storage box', 'kitchen organizer']),
    target_campaigns: JSON.stringify([MAMA]),
    starts_at: new Date(Date.now() - day),
    ends_at: new Date(Date.now() + day),
    active: true,
    ...over,
  });

  /** Service with only the collaborators keywordsFor touches. */
  function serviceWith(rows: any[], allowed = true) {
    const repo: any = { find: async () => rows };
    const subscription: any = { allows: async () => allowed };
    return new IncentiveService(
      repo, null as any, null as any, null as any, null as any, null as any, subscription, null as any,
    );
  }

  it('gives a targeted campaign the pool keywords while the window is open', async () => {
    const svc = serviceWith([row()]);
    const res = await svc.keywordsFor(USER, MAMA);
    expect(res.keywords).toEqual(['storage box', 'kitchen organizer']);
    expect(res.names).toEqual(['Home & Living Pool']);
  });

  it('gives nothing to a campaign the pool does not target', async () => {
    // Brand safety: a Home & Living bonus must never push kitchen gear into a tactical channel.
    const svc = serviceWith([row()]);
    expect((await svc.keywordsFor(USER, TACTICAL)).keywords).toEqual([]);
  });

  it('applies to every campaign when no target was chosen', async () => {
    const svc = serviceWith([row({ target_campaigns: null })]);
    expect((await svc.keywordsFor(USER, TACTICAL)).keywords).toHaveLength(2);
  });

  it('stops by itself once the window closes', async () => {
    const svc = serviceWith([row({
      starts_at: new Date(Date.now() - 40 * day), ends_at: new Date(Date.now() - day),
    })]);
    expect((await svc.keywordsFor(USER, MAMA)).keywords).toEqual([]);
  });

  it('ignores a pool that has not started yet', async () => {
    const svc = serviceWith([row({ starts_at: new Date(Date.now() + day) })]);
    expect((await svc.keywordsFor(USER, MAMA)).keywords).toEqual([]);
  });

  it('honours the owner switch', async () => {
    const svc = serviceWith([row({ active: false })]);
    expect((await svc.keywordsFor(USER, MAMA)).keywords).toEqual([]);
  });

  it('steers nothing below the Autopilot tier', async () => {
    // The plan gate must bite HERE, not in the UI — the rotation is server-side.
    const svc = serviceWith([row()], false);
    expect((await svc.keywordsFor(USER, MAMA)).keywords).toEqual([]);
  });

  it('still matches a row saved with the old GROUP-id picker', async () => {
    // Legacy tolerance: rows written by the first version of the screen hold Telegram
    // group ids. They must keep steering the campaigns publishing to those groups
    // instead of silently matching nothing.
    const svc = serviceWith([row({ target_campaigns: JSON.stringify([GROUP]) })]);
    expect((await svc.keywordsFor(USER, MAMA, [GROUP])).keywords).toHaveLength(2);
    expect((await svc.keywordsFor(USER, MAMA, [])).keywords).toEqual([]);
  });

  it('merges several live pools without duplicating a shared keyword', async () => {
    const svc = serviceWith([
      row(),
      row({ id: 'p2', name: 'Toy Pool', keywords_json: JSON.stringify(['storage box', 'kids toys']) }),
    ]);
    const res = await svc.keywordsFor(USER, MAMA);
    expect(res.keywords).toEqual(['storage box', 'kitchen organizer', 'kids toys']);
    expect(res.names).toEqual(['Home & Living Pool', 'Toy Pool']);
  });
});
