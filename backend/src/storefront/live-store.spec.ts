import { StorefrontService } from './storefront.service';

/**
 * Which posts carry the store's address.
 *
 * Two switches, two different questions: `enabled` is whether the shop exists at all,
 * `link_in_posts` is whether the channels advertise it. The publish path has to respect
 * both, and the owner has to be able to answer them separately — turning the shop off to
 * get clean posts would also break every address already printed in older posts.
 */
describe('liveStore', () => {
  const service = (row: any) => {
    const repo = { findOne: jest.fn().mockResolvedValue(row) } as any;
    const svc = new StorefrontService(repo, {} as any, {} as any);
    return { svc, repo };
  };

  const OLD_FRONTEND = process.env.FRONTEND_URL;
  beforeAll(() => { process.env.FRONTEND_URL = 'https://nexlify.win-solutions.co.il'; });
  afterAll(() => { process.env.FRONTEND_URL = OLD_FRONTEND; });

  it('links a live store the owner wants advertised', async () => {
    const { svc } = service({ slug: 'hidden-premium-brands', name: 'Hidden Premium Brands' });
    await expect(svc.liveStore('u1')).resolves.toEqual({
      url: 'https://nexlify.win-solutions.co.il/s/hidden-premium-brands',
      name: 'Hidden Premium Brands',
    });
  });

  it('asks the database for both switches, not just for the store', async () => {
    const { svc, repo } = service(null);
    await svc.liveStore('u1');
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { user_id: 'u1', enabled: true, link_in_posts: true },
    });
  });

  it('goes quiet when there is no store at all', async () => {
    const { svc } = service(null);
    await expect(svc.liveStore('u1')).resolves.toBeNull();
  });

  it('never prints a relative address into a Telegram message', async () => {
    process.env.FRONTEND_URL = '';
    const { svc } = service({ slug: 'shop', name: 'Shop' });
    await expect(svc.liveStore('u1')).resolves.toBeNull();
    process.env.FRONTEND_URL = 'https://nexlify.win-solutions.co.il';
  });
});
