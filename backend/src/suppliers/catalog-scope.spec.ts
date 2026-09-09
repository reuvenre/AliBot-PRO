import { catalogsForCampaign } from './catalog-scope';

/**
 * The reported symptom: FLYLINK posts kept landing in the tactical group when they belonged
 * to the brands-for-moms one.
 *
 * The post always went where its campaign aimed — the SELECTION was wrong. The autopilot
 * rotated every product the account owns, from every catalog at once, so whichever cron
 * fired first took the item; the per-group dedup then locked the other campaign out of it.
 * Meanwhile each catalog already carried the group it belongs to, and only manual sends
 * ever read it.
 */
const TAKTI = 'chan_takti';
const MAMA = 'chan_mama';

const tacticalCat = { id: 'cat_tactical', target_channel_id: TAKTI };
const mamaCat = { id: 'cat_mama', target_channel_id: MAMA };
const shared = { id: 'cat_shared', target_channel_id: null };

describe('catalogsForCampaign', () => {
  it('keeps a campaign off a catalog that belongs to another group', () => {
    // The bug, stated: the tactical campaign must not reach the mama catalog.
    expect(catalogsForCampaign([tacticalCat, mamaCat], [TAKTI])).toEqual(['cat_tactical']);
    expect(catalogsForCampaign([tacticalCat, mamaCat], [MAMA])).toEqual(['cat_mama']);
  });

  it('leaves an UNLINKED catalog open to everyone', () => {
    // No link is not a link to nowhere — it is "I have not said". An account that never
    // linked a catalog must behave exactly as it did before this rule existed.
    expect(catalogsForCampaign([shared], [TAKTI])).toEqual(['cat_shared']);
    expect(catalogsForCampaign([tacticalCat, mamaCat, shared], [TAKTI]))
      .toEqual(['cat_tactical', 'cat_shared']);
  });

  it('gives a campaign that publishes to both groups both catalogs', () => {
    expect(catalogsForCampaign([tacticalCat, mamaCat], [TAKTI, MAMA]))
      .toEqual(['cat_tactical', 'cat_mama']);
  });

  it('returns nothing when every catalog belongs elsewhere — never "then take anything"', () => {
    // Falling back to the whole pool here would restore the exact bug under a new name.
    // The caller says so out loud instead.
    expect(catalogsForCampaign([tacticalCat, mamaCat], ['chan_ali4you'])).toEqual([]);
  });

  it('is not fooled by whitespace or empty targets', () => {
    expect(catalogsForCampaign([{ id: 'c', target_channel_id: ` ${TAKTI} ` }], [TAKTI])).toEqual(['c']);
    expect(catalogsForCampaign([{ id: 'c', target_channel_id: TAKTI }], [` ${TAKTI} `])).toEqual(['c']);
    // An empty string is no link at all — same as null.
    expect(catalogsForCampaign([{ id: 'c', target_channel_id: '  ' }], [MAMA])).toEqual(['c']);
  });

  it('survives missing input', () => {
    expect(catalogsForCampaign([], [TAKTI])).toEqual([]);
    expect(catalogsForCampaign(undefined as any, undefined as any)).toEqual([]);
  });
});
