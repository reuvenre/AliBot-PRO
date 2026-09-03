import { ALL_CAMPAIGNS, parsePoolTargets, poolAppliesTo } from './pool-targets';

/**
 * The complaint behind this file: "ה-AI בוחר מילים שלא קשורות לקמפיין ואני מפסיד מכירות".
 *
 * A Home & Living pool registered once, with the target picker left alone, put "kitchen
 * organizer" into a tactical-gear channel — and BOOSTED, because a live pool outranks the
 * campaign's own unproven keywords. Nothing had to be misconfigured for that to happen;
 * the fan-out was the default. It is now a choice, and these are the gates.
 */
describe('poolAppliesTo', () => {
  const CAMPAIGN = 'c-tactical';

  it('steers nothing when the pool was never aimed', () => {
    // The whole point. An unassigned pool is a RECORD of money available, not an
    // instruction to chase it in every channel the account owns.
    expect(poolAppliesTo(null, CAMPAIGN)).toBe(false);
    expect(poolAppliesTo('[]', CAMPAIGN)).toBe(false);
    expect(poolAppliesTo('', CAMPAIGN)).toBe(false);
    expect(poolAppliesTo(undefined, CAMPAIGN)).toBe(false);
  });

  it('steers the campaign the owner named', () => {
    expect(poolAppliesTo(JSON.stringify([CAMPAIGN]), CAMPAIGN)).toBe(true);
    expect(poolAppliesTo(JSON.stringify(['c-other', CAMPAIGN]), CAMPAIGN)).toBe(true);
  });

  it('leaves alone every campaign the owner did not name', () => {
    expect(poolAppliesTo(JSON.stringify(['c-home', 'c-beauty']), CAMPAIGN)).toBe(false);
  });

  it('fans out across everything only when asked to, in so many words', () => {
    expect(poolAppliesTo(JSON.stringify([ALL_CAMPAIGNS]), CAMPAIGN)).toBe(true);
    expect(poolAppliesTo(JSON.stringify([ALL_CAMPAIGNS]), 'any-other-campaign')).toBe(true);
    // The sentinel wins wherever it appears, so a saved "all + one" is not a contradiction.
    expect(poolAppliesTo(JSON.stringify(['c-home', ALL_CAMPAIGNS]), CAMPAIGN)).toBe(true);
  });

  it('still honours a row saved by the first version of the screen', () => {
    // That version stored Telegram GROUP ids here. Such a row must keep steering the
    // campaigns publishing to those groups — a silent change of meaning would look
    // identical to the bug this file exists to prevent, only in the other direction.
    const legacy = JSON.stringify(['-1001234567890']);
    expect(poolAppliesTo(legacy, CAMPAIGN, ['-1001234567890'])).toBe(true);
    expect(poolAppliesTo(legacy, CAMPAIGN, ['-1009999999999'])).toBe(false);
    expect(poolAppliesTo(legacy, CAMPAIGN)).toBe(false);
  });

  it('steers nothing on a corrupt row', () => {
    // Fail CLOSED: unreadable targeting must not resolve to "everywhere". Steering the
    // wrong channel costs posts; steering none costs only the bonus emphasis.
    for (const bad of ['not json', '{"a":1}', '"c-tactical"', '42']) {
      expect(poolAppliesTo(bad, CAMPAIGN)).toBe(false);
    }
  });
});

describe('parsePoolTargets', () => {
  it('reads a stored list, trimming and dropping the empties', () => {
    expect(parsePoolTargets(' ["a", " b ", "", null] ')).toEqual(['a', 'b']);
  });

  it('answers with an empty list for anything it cannot read', () => {
    expect(parsePoolTargets(null)).toEqual([]);
    expect(parsePoolTargets('nope')).toEqual([]);
    expect(parsePoolTargets('{}')).toEqual([]);
  });
});
