import { PostsService } from './posts.service';

/**
 * Regression: "צור מחדש עם AI" in the post editor rewrote the OLD product — it generated
 * from the title text alone, so a freshly uploaded photo (and a thin Hebrew title) changed
 * nothing. regenerateForPost must ground the generation in the CURRENT edited fields:
 * the edited main image leads the vision photos and the edited title rides as the hint.
 */
describe('PostsService.regenerateForPost', () => {
  const POST = {
    id: 'p1', user_id: 'u1', product_id: '100200300',
    product_title: 'Airsoft Smoke M67 Grenade Model',
    product_image: 'https://cdn.alicdn.com/old-grenade.jpg',
    affiliate_url: 'https://s.click.aliexpress.com/e/_abc',
    price_ils: 12.5,
    gallery_json: JSON.stringify([
      'https://cdn.alicdn.com/old-grenade.jpg',
      'https://cdn.alicdn.com/album-2.jpg',
    ]),
  };

  function serviceWith(post: any) {
    const repo: any = { findOne: async () => post };
    const svc = new PostsService(
      repo, null as any, null as any, null as any,
      null as any, null as any, null as any, null as any, null as any,
      null as any, null as any, null as any, null as any, null as any,
      null as any,
      null as any, // incentive
    );
    return svc as any;
  }

  it('generates from the edited title and image, vision-first on the new photo', async () => {
    const svc = serviceWith(POST);
    const fetched: string[][] = [];
    svc.fetchVisionImages = async (urls: string[]) => {
      fetched.push(urls);
      return [{ mime: 'image/jpeg', data: 'base64photo' }];
    };
    svc.preview = jest.fn().mockResolvedValue({ generated_text: 'טקסט חדש' });

    const res = await svc.regenerateForPost('u1', 'p1', {
      title: 'ידיות הסתערות',
      image_url: 'https://backend/posts/uploaded/new-grip.jpg',
      price_ils: 0.46,
    });

    expect(res.generated_text).toBe('טקסט חדש');
    // The edited main image must be the FIRST vision photo; the old album follows.
    expect(fetched[0][0]).toBe('https://backend/posts/uploaded/new-grip.jpg');
    expect(fetched[0]).toContain('https://cdn.alicdn.com/album-2.jpg');

    const [, , , product, , images, hint, forceVision] = svc.preview.mock.calls[0];
    expect(product.title).toBe('ידיות הסתערות');
    expect(product.image_url).toBe('https://backend/posts/uploaded/new-grip.jpg');
    expect(product.sale_price).toBe(0.46);
    expect(product.currency).toBe('ILS');
    expect(images).toHaveLength(1);
    expect(hint).toBe('ידיות הסתערות');
    expect(forceVision).toBe(true);
  });

  it('falls back to the stored post fields when the editor sends nothing new', async () => {
    const svc = serviceWith(POST);
    svc.fetchVisionImages = async () => [];
    svc.preview = jest.fn().mockResolvedValue({ generated_text: 'ok' });

    await svc.regenerateForPost('u1', 'p1', {});

    const [, , , product, , images, hint, forceVision] = svc.preview.mock.calls[0];
    expect(product.title).toBe(POST.product_title);
    expect(product.image_url).toBe(POST.product_image);
    expect(product.sale_price).toBe(12.5);
    expect(images).toEqual([]);
    expect(hint).toBe(POST.product_title);
    // No photos fetched → vision must not be forced on.
    expect(forceVision).toBe(false);
  });

  it('rejects a post that belongs to someone else', async () => {
    const svc = serviceWith(null);
    await expect(svc.regenerateForPost('intruder', 'p1', {})).rejects.toThrow('פוסט לא נמצא');
  });
});
