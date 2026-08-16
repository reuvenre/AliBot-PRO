import {
  waDelayMs, WA_JITTER_MS, WA_MAX_WAIT_MS, WA_MIN_GAP_MS,
} from './whatsapp-pacing';

describe('waDelayMs', () => {
  const NOW = 1_700_000_000_000;

  it('still jitters the very first message', () => {
    // Leaving on the scheduler's exact round minute, in lockstep with the Telegram post,
    // is the machine signature we are breaking.
    expect(waDelayMs(null, NOW, 0.5)).toBe(Math.round(0.5 * WA_JITTER_MS));
  });

  it('holds a burst back to the minimum gap', () => {
    const delay = waDelayMs(NOW - 10_000, NOW, 0);
    expect(delay).toBe(WA_MIN_GAP_MS - 10_000);
  });

  it('lets a message through once the line has been quiet', () => {
    expect(waDelayMs(NOW - WA_MIN_GAP_MS - 1, NOW, 0)).toBe(0);
  });

  it('caps the wait — a manual push is a live request, not a queue', () => {
    expect(waDelayMs(NOW, NOW, 0.999)).toBe(WA_MAX_WAIT_MS);
  });

  it('never parks a send on a clock that jumped', () => {
    expect(waDelayMs(NOW + 86_400_000, NOW, 0)).toBe(WA_MIN_GAP_MS);
  });
});
