import { OrchestratorAgent } from './orchestrator.agent';

/**
 * The gap this closes: a campaign with `use_agents` on routes through the orchestrator, and
 * the orchestrator handed `campaign.keywords` straight to the ProductAgent. So the 🗓️
 * seasonal toggle and every registered bonus pool did NOTHING on an agents campaign — the
 * owner set them, watched ordinary products keep coming through the holidays, and no screen
 * could explain it. Both runners now read the same plan.
 */
describe('OrchestratorAgent — seasonal and bonus keywords reach the agents path', () => {
  const USER = 'u1';
  const campaign: any = {
    id: 'c1', name: 'טקטי בקליק', keywords: ['tactical flashlight'],
    posts_per_run: 1, language: 'he', use_agents: true,
  };

  const PLAN = {
    kwList: ['tactical flashlight', 'שרשראות תאורה לסוכה', 'storage box'],
    kwEffective: ['tactical flashlight', 'שרשראות תאורה לסוכה', 'storage box'],
    rotationList: ['שרשראות תאורה לסוכה', 'tactical flashlight'],
    baseCursor: 0,
    perPost: 2,                                   // the seasonal window's extra post
    slotKeywords: ['שרשראות תאורה לסוכה', 'tactical flashlight'],
    distinctKeywords: ['שרשראות תאורה לסוכה', 'tactical flashlight'],
    seasonHint: 'זו תקופת חגי תשרי — חבר את הכתיבה לאווירת החג.',
    bonusKeywordSet: new Set(['storage box']),
  };

  /** The orchestrator with every collaborator stubbed. `products` is what the ProductAgent
   *  reports back, which decides whether the content step runs at all. */
  function build(plan: any = PLAN, products: any[] = [{ product_id: 'p1', title: 'פנס טקטי' }]) {
    const findBestProducts = jest.fn(async (..._a: any[]) => ({ products, tokens: 0 }));
    const generateOptimizedContent = jest.fn(async (..._a: any[]) => ({ text: 'טקסט', language: 'he', tokens: 0 }));
    const createAgentPost = jest.fn(async (..._a: any[]) => undefined);
    const campaignKeywordPlan = jest.fn(async (..._a: any[]) => plan);
    const agent = new OrchestratorAgent(
      { findBestProducts } as any,
      { generateOptimizedContent } as any,
      { evaluateAndOptimize: async () => ({ status: 'healthy', tokens: 0 }) } as any,
      { campaignKeywordPlan, soldPriceBandFor: async () => null, createAgentPost } as any,
      { getRate: async () => 3.7 } as any,
      { getRaw: async () => ({ currency_pair: 'USD_ILS' }) } as any,
      { create: (r: any) => ({ ...r, id: 'run1' }), save: async (r: any) => r } as any,
    );
    return { agent, findBestProducts, generateOptimizedContent, createAgentPost, campaignKeywordPlan };
  }

  it('asks for the plan instead of reading the campaign row directly', async () => {
    const { agent, campaignKeywordPlan } = build();
    await agent.run(campaign, USER);
    expect(campaignKeywordPlan).toHaveBeenCalledWith(campaign, USER, expect.anything());
  });

  it('searches the keywords the PLAN chose, not the raw campaign list', async () => {
    const { agent, findBestProducts } = build();
    await agent.run(campaign, USER);
    const keywords = (findBestProducts.mock.calls[0] as any[])[1];
    // The seasonal term is IN, and it is first — the ProductAgent searches only the first
    // few keywords it is handed, so ordering is the difference between searching a holiday
    // term and never searching it at all.
    expect(keywords).toEqual(['שרשראות תאורה לסוכה', 'tactical flashlight']);
    expect(keywords).not.toEqual(campaign.keywords);
  });

  it("takes the seasonal window's extra post from the plan", async () => {
    // posts_per_run is 1 and the open window buys a second. Reading campaign.posts_per_run
    // here would have quietly dropped that boost everywhere agents run.
    const { agent, findBestProducts } = build();
    await agent.run(campaign, USER);
    expect((findBestProducts.mock.calls[0] as any[])[3]).toBe(2);
  });

  it('gives the copywriter the season context', async () => {
    const { agent, generateOptimizedContent } = build();
    await agent.run(campaign, USER);
    expect((generateOptimizedContent.mock.calls[0] as any[])[8]).toBe(PLAN.seasonHint);
  });

  it('passes no season line outside every window', async () => {
    // Silence is the correct output when no window is open — a stale holiday line in
    // November reads worse than none at all.
    const { agent, generateOptimizedContent } = build({ ...PLAN, seasonHint: null });
    await agent.run(campaign, USER);
    expect((generateOptimizedContent.mock.calls[0] as any[])[8]).toBeNull();
  });

  it('still reports a clean run when the plan yields no products', async () => {
    const { agent, generateOptimizedContent } = build(PLAN, []);
    const res = await agent.run(campaign, USER);
    expect(res.posts_created).toBe(0);
    expect(res.errors).toEqual([]);
    expect(generateOptimizedContent).not.toHaveBeenCalled();
  });
});
