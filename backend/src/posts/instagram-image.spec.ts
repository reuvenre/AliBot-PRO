import {
  IG_MAX_RATIO, IG_MIN_RATIO, igFetchHeaders, igFitBox, isIgFittableHost, unwrapOwnProxy,
} from './instagram-image';

describe('igFitBox', () => {
  it('leaves legal ratios untouched', () => {
    // Square, 4:5 portrait and 1.91:1 landscape are all inside Instagram's range.
    expect(igFitBox(1000, 1000)).toBeNull();
    expect(igFitBox(1080, 1350)).toBeNull();
    expect(igFitBox(1910, 1000)).toBeNull();
  });

  it('letterboxes a tall fashion shot onto the 4:5 canvas', () => {
    // 3:4 (0.75) is the classic supplier clothing photo — and the exact shape that
    // failed mama's first working Instagram night with #36003.
    expect(igFitBox(900, 1200)).toEqual({ width: 1080, height: 1350 });
    expect(igFitBox(1080, 1920)).toEqual({ width: 1080, height: 1350 });
  });

  it('letterboxes a banner crop onto the landscape canvas', () => {
    const box = igFitBox(2400, 1000)!;
    expect(box).toEqual({ width: 1080, height: 566 });
    // The canvas itself must be legal, or the pad step would reproduce the rejection.
    expect(box.width / box.height).toBeLessThanOrEqual(IG_MAX_RATIO);
  });

  it('the portrait canvas itself is legal too', () => {
    expect(1080 / 1350).toBeGreaterThanOrEqual(IG_MIN_RATIO);
  });

  it('makes no claim when the dimensions are unknown', () => {
    // Publishing the original and letting Instagram judge beats padding a maybe-fine image.
    expect(igFitBox(undefined, 1000)).toBeNull();
    expect(igFitBox(1000, 0)).toBeNull();
    expect(igFitBox(null, null)).toBeNull();
  });
});

describe('unwrapOwnProxy', () => {
  it('unwraps a Yupoo-proxied URL back to the upstream image', () => {
    const inner = 'https://photo.yupoo.com/store/abc.jpg';
    const wrapped = `https://nexlify.example.com/suppliers/image?url=${encodeURIComponent(inner)}`;
    expect(unwrapOwnProxy(wrapped)).toBe(inner);
  });

  it('returns anything else untouched', () => {
    expect(unwrapOwnProxy('https://ae01.alicdn.com/kf/x.jpg')).toBe('https://ae01.alicdn.com/kf/x.jpg');
    expect(unwrapOwnProxy('not a url')).toBe('not a url');
  });
});

describe('isIgFittableHost', () => {
  it('allows exactly the product-image CDNs the system publishes', () => {
    for (const h of ['photo.yupoo.com', 'ae01.alicdn.com', 'ae-pic-a1.aliexpress-media.com']) {
      expect(isIgFittableHost(h)).toBe(true);
    }
  });

  it('refuses everything else — this backs a PUBLIC endpoint', () => {
    // An open fetcher here would be an SSRF service with our egress.
    for (const h of ['evil.com', 'yupoo.com.evil.com', 'localhost', '169.254.169.254']) {
      expect(isIgFittableHost(h)).toBe(false);
    }
  });
});

describe('igFetchHeaders', () => {
  it('sends the hotlink Referer only to Yupoo', () => {
    expect(igFetchHeaders('photo.yupoo.com').Referer).toBe('https://x.yupoo.com/');
    expect(igFetchHeaders('ae01.alicdn.com').Referer).toBeUndefined();
  });
});
