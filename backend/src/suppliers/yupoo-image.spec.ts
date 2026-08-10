import { dedupeProductImages, yupooPhotoKey, yupooSizeRank } from './yupoo-image';

describe('yupooPhotoKey', () => {
  it('identifies a photo by store+id, ignoring the size rendition', () => {
    expect(yupooPhotoKey('https://photo.yupoo.com/lunastore/abc123/big.jpg'))
      .toBe(yupooPhotoKey('https://photo.yupoo.com/lunastore/abc123/medium.jpg'));
  });

  it('ignores scheme and query string', () => {
    expect(yupooPhotoKey('http://photo.yupoo.com/s/x1/small.jpg?w=200'))
      .toBe(yupooPhotoKey('https://photo.yupoo.com/s/x1/big.jpg'));
  });

  it('keeps different photos apart', () => {
    expect(yupooPhotoKey('https://photo.yupoo.com/s/aaa/big.jpg'))
      .not.toBe(yupooPhotoKey('https://photo.yupoo.com/s/bbb/big.jpg'));
  });

  it('treats a non-Yupoo URL as its own identity', () => {
    const u = 'https://ae01.alicdn.com/kf/S123.jpg';
    expect(yupooPhotoKey(u)).toBe(u);
  });
});

describe('yupooSizeRank', () => {
  it('ranks renditions sharpest-first', () => {
    expect(yupooSizeRank('https://photo.yupoo.com/s/x/big.jpg'))
      .toBeGreaterThan(yupooSizeRank('https://photo.yupoo.com/s/x/medium.jpg'));
    expect(yupooSizeRank('https://photo.yupoo.com/s/x/medium.jpg'))
      .toBeGreaterThan(yupooSizeRank('https://photo.yupoo.com/s/x/small.jpg'));
    expect(yupooSizeRank('https://photo.yupoo.com/s/x/original.jpg'))
      .toBeGreaterThan(yupooSizeRank('https://photo.yupoo.com/s/x/big.jpg'));
  });
});

describe('dedupeProductImages', () => {
  it('collapses size variants of one photo, keeping the sharpest', () => {
    const out = dedupeProductImages([
      'https://photo.yupoo.com/s/p1/medium.jpg',
      'https://photo.yupoo.com/s/p1/big.jpg',
      'https://photo.yupoo.com/s/p2/small.jpg',
    ]);
    expect(out).toEqual([
      'https://photo.yupoo.com/s/p1/big.jpg',
      'https://photo.yupoo.com/s/p2/small.jpg',
    ]);
  });

  it('preserves album order — a later sharp variant does not jump the queue', () => {
    const out = dedupeProductImages([
      'https://photo.yupoo.com/s/cover/medium.jpg',
      'https://photo.yupoo.com/s/second/big.jpg',
      'https://photo.yupoo.com/s/cover/original.jpg',
    ]);
    expect(out[0]).toBe('https://photo.yupoo.com/s/cover/original.jpg');
    expect(out[1]).toBe('https://photo.yupoo.com/s/second/big.jpg');
    expect(out).toHaveLength(2);
  });

  it('drops empties and exact duplicates, and leaves a clean gallery untouched', () => {
    const clean = ['https://photo.yupoo.com/s/a/big.jpg', 'https://photo.yupoo.com/s/b/big.jpg'];
    expect(dedupeProductImages(clean)).toEqual(clean);
    expect(dedupeProductImages([null, '', ' ', clean[0], clean[0]])).toEqual([clean[0]]);
  });

  it('does not merge distinct non-Yupoo images', () => {
    const urls = ['https://ae01.alicdn.com/kf/A.jpg', 'https://ae01.alicdn.com/kf/B.jpg'];
    expect(dedupeProductImages(urls)).toEqual(urls);
  });
});
