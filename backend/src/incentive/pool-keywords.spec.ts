import { knownPoolKeywords, parsePoolKeywords } from './pool-keywords';

describe('knownPoolKeywords', () => {
  it('answers the recurring portal pools without an AI call', () => {
    expect(knownPoolKeywords('Home & Living Pool: Earn Big with Premium Picks!'))
      .toContain('storage box');
    expect(knownPoolKeywords('Beauty & Fashion Pool')).toContain('makeup organizer');
    expect(knownPoolKeywords('Toy Pool Power-Up')).toContain('educational toys');
    expect(knownPoolKeywords('Watches & Eyewear Pool')).toContain('polarized sunglasses');
    expect(knownPoolKeywords('Fuel Your Fitness: Promote Wellness Gear!'))
      .toContain('resistance bands');
  });

  it('returns null for a pool it does not recognise (the model answers instead)', () => {
    expect(knownPoolKeywords('Q4 Mystery Pool')).toBeNull();
    expect(knownPoolKeywords('')).toBeNull();
  });

  it('hands back a COPY, so an edit cannot corrupt the table for the next caller', () => {
    const first = knownPoolKeywords('Home & Living')!;
    first.push('mutated');
    expect(knownPoolKeywords('Home & Living')).not.toContain('mutated');
  });
});

describe('parsePoolKeywords', () => {
  it('reads a plain JSON array', () => {
    expect(parsePoolKeywords('["storage box","kitchen organizer"]'))
      .toEqual(['storage box', 'kitchen organizer']);
  });

  it('digs the array out of a chatty reply', () => {
    expect(parsePoolKeywords('Sure! Here you go:\n["garden tools","hand tools set"]\nHope this helps'))
      .toEqual(['garden tools', 'hand tools set']);
  });

  it('drops brand-authenticity phrasing even when the model produces it', () => {
    // A keyword decides what the autopilot searches; "official/authentic" drags results
    // toward listings whose authenticity we cannot vouch for.
    expect(parsePoolKeywords('["adidas official authentic","running sneakers","genuine leather bag"]'))
      .toEqual(['running sneakers']);
  });

  it('normalises case, punctuation and duplicates, and caps the list', () => {
    expect(parsePoolKeywords('["Storage Box.","storage box","A","B","C","D","E","F"]'))
      .toEqual(['storage box', 'a', 'b', 'c', 'd', 'e']);
  });

  it('rejects over-long phrases that would search for nothing', () => {
    expect(parsePoolKeywords('["a very long five word phrase here","storage box"]'))
      .toEqual(['storage box']);
  });

  it('fails closed on junk, so nothing is typed into the field for the owner', () => {
    expect(parsePoolKeywords('no array at all')).toEqual([]);
    expect(parsePoolKeywords('[not json')).toEqual([]);
    expect(parsePoolKeywords('')).toEqual([]);
    expect(parsePoolKeywords(null)).toEqual([]);
  });
});
