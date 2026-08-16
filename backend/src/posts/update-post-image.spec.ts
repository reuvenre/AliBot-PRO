import { PostsService } from './posts.service';

/**
 * Regression: editing a post's MAIN image did nothing visible on posts that carry an
 * album — the publish path sends gallery_json and treats product_image as a fallback
 * (prepareTelegramMedia), so the freshly uploaded photo never appeared anywhere.
 * A changed main image must lead the album; everything else about the album survives.
 */
describe('PostsService.updatePost — main image vs album', () => {
  function serviceWith(post: any) {
    const repo: any = {
      findOne: async () => post,
      save: async (p: any) => p,
    };
    // Positional collaborators mirror the real constructor; updatePost touches only repo.
    return new PostsService(
      repo, null as any, null as any, null as any,
      null as any, null as any, null as any, null as any, null as any,
      null as any, null as any, null as any, null as any, null as any,
      null as any,
      null as any, // incentive
    );
  }

  const basePost = () => ({
    id: 'p1', user_id: 'u1', status: 'queued', generated_text: 'טקסט',
    product_image: 'https://cdn/a.jpg',
    gallery_json: JSON.stringify(['https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg']),
  });

  it('puts a new main image at the head of the album and drops the old one', async () => {
    const post = basePost();
    const svc = serviceWith(post);
    const saved = await svc.updatePost('u1', 'p1', { product_image: 'https://cdn/new.jpg' });
    expect(saved.product_image).toBe('https://cdn/new.jpg');
    expect(JSON.parse(saved.gallery_json)).toEqual([
      'https://cdn/new.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg',
    ]);
  });

  it('leaves the album untouched when the main image did not change', async () => {
    // The editor sends product_image on EVERY save — a no-op edit must not reorder.
    const post = basePost();
    const svc = serviceWith(post);
    const saved = await svc.updatePost('u1', 'p1', { product_image: 'https://cdn/a.jpg', text: 'חדש' });
    expect(JSON.parse(saved.gallery_json)).toEqual([
      'https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg',
    ]);
  });

  it('does not duplicate an image that is already in the album', async () => {
    const post = basePost();
    const svc = serviceWith(post);
    const saved = await svc.updatePost('u1', 'p1', { product_image: 'https://cdn/b.jpg' });
    expect(JSON.parse(saved.gallery_json)).toEqual([
      'https://cdn/b.jpg', 'https://cdn/c.jpg',
    ]);
  });

  it('yields to an explicit gallery selection (the FLYLINK editor owns the album)', async () => {
    const post = basePost();
    const svc = serviceWith(post);
    const saved = await svc.updatePost('u1', 'p1', {
      product_image: 'https://cdn/x.jpg',
      gallery: ['https://cdn/x.jpg', 'https://cdn/y.jpg'],
    });
    expect(saved.product_image).toBe('https://cdn/x.jpg');
    expect(JSON.parse(saved.gallery_json)).toEqual(['https://cdn/x.jpg', 'https://cdn/y.jpg']);
  });

  it('simply swaps the main image on a post with no album', async () => {
    const post = { ...basePost(), gallery_json: null };
    const svc = serviceWith(post);
    const saved = await svc.updatePost('u1', 'p1', { product_image: 'https://cdn/new.jpg' });
    expect(saved.product_image).toBe('https://cdn/new.jpg');
    expect(saved.gallery_json).toBeNull();
  });
});
