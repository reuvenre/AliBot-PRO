import { deliveryOutcome } from './digest-delivery';

const ok = (channel: string) => ({ channel, attempted: true, ok: true });
const failed = (channel: string, error = 'ETIMEDOUT') => ({ channel, attempted: true, ok: false, error });

describe('deliveryOutcome', () => {
  it('counts the day done when ANY channel got the digest through', () => {
    // The two channels carry the same text — one arriving is the owner reading it.
    expect(deliveryOutcome([failed('telegram'), ok('email')]).delivered).toBe(true);
  });

  it('reports a failure when every attempted channel failed', () => {
    // THE bug: both were swallowed with a warning and the day was stamped as sent, so a
    // 10:10 network blip cost the whole morning report with nothing to retry it.
    const out = deliveryOutcome([failed('telegram'), failed('email', 'SMTP 535')]);
    expect(out.delivered).toBe(false);
    expect(out.reason).toContain('telegram');
    expect(out.reason).toContain('SMTP 535');
  });

  it('does not retry forever when no channel is configured at all', () => {
    // Nothing was attempted: no email on file, no Telegram route. Hourly retries could
    // never help — that is a settings gap, not a transport failure.
    expect(deliveryOutcome([]).delivered).toBe(true);
    expect(deliveryOutcome([{ channel: 'telegram', attempted: false, ok: false }]).delivered).toBe(true);
  });

  it('names the failure even without an error string', () => {
    expect(deliveryOutcome([{ channel: 'email', attempted: true, ok: false }]).reason).toBe('email: נכשל');
  });
});
