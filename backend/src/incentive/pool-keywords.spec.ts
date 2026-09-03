import { knownPoolKeywords, parsePoolKeywords } from './pool-keywords';

const kw = (name: string) => knownPoolKeywords(name)?.keywords ?? null;

describe('knownPoolKeywords', () => {
  it('answers the recurring portal pools without an AI call', () => {
    expect(kw('Home & Living Pool: Earn Big with Premium Picks!')).toContain('storage box');
    expect(kw('Beauty & Fashion Pool')).toContain('makeup organizer');
    expect(kw('Toy Pool Power-Up')).toContain('educational toys');
    expect(kw('Watches & Eyewear Pool')).toContain('polarized sunglasses');
    expect(kw('Fuel Your Fitness: Promote Wellness Gear!')).toContain('resistance bands');
    expect(kw('Luggage & Bags')).toContain('travel backpack');
    expect(kw('Security & Protection')).toContain('tactical flashlight');
  });

  it('names what it recognised, in Hebrew', () => {
    // The screen shows this. A table hit reads as authoritative, so the owner has to be
    // able to see that a textiles pool was read as pet supplies — that is the whole
    // difference between catching the mistake and losing a month of bonus to it.
    expect(knownPoolKeywords('Pet Supplies')!.label).toBe('חיות מחמד');
    expect(knownPoolKeywords('Home & Living')!.label).toBe('בית, מטבח וסידור');
  });

  /**
   * The suggestions that actually went out wrong. Every one of these was a naked substring
   * hit or a first-wins ordering accident, and each one put the autopilot to work searching
   * a category the pool does not pay a bonus on.
   */
  describe('names that used to produce confidently wrong keywords', () => {
    it('does not read CARpets as pet supplies', () => {
      // The word "pet" does not appear in this name — only the letters. Nothing else
      // matches either, so it falls through to the model, which is the correct answer for
      // a pool this table genuinely does not know.
      expect(knownPoolKeywords('Home Textiles & Carpets')).toBeNull();
    });

    it('does not read personal CARe as car accessories', () => {
      // Beauty happened to be listed above auto, so this one was masked — the boundary is
      // what makes it safe rather than lucky.
      expect(kw('Personal Care Pool')).not.toContain('car accessories');
      expect(kw('Personal Care Pool')).toContain('skincare tools');
    });

    it('sends a sports SHOES pool to footwear, not to yoga mats', () => {
      // "sport" (5) used to win on position; "sports shoes" (12) wins on specificity.
      expect(kw('Sports Shoes Pool')).toContain('running sneakers');
      expect(kw('Sports Shoes Pool')).not.toContain('yoga mat');
    });

    it('sends home IMPROVEMENT to tools, not to kitchen organisers', () => {
      expect(kw('Home Improvement & Lighting')).toContain('hand tools set');
    });

    it('still reads the words themselves, plural or not', () => {
      expect(kw('Pet Supplies')).toContain('pet grooming tools');
      expect(kw('Toys & Hobbies')).toContain('educational toys');
      expect(kw('Watches')).toContain('watch strap');
      expect(kw('Cars & Motorcycles')).toContain('car accessories');
    });
  });

  it('asks the model instead of guessing between two equal readings', () => {
    // "Sport Watches" reads as sports gear and as watches, on five characters each. A coin
    // flip presented as a fact costs a month of bonus; one model call costs a fraction of a
    // cent — so ambiguity falls through, same as an unknown name.
    expect(knownPoolKeywords('Sport Watches Pool')).toBeNull();
  });

  it('but a longer phrase is not a tie — the specific reading wins', () => {
    // "home decor" (10) over "beauty" (6). Falling through here would be timid, not safe:
    // the name says what it is.
    expect(kw('Beauty & Home Decor')).toContain('home decor');
  });

  it('returns null for a pool it does not recognise (the model answers instead)', () => {
    expect(knownPoolKeywords('Q4 Mystery Pool')).toBeNull();
    expect(knownPoolKeywords('')).toBeNull();
  });

  it('reads a Hebrew pool name, where \\b matches nothing', () => {
    expect(kw('פול כלי בית')).toContain('storage box');
    expect(kw('פול חיות מחמד')).toContain('pet grooming tools');
  });

  it('hands back a COPY, so an edit cannot corrupt the table for the next caller', () => {
    const first = knownPoolKeywords('Home & Living')!;
    first.keywords.push('mutated');
    expect(kw('Home & Living')).not.toContain('mutated');
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
