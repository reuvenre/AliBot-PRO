import { splitMessage } from './split-message';

describe('splitMessage', () => {
  it('leaves a normal report as a single message', () => {
    expect(splitMessage('שורה אחת\nשורה שתיים')).toEqual(['שורה אחת\nשורה שתיים']);
  });

  it('sends nothing for an empty report rather than an empty message', () => {
    expect(splitMessage('')).toEqual([]);
    expect(splitMessage('   \n  ')).toEqual([]);
  });

  it('splits on line boundaries, never through a figure', () => {
    const line = 'א'.repeat(40);
    const text = Array.from({ length: 10 }, () => line).join('\n');
    const parts = splitMessage(text, 100);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(100);
      // Every line survives whole.
      for (const l of p.split('\n')) expect(l).toBe(line);
    }
    // Nothing is lost in the split.
    expect(parts.join('\n')).toBe(text);
  });

  it('hard-cuts a single line longer than the limit instead of dropping it', () => {
    const monster = 'x'.repeat(250);
    const parts = splitMessage(`לפני\n${monster}\nאחרי`, 100);
    expect(parts[0]).toBe('לפני');
    expect(parts.slice(1, 4).join('')).toBe(monster);
    expect(parts[parts.length - 1]).toBe('אחרי');
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(100);
  });

  it('fills each message rather than emitting one per line', () => {
    const text = Array.from({ length: 20 }, (_, i) => `שורה ${i}`).join('\n');
    expect(splitMessage(text, 4096)).toHaveLength(1);
  });
});
