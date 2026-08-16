import { describeGreenSendResult } from './green-send-result';

describe('describeGreenSendResult', () => {
  it('accepts only an answer that carries an idMessage', () => {
    const res = describeGreenSendResult(200, { idMessage: 'BAE5F4886F6C3B4A' });
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('BAE5F4886F6C3B4A');
  });

  it('refuses to call a 200 with no idMessage a success', () => {
    // The trap this exists for: an instance that ACCEPTS an @newsletter target without
    // queueing anything would read as "channel publishing works" and we would wire the
    // autopilot to a target that silently drops every post.
    const res = describeGreenSendResult(200, { ok: true });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('idMessage');
  });

  it('names the credentials on 401/403', () => {
    expect(describeGreenSendResult(403, {}).detail).toContain('Token');
  });

  it('names the quota on Green API\'s 466', () => {
    expect(describeGreenSendResult(466, {}).detail).toContain('מכסה');
  });

  it('passes the instance\'s own rejection text through', () => {
    const res = describeGreenSendResult(400, { message: 'chatId is not valid' });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('chatId is not valid');
  });

  it('survives a body that is not an object', () => {
    expect(describeGreenSendResult(200, null).ok).toBe(false);
    expect(describeGreenSendResult(500, 'Bad Gateway').detail).toContain('Bad Gateway');
  });
});
