import { classifyChannelChats } from './whatsapp-channel-support';

describe('classifyChannelChats', () => {
  it('recognises a channel by its @newsletter id', () => {
    const res = classifyChannelChats(200, [
      { id: '972500000000@c.us', name: 'לקוח' },
      { id: '120363000000000000@g.us', name: 'טקטי בקליק' },
      { id: '120363111111111111@newsletter', name: 'ערוץ הדילים' },
    ]);
    expect(res.verdict).toBe('supported');
    expect(res.channels).toEqual([{ id: '120363111111111111@newsletter', name: 'ערוץ הדילים' }]);
  });

  it('does NOT call it unsupported when the owner simply follows no channel', () => {
    // The difference that matters: "I found none" is not "it cannot do it". Reporting the
    // wrong one here would kill a viable direction on no evidence.
    const res = classifyChannelChats(200, [{ id: '120363000000000000@g.us', name: 'קבוצה' }]);
    expect(res.verdict).toBe('unknown');
    expect(res.message).toContain('לא חד-משמעית');
  });

  it('calls it unsupported only when the instance rejects the method', () => {
    expect(classifyChannelChats(404, { error: 'not found' }).verdict).toBe('unsupported');
  });

  it('blames the credentials, not the feature, on 401/403', () => {
    const res = classifyChannelChats(401, {});
    expect(res.verdict).toBe('unknown');
    expect(res.message).toContain('Token');
  });

  it('tells the owner to re-scan when the instance reports nothing at all', () => {
    const res = classifyChannelChats(200, []);
    expect(res.verdict).toBe('unknown');
    expect(res.message).toContain('QR');
  });

  it('survives a body that is not a list', () => {
    expect(classifyChannelChats(200, null).total_chats).toBe(0);
  });
});
