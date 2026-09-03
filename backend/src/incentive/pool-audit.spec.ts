import { auditPool, categoryOfKeyword } from './pool-audit';

/**
 * The pools already in the database, filled by the matcher before it was fixed.
 *
 * Fixing the suggestion button helps the NEXT pool. This check is what reaches the ones
 * already sitting there with keywords from the wrong category, quietly earning no bonus.
 */
describe('auditPool', () => {
  it('passes a pool whose keywords match its own name', () => {
    const a = auditPool({
      name: 'Home & Living Pool',
      keywords: ['storage box', 'kitchen organizer', 'laundry basket'],
    });
    expect(a.verdict).toBe('ok');
    expect(a.nameCategory).toBe('בית, מטבח וסידור');
    expect(a.offCategory).toEqual([]);
  });

  it('names the keywords that belong to a different category', () => {
    // The exact wreckage the old matcher produced: a home pool holding pet keywords.
    const a = auditPool({
      name: 'Home & Living Pool',
      keywords: ['storage box', 'pet grooming tools', 'dog accessories'],
    });
    expect(a.verdict).toBe('mismatch');
    expect(a.offCategory).toEqual([
      { keyword: 'pet grooming tools', category: 'חיות מחמד' },
      { keyword: 'dog accessories', category: 'חיות מחמד' },
    ]);
  });

  it('says what an unrecognised pool is CHASING, without calling it wrong', () => {
    // "Home Textiles & Carpets" is not in the table, so nothing can be asserted about its
    // keywords — but "your textiles pool is searching for pet supplies" is the whole
    // finding, and it survives the name being unknown.
    const a = auditPool({
      name: 'Home Textiles & Carpets',
      keywords: ['pet grooming tools', 'cat toys'],
    });
    expect(a.verdict).toBe('unrecognized');
    expect(a.nameCategory).toBeNull();
    expect(a.keywordCategories).toEqual(['חיות מחמד']);
    // Not accused of a mismatch — there is nothing to mismatch against.
    expect(a.offCategory).toEqual([]);
  });

  it('leaves hand-written keywords alone', () => {
    // A check that second-guesses the owner's own words cries wolf, and a check that
    // cries wolf gets ignored — at which point it protects nothing.
    const a = auditPool({
      name: 'Home & Living Pool',
      keywords: ['dish rack', 'spice jar set', 'shoe cabinet'],
    });
    expect(a.verdict).toBe('ok');
    expect(a.offCategory).toEqual([]);
    expect(a.keywordCategories).toEqual([]);
  });

  it('offers what the fixed button would suggest now, for the fix itself', () => {
    const a = auditPool({ name: 'Pet Supplies', keywords: [] });
    expect(a.suggested).toContain('pet grooming tools');
  });

  it('survives an empty or junk pool', () => {
    expect(auditPool({ name: '', keywords: [] }).verdict).toBe('unrecognized');
    expect(auditPool({ name: 'Pet Supplies', keywords: ['', '   ', null as any] }).verdict).toBe('ok');
  });
});

describe('categoryOfKeyword', () => {
  it('resolves a keyword that belongs to exactly one category', () => {
    expect(categoryOfKeyword('kitchen organizer')).toBe('בית, מטבח וסידור');
    expect(categoryOfKeyword('DASH CAM')).toBe('רכב ואופנוע');
    expect(categoryOfKeyword('  yoga mat ')).toBe('ספורט וכושר');
  });

  it('refuses to resolve a keyword two categories share', () => {
    // "jewelry organizer" is listed under both beauty and jewellery. Picking one would
    // flag a correct pool as wrong.
    expect(categoryOfKeyword('jewelry organizer')).toBeNull();
  });

  it('refuses to judge a keyword the table never wrote', () => {
    // This is the property that keeps the check quiet: it only speaks about keywords it
    // can prove the origin of.
    expect(categoryOfKeyword('dish rack')).toBeNull();
    expect(categoryOfKeyword('')).toBeNull();
  });
});
