import {
  buildPinOverlaySvg, escapeXml, pinImageUrl, wrapPinTitle, PIN_W, PIN_H, PIN_IMAGE_H,
} from './pin-frame';

describe('wrapPinTitle', () => {
  it('keeps a short title on one line', () => {
    expect(wrapPinTitle('Kitchen Scraper Set')).toEqual(['Kitchen Scraper Set']);
  });

  it('wraps a long title to two lines and ellipsizes the overflow', () => {
    // Raw AliExpress titles run 100+ characters; the band fits two clean lines.
    const lines = wrapPinTitle(
      'Flexible Kitchen Scraper Spatula for Nonstick Pans and Pots Soft Blade Cleaning Tool Set of Three',
    );
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(31);
  });

  it('survives empty input', () => {
    expect(wrapPinTitle('')).toEqual([]);
  });
});

describe('buildPinOverlaySvg', () => {
  it('is a 2:3 canvas with the band below the image area', () => {
    const svg = buildPinOverlaySvg('Storage Box', '$6.40');
    expect(PIN_H / PIN_W).toBe(1.5);
    expect(svg).toContain(`width="${PIN_W}" height="${PIN_H}"`);
    expect(svg).toContain(`y="${PIN_IMAGE_H}"`);
  });

  it('escapes the title — product names carry ampersands and angle brackets', () => {
    const svg = buildPinOverlaySvg('Beads & Earrings <Organizer>', '$9.99');
    expect(svg).toContain('Beads &amp; Earrings &lt;Organizer&gt;');
    expect(svg).not.toContain('<Organizer>');
  });

  it('omits the price tag when there is no price to show', () => {
    // A pin with a "$0.00" sticker looks broken; no price → clean band only.
    expect(buildPinOverlaySvg('Storage Box', '')).not.toContain('#E60023');
    expect(buildPinOverlaySvg('Storage Box', '$6.40')).toContain('#E60023');
  });
});

describe('pinImageUrl', () => {
  it('builds the endpoint URL with encoded params', () => {
    const url = pinImageUrl('https://api.example.com/', 'https://ae01.alicdn.com/kf/a.jpg', 'Storage & Box', '$6.40');
    expect(url.startsWith('https://api.example.com/posts/pin-image?')).toBe(true);
    expect(url).toContain('src=https%3A%2F%2Fae01.alicdn.com');
    expect(url).toContain('Storage+%26+Box');
    expect(url).toContain('%246.40');
  });

  it('caps the title — a URL-sized title gets pins rejected, not read', () => {
    const url = pinImageUrl('https://b.co', 'https://a.co/i.jpg', 'x'.repeat(500), '$1');
    expect(new URL(url).searchParams.get('title')!.length).toBeLessThanOrEqual(120);
  });
});
