import { toWhatsAppText } from './whatsapp-format';

describe('toWhatsAppText', () => {
  it('keeps the emphasis instead of flattening the post', () => {
    // The old send path stripped every tag, so the designed post arrived as grey mush.
    const out = toWhatsAppText('<b>ארגונית מטבח</b>\n💸 <b>₪49</b> במקום <s>₪120</s>');
    expect(out).toBe('*ארגונית מטבח*\n💸 *₪49* במקום ~₪120~');
  });

  it('frames the link with a bold CTA and leaves the URL alone on its line', () => {
    // WhatsApp has no anchor markup — the URL must stay visible, so it gets a CTA above it
    // and a line of its own (clients swallow trailing characters into a glued anchor).
    const out = toWhatsAppText('ארגונית מטבח\n\n🔗 https://nexlify.win-solutions.co.il/r/2xCZaRan?s=wa');
    expect(out).toBe(
      'ארגונית מטבח\n\n*🛒 לרכישה — לחצו על הקישור 👇*\nhttps://nexlify.win-solutions.co.il/r/2xCZaRan?s=wa',
    );
  });

  it('speaks English for an English post', () => {
    expect(toWhatsAppText('Kitchen organizer\n\n🔗 https://x.co/r/Ab12')).toContain('*🛒 Tap the link to shop 👇*');
  });

  it('finds the link line through the invisible RTL marks a Hebrew body carries', () => {
    expect(toWhatsAppText('כותרת\n\n‏🔗 https://x.co/r/Ab12')).toContain('*🛒 לרכישה — לחצו על הקישור 👇*');
  });

  it('unwraps a Telegram anchor into label + URL', () => {
    expect(toWhatsAppText('<a href="https://x.co/r/Ab12">🛒 לרכישה — לחצו כאן 🛒</a>'))
      .toBe('🛒 לרכישה — לחצו כאן 🛒\nhttps://x.co/r/Ab12');
  });

  it('does not print a URL twice when the anchor text IS the URL', () => {
    expect(toWhatsAppText('<a href="https://x.co/r/Ab12">https://x.co/r/Ab12</a>')).toBe('https://x.co/r/Ab12');
  });

  it('decodes entities — nothing downstream would', () => {
    expect(toWhatsAppText('Beads &amp; Earrings &quot;XL&quot;')).toBe('Beads & Earrings "XL"');
  });

  it('normalises doubled markdown that would leave a stray marker', () => {
    expect(toWhatsAppText('**חם** ~~₪120~~')).toBe('*חם* ~₪120~');
  });

  it('collapses the blank-line runs WhatsApp would render verbatim', () => {
    expect(toWhatsAppText('א\n\n\n\nב')).toBe('א\n\nב');
  });

  it('survives an empty body', () => {
    expect(toWhatsAppText('')).toBe('');
  });
});
