import { AiService } from './ai.service';

// Minimal creds with both a chosen (gemini) and a secondary (anthropic) key.
const creds: any = {
  ai_provider: 'gemini',
  gemini_api_key: 'g-key',
  anthropic_api_key: 'a-key',
  user_id: 'u1',
};

function makeService(): AiService {
  const usage: any = { record: jest.fn() };
  return new AiService(usage);
}

describe('AiService provider failover', () => {
  it('resolveProvider prefers the chosen keyed provider', () => {
    const svc = makeService();
    expect(svc.resolveProvider(creds)).toBe('gemini');
    expect(svc.resolveProvider({ ai_provider: 'gemini', anthropic_api_key: 'a' } as any)).toBe('anthropic');
    expect(svc.resolveProvider(null)).toBeNull();
  });

  it('fails over to the secondary provider when the chosen one throws', async () => {
    const svc = makeService();
    jest.spyOn(svc as any, 'callGemini').mockRejectedValue(new Error('gemini 429'));
    jest.spyOn(svc as any, 'callAnthropic').mockResolvedValue({ text: 'שלום עולם', provider: 'anthropic', tokens: 10, promptTokens: 5, outputTokens: 5 });
    const res = await svc.generate(creds, { system: 's', prompt: 'p' });
    expect(res?.provider).toBe('anthropic');
    expect(res?.text).toBe('שלום עולם');
  });

  it('fails over when the chosen provider returns EMPTY text', async () => {
    const svc = makeService();
    jest.spyOn(svc as any, 'callGemini').mockResolvedValue({ text: '   ', provider: 'gemini', tokens: 0 });
    jest.spyOn(svc as any, 'callAnthropic').mockResolvedValue({ text: 'copy', provider: 'anthropic', tokens: 8, promptTokens: 4, outputTokens: 4 });
    const res = await svc.generate(creds, { system: 's', prompt: 'p' });
    expect(res?.provider).toBe('anthropic');
  });

  it('returns null only when ALL keyed providers fail', async () => {
    const svc = makeService();
    jest.spyOn(svc as any, 'callGemini').mockRejectedValue(new Error('down'));
    jest.spyOn(svc as any, 'callAnthropic').mockRejectedValue(new Error('down'));
    expect(await svc.generate(creds, { system: 's', prompt: 'p' })).toBeNull();
  });
});
