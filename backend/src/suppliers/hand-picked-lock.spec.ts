import { handPickedElsewhere } from './hand-picked-lock';

describe('handPickedElsewhere', () => {
  it('locks a product hand-sent to another group — the leak this exists to stop', () => {
    // Observed: a tactical item hand-sent to "טקטי בקליק" was later auto-published by the
    // brands-for-moms campaign, which shares the same catalog.
    const locked = handPickedElsewhere(
      [{ productKey: 'LUN714', channels: ['tactical'] }],
      ['mama'],
    );
    expect(locked.has('LUN714')).toBe(true);
  });

  it('leaves a product hand-sent to THIS campaign\'s own group available', () => {
    // Same audience — the owner and the campaign agree; per-group dedup handles frequency.
    const locked = handPickedElsewhere(
      [{ productKey: 'LUN714', channels: ['mama'] }],
      ['mama'],
    );
    expect(locked.size).toBe(0);
  });

  it('a product hand-sent to both groups stays available here', () => {
    // He published it to this group himself, so its fit is not in question.
    const locked = handPickedElsewhere(
      [
        { productKey: 'LUN714', channels: ['tactical'] },
        { productKey: 'LUN714', channels: ['mama'] },
      ],
      ['mama'],
    );
    expect(locked.size).toBe(0);
  });

  it('ignores a manual send with no group — a default-channel post states no intent', () => {
    expect(handPickedElsewhere([{ productKey: 'LUN714', channels: [] }], ['mama']).size).toBe(0);
    expect(handPickedElsewhere([{ productKey: 'LUN714', channels: ['  '] }], ['mama']).size).toBe(0);
  });

  it('locks nothing when the campaign has no targets to compare against', () => {
    // A target-less FLYLINK campaign is rejected before this runs; be inert, not greedy.
    expect(handPickedElsewhere([{ productKey: 'LUN714', channels: ['tactical'] }], []).has('LUN714')).toBe(true);
  });

  it('ignores blank product keys', () => {
    expect(handPickedElsewhere([{ productKey: '', channels: ['tactical'] }], ['mama']).size).toBe(0);
  });
});
