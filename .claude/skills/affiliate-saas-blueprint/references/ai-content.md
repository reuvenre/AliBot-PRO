# AI Content and Agents

## Multi-provider abstraction

One service, three providers, automatic fallback:

```ts
export type AiProvider = 'anthropic' | 'openai' | 'gemini';

generate(opts: {
  userId, prompt, system?, images?, maxTokens?, provider?
}): Promise<{ text: string; provider: AiProvider; tokens: number }>
```

Resolution: the user's `ai_provider` preference → whichever provider has a usable key →
platform fallback key.

**Fail over to a secondary provider, don't dump to a default.** The original implementation
fell back to a hardcoded default model on any error, which meant a user's misconfigured key
silently burned the platform's quota while appearing to work. Try the next *configured*
provider, and surface the failure if none succeed.

### Per-user keys and metering

Users can supply their own AI keys (their cost, their rate limits) or use the platform's
(your cost — meter it). Track every call in an `ai_usage` table: user, provider, model,
prompt/completion tokens, feature. Enforce `ai_monthly_token_budget` per credential set.

Without metering, AI cost is invisible until the bill arrives, and you cannot price the
product.

### Model catalogs go stale

Model families retire without notice. Two defences, both learned the hard way:

- **Discover models at runtime** from the provider's catalog endpoint, cache the working one
  per API key, and re-discover when a call fails with a model error. Image generation that
  self-heals beats image generation that dies silently with its model.
- **Populate UI dropdowns from the live catalog**, never from a hardcoded list — a hardcoded
  dropdown guarantees a future support ticket.

Also gate provider-specific request options by model family (e.g. thinking-config parameters
that only exist on certain generations), or requests to older models get rejected.

## Copywriting

Copy is **per platform and per language**, not one blob reused everywhere:

| Destination | Shape |
|---|---|
| Telegram / WhatsApp | short, urgency, emoji, price-forward, local language |
| Facebook | slightly longer, conversational |
| Instagram | visual-first caption, hashtags |
| Pinterest | English, SEO/keyword-rich, descriptive — it is a search engine |

Inputs to the prompt: product title, price (already converted), discount, rating, target
language, channel persona, and template constraints.

**Feed back what worked.** Include a sample of recent high-performing posts (by clicks or
earnings) in the prompt so copy adapts to the channel's audience over time. This is the
cheapest quality win in the system.

**Constrain length in the prompt to the destination's real limit** (Telegram media captions
~1024 chars). Truncating afterwards cuts mid-sentence and looks broken.

**Strip inline affiliate URLs from generated output.** Models reproduce raw URLs from
examples, which bypasses your short link and splits attribution.

## Agents

Optional autonomous layer, opt-in per campaign (`use_agents`). Each agent is a Claude
tool-use loop with a narrow tool set and a single responsibility:

| Agent | Job |
|---|---|
| `ProductAgent` | find and rank products for the campaign's intent |
| `ContentAgent` | write optimised copy, learning from recent sent posts |
| `CampaignAgent` | evaluate health, auto-pause on high failure rate, refresh dead keywords |
| `OrchestratorAgent` | run the three in sequence, log to `agent_runs` |

Triggered manually (`POST /agents/run { campaign_id }`) or by the scheduler when the campaign
opts in.

Design rules that keep this maintainable:

- **The plain runner must remain fully functional.** Agents are an enhancement, not a
  replacement. If agents are unavailable, the plan doesn't allow them, or they error, fall
  back to the deterministic path — a campaign should never go silent because an agent failed.
  A related bug worth avoiding: keying the agent path off "is the orchestrator injected"
  rather than off `campaign.use_agents` routes *every* campaign through the agents.
- **Log every run** to `agent_runs` (inputs, tool calls, decisions, outcome). Autonomous
  behaviour you can't audit is behaviour you can't debug or explain to a customer.
- **Bound the loop** — max iterations, max tokens, timeout. An agent in a retry spiral against
  a failing API is expensive.
- **Give agents read-mostly tools.** Let them propose keyword changes and pause campaigns;
  don't let them publish directly, spend money, or edit credentials.

## Learning optimizer

A nightly non-agent job that closes the loop with plain statistics — simpler and more
predictable than an agent for this task:

1. Score each keyword by clicks and attributed revenue per post over a window.
2. Retire consistently dead keywords; boost winners' weight in rotation.
3. Write an `optimizer_run` row.
4. Send a morning digest to the owner (Telegram + email).

Two operational cautions: gate the digest by plan, and **route each customer's digest to that
customer's channel** — an early version sent customer digests to the operator's own Telegram,
which is both a leak and a support incident.

## Image generation

AI image enhancement (background removal, "redesign" modes) is slow and per-call expensive.
Gate it to a paid tier, make it opt-in per campaign, cache aggressively, and always fall back
to the original product image on failure. It must never block a post.
