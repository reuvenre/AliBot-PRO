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

  /** Service with only the collaborators keywordsFor touches.
   *  `soldPools` = pool ids the "did this pool sell?" query reports orders for; `null`
   *  makes that query blow up, which is how the caller's resilience gets tested. */
  function serviceWith(rows: any[], allowed = true, soldPools: string[] | null = []) {
    const repo: any = {
      find: async () => rows,
      query: soldPools === null
        ? undefined // no query method at all — the shape a broken/absent driver has
        : async () => rows.map((r) => ({ id: r.id, orders: soldPools.includes(r.id) ? 2 : 0 })),
    };
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

  it('steers NOTHING when no target was chosen', async () => {
    // This used to be "applies to every campaign", and that default is what put kitchen
    // organisers into a tactical channel — boosted, taking the cycle's best slots — with
    // nothing misconfigured. An unaimed pool is a record of money available, not an
    // instruction to chase it everywhere. See pool-targets.ts.
    const svc = serviceWith([row({ target_campaigns: null })]);
    expect((await svc.keywordsFor(USER, TACTICAL)).keywords).toEqual([]);
    expect((await svc.keywordsFor(USER, MAMA)).keywords).toEqual([]);
  });

  it('still fans out across every campaign when the owner says so', async () => {
    const svc = serviceWith([row({ target_campaigns: JSON.stringify(['*']) })]);
    expect((await svc.keywordsFor(USER, TACTICAL)).keywords).toHaveLength(2);
    expect((await svc.keywordsFor(USER, MAMA)).keywords).toHaveLength(2);
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

  describe('pools that have already sold', () => {
    it('marks every keyword of a pool with orders — the pool is what proved itself', async () => {
      // Including keywords that have not sold individually: the bonus is paid on the
      // pool's categories, and the rotation gives them its top tier.
      const svc = serviceWith([row()], true, ['p1']);
      const res = await svc.keywordsFor(USER, MAMA);
      expect(res.proven).toEqual(['storage box', 'kitchen organizer']);
    });

    it('marks only the pool that sold, not its neighbours', async () => {
      const svc = serviceWith([
        row(),
        row({ id: 'p2', name: 'Toy Pool', keywords_json: JSON.stringify(['kids toys']) }),
      ], true, ['p2']);
      const res = await svc.keywordsFor(USER, MAMA);
      expect(res.proven).toEqual(['kids toys']);
      // The unproven pool keeps its ordinary place in the rotation, it is not dropped.
      expect(res.keywords).toContain('storage box');
    });

    it('leaves proven empty when no pool has sold yet', async () => {
      const svc = serviceWith([row()], true, []);
      expect((await svc.keywordsFor(USER, MAMA)).proven).toEqual([]);
    });

    it('KEEPS the keywords when the sold-pool lookup fails', async () => {
      // Knowing which pool sold is an enhancement; the keywords are the feature. A throw
      // here used to land in the caller's catch and wipe the whole bonus rotation.
      const svc = serviceWith([row()], true, null);
      const res = await svc.keywordsFor(USER, MAMA);
      expect(res.keywords).toEqual(['storage box', 'kitchen organizer']);
      expect(res.proven).toEqual([]);
    });
  });
});
