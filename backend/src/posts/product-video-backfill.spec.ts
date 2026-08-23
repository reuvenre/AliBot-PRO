import { PostsService } from './posts.service';

/**
 * Regression: "prefer the product video" was honoured only by posts CREATED after the
 * feature shipped and only through the campaign/queue path. A post published by hand, by
 * an agent run, or already waiting in the queue carried product_video NULL — so the
 * toggle found nothing to send and the image went out, on products that plainly have a
 * clip. The send path now resolves a missing clip once and persists it on the row.
 */
describe('PostsService.ensureProductVideo — the clip a queued post never had', () => {
  function serviceWith(updates: any[], detail: (id: string) => any) {
    const repo: any = {
      update: async (where: any, patch: any) => { updates.push({ where, patch }); },
    };
    const svc = new PostsService(
      repo, null as any, null as any, null as any,
      null as any, null as any, null as any, null as any, null as any,
      null as any, null as any, null as any, null as any, null as any,
      null as any,
      null as any, // incentive
    );
    // The affiliate lookup is the only collaborator this path uses.
    (svc as any).productDetailById = async (id: string) => detail(id);
    return svc;
  }

  const creds = { prefer_product_video: true } as any;
  const call = (svc: any, post: any, c: any = creds) => (svc as any).ensureProductVideo(post, c);

  it('fills in the clip for a post that was queued before the toggle existed', async () => {
    const updates: any[] = [];
    const svc = serviceWith(updates, () => ({ video_url: 'https://video/x.mp4' }));
    const post: any = { id: 'p1', product_id: '1005006', product_video: null };

    await call(svc, post);

    expect(post.product_video).toBe('https://video/x.mp4');
    // Persisted, so the next group in the fan-out doesn't look it up again.
    expect(updates).toEqual([{ where: { id: 'p1' }, patch: { product_video: 'https://video/x.mp4' } }]);
  });

  it('leaves a post that already has its clip untouched — no second lookup', async () => {
    const updates: any[] = [];
    let lookups = 0;
    const svc = serviceWith(updates, () => { lookups++; return { video_url: 'https://video/other.mp4' }; });
    const post: any = { id: 'p1', product_id: '1005006', product_video: 'https://video/kept.mp4' };

    await call(svc, post);

    expect(post.product_video).toBe('https://video/kept.mp4');
    expect(lookups).toBe(0);
    expect(updates).toEqual([]);
  });

  it('does nothing at all when the account did not opt in', async () => {
    const updates: any[] = [];
    let lookups = 0;
    const svc = serviceWith(updates, () => { lookups++; return { video_url: 'https://video/x.mp4' }; });
    const post: any = { id: 'p1', product_id: '1005006', product_video: null };

    await call(svc, post, { prefer_product_video: false } as any);

    expect(post.product_video).toBeNull();
    expect(lookups).toBe(0);
  });

  it('asks once for a product with no clip, then stops asking', async () => {
    // Most products have no video. Re-asking on every fan-out leg would spend an
    // AliExpress call per group, and a throttled call costs seconds on the send path.
    const updates: any[] = [];
    let lookups = 0;
    const svc = serviceWith(updates, () => { lookups++; return { video_url: undefined }; });

    await call(svc, { id: 'p1', product_id: '1005007', product_video: null });
    await call(svc, { id: 'p2', product_id: '1005007', product_video: null });
    await call(svc, { id: 'p3', product_id: '1005007', product_video: null });

    expect(lookups).toBe(1);
    expect(updates).toEqual([]);
  });

  it('never calls the affiliate API for a supplier sku — it has no entry there', async () => {
    let lookups = 0;
    const svc = serviceWith([], () => { lookups++; return { video_url: 'https://video/x.mp4' }; });
    const post: any = { id: 'p1', product_id: 'LUN714', product_video: null };

    await call(svc, post);

    expect(lookups).toBe(0);
    expect(post.product_video).toBeNull();
  });

  it('publishes anyway when the lookup itself fails', async () => {
    // A clip is a nice-to-have; a failed lookup must not throw inside the send path.
    const svc = serviceWith([], () => { throw new Error('App Call Limited'); });
    const post: any = { id: 'p1', product_id: '1005008', product_video: null };

    await expect(call(svc, post)).resolves.toBeUndefined();
    expect(post.product_video).toBeNull();
  });
});
