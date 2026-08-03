import { openPostClash, postTargetChannels } from './flylink-dedup';

describe('postTargetChannels', () => {
  it('parses a multi-target JSON array', () => {
    expect(postTargetChannels({ channel_overrides: '["g1","g2"]' })).toEqual(['g1', 'g2']);
  });

  it('falls back to the single override when there is no JSON list', () => {
    expect(postTargetChannels({ channel_override: 'g1' })).toEqual(['g1']);
    expect(postTargetChannels({ channel_override: 'g1', channel_overrides: '[]' })).toEqual(['g1']);
  });

  it('survives broken JSON by falling back to the single override', () => {
    expect(postTargetChannels({ channel_override: 'g1', channel_overrides: 'not json' })).toEqual(['g1']);
  });

  it('drops non-string and blank entries', () => {
    expect(postTargetChannels({ channel_overrides: '["g1", 7, "", "  "]' })).toEqual(['g1']);
  });

  it('returns empty (= default channel) when nothing is set', () => {
    expect(postTargetChannels({})).toEqual([]);
    expect(postTargetChannels({ channel_override: null, channel_overrides: null })).toEqual([]);
  });
});

describe('openPostClash', () => {
  it('clashes when an open post shares a group with the request', () => {
    const open = [{ channel_overrides: '["mama","takti"]' }];
    expect(openPostClash(open, ['takti'])).toBe(true);
  });

  it('does not clash when the open post targets a different group', () => {
    const open = [{ channel_override: 'ali4you' }];
    expect(openPostClash(open, ['mama', 'takti'])).toBe(false);
  });

  it('treats a default-channel open post (no target) as covering every group', () => {
    expect(openPostClash([{}], ['mama'])).toBe(true);
  });

  it('no open posts → no clash', () => {
    expect(openPostClash([], ['mama'])).toBe(false);
  });

  it('any one of several open posts clashing is enough', () => {
    const open = [{ channel_override: 'ali4you' }, { channel_overrides: '["mama"]' }];
    expect(openPostClash(open, ['mama'])).toBe(true);
  });
});
