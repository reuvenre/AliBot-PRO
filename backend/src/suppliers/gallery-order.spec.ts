import { coverFirst } from './gallery-order';

describe('coverFirst', () => {
  const SIZE_CHART = 'https://p.example/album/size-chart.jpg';
  const SHIRT = 'https://p.example/album/shirt.jpg';
  const BLUE = 'https://p.example/album/shirt-blue.jpg';

  it('moves the catalog cover to the front (the Facebook size-table bug)', () => {
    // Yupoo album order opened with the size chart; the cover is the product shot.
    expect(coverFirst([SIZE_CHART, SHIRT, BLUE], SHIRT)).toEqual([SHIRT, SIZE_CHART, BLUE]);
  });

  it('prepends a cover that is not part of the album (no duplicate when it is)', () => {
    const external = 'https://p.example/cover.jpg';
    expect(coverFirst([SIZE_CHART, SHIRT], external)).toEqual([external, SIZE_CHART, SHIRT]);
    expect(coverFirst([SHIRT, SIZE_CHART], SHIRT)).toEqual([SHIRT, SIZE_CHART]);
  });

  it('keeps album order untouched when there is no cover', () => {
    expect(coverFirst([SIZE_CHART, SHIRT], '')).toEqual([SIZE_CHART, SHIRT]);
  });

  it('caps at the requested maximum after reordering', () => {
    const many = Array.from({ length: 12 }, (_, i) => `https://p.example/${i}.jpg`);
    const out = coverFirst(many, many[11], 10);
    expect(out).toHaveLength(10);
    expect(out[0]).toBe(many[11]);
  });

  it('drops empty entries', () => {
    expect(coverFirst([SHIRT, '', null as any], SHIRT)).toEqual([SHIRT]);
  });
});
