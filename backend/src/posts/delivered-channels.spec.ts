import { mergeDeliveredChannels } from './delivered-channels';

describe('mergeDeliveredChannels', () => {
  it('records the pushed group — the bug: a hand-push kept showing the original group', () => {
    // Campaign post aimed at ALI4YOU, already published there, then pushed to טקטי בקליק.
    expect(mergeDeliveredChannels({
      wasSent: true, existing: [], intended: ['ali4you'], pushed: ['tactical'],
    })).toEqual(['ali4you', 'tactical']);
  });

  it('a post that had never gone out shows ONLY where the push landed', () => {
    // Its original group is intent, not delivery — claiming it would invent a send.
    expect(mergeDeliveredChannels({
      wasSent: false, existing: [], intended: ['ali4you'], pushed: ['tactical'],
    })).toEqual(['tactical']);
  });

  it('accumulates across pushes without duplicating', () => {
    expect(mergeDeliveredChannels({
      wasSent: true, existing: ['ali4you', 'tactical'], intended: ['ali4you'], pushed: ['tactical', 'mama'],
    })).toEqual(['ali4you', 'tactical', 'mama']);
  });

  it('never rewrites the record when nothing was confirmed delivered', () => {
    // A push that only reached Pinterest/WhatsApp (no group targeting) must not erase or
    // invent group history.
    expect(mergeDeliveredChannels({
      wasSent: true, existing: ['ali4you'], intended: ['ali4you'], pushed: [],
    })).toBeNull();
  });

  it('ignores blank ids rather than storing empty chips', () => {
    expect(mergeDeliveredChannels({
      wasSent: false, existing: [], intended: [], pushed: ['  ', 'tactical', ''],
    })).toEqual(['tactical']);
  });
});
