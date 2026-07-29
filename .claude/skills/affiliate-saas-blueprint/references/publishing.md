# Publishing

## Adapter shape

One function per platform, same signature, selected by a fan-out loop:

```ts
type PublishResult = { ok: boolean; externalId?: string; error?: string };

async function publishTelegram(post, creds, channelId): Promise<PublishResult>
async function publishFacebook(post, creds, pageId): Promise<PublishResult>
// ...
```

The fan-out resolves which platforms apply (`campaign.target_platforms ?? all enabled`),
intersects with what the user's **plan** allows, intersects with what they have credentials
for, then calls each adapter and records per-platform success. Partial success is normal —
Instagram rejecting an image must not mark the whole post failed and suppress the Telegram
send that already succeeded.

Store the external message id per platform. You need it to edit or delete later (promo
expiry, takedowns).

## Platform notes

### Telegram

The primary channel and the most forgiving. Endpoints: `sendPhoto`, `sendMessage`,
`sendMediaGroup`, `editMessageCaption`, `editMessageText`, `deleteMessage`.

- **Caption limit** is ~1024 chars for media, ~4096 for text. Copy that fits a text post
  will silently fail as a photo caption. Truncate to the limit and send the remainder as a
  follow-up message rather than losing it.
- **Text-only posts** must use `sendMessage`; `sendPhoto` with no image errors out. A custom
  scheduled announcement with no product image hits this.
- **Upload timeouts**: multi-image albums need generous timeouts. 40 seconds is a working
  value for an album; anything tighter fails on large images intermittently.
- **Deletion window**: Telegram only allows deleting messages up to 48 hours old. Past that,
  *edit* the message to an "ended" state instead. Expiring promos need both paths.
- **429 handling**: Telegram returns `parameters.retry_after`. Honour it — see `reliability.md`.

### Facebook / Instagram (Meta Graph)

- Pin the Graph version in one constant (`GRAPH_VERSION`); scattered version strings become
  an upgrade archaeology project.
- Facebook page post: `POST /{page_id}/feed`.
- Instagram is **two-phase**: create a media container, then publish the container id. Both
  can fail independently; treat a created-but-unpublished container as a failure and retry
  the whole sequence rather than resuming.
- Instagram requires a **public image URL** — it fetches the image itself. Locally generated
  images must be hosted somewhere reachable first.
- Long-lived page tokens expire (~60 days). Track `token_expires_at`, warn before expiry,
  notify once.

### Pinterest

`POST https://api.pinterest.com/v5/pins`. Needs a board id and a public image URL.
Pinterest is search-driven, so it rewards different copy from Telegram — English, keyword-rich,
SEO-shaped descriptions rather than urgency/emoji copy. Make copy generation platform-aware
(see `ai-content.md`).

### WhatsApp

Two provider paths, and clients will have opinions about which:

- **Cloud API** (`POST /{phone_number_id}/messages`) — official, requires business
  verification and template approval for anything proactive.
- **Green API** or similar unofficial bridges — instant to set up, works with groups, but
  carries account-ban risk.

Model this as `whatsapp_provider` on the credential row with the provider-specific fields
(`green_api_url`, `green_api_instance_id`, `green_api_token_enc`, `whatsapp_group_id`)
alongside the Cloud API ones. Never hardcode one provider's base URL — let it be configurable
(and SSRF-guard it, since it becomes a user-supplied URL).

### Relay / webhook publishing (Make, Zapier, n8n)

An escape hatch worth building: `publish_via_make` + `make_webhook_url` posts the payload to
an automation platform that handles the last mile. It unblocks clients whose platform access
you can't get approved, and costs about 30 lines.

Because the URL is user-supplied, it **must** go through the SSRF guard with
`maxRedirects: 0`.

## Content assembly

Order of operations matters — each step can invalidate the previous:

1. **Resolve the product** (title, price, images, rating, discount).
2. **Convert price** — live FX rate, per-user markup, shipping buffer, rounding mode.
   Cache the rate; never hardcode it. Keep a *last-good* rate to fall back on when the FX
   provider is down, so pricing degrades to slightly-stale rather than broken.
3. **Generate copy** — AI, per platform and per language.
4. **Build the short link** — and strip any inline legacy affiliate URLs the AI or the
   template may have carried over, so attribution isn't split across two links.
5. **Prepare images** — download, optionally enhance/collage, respect per-platform limits.
6. **Apply template** — body + footer around the generated copy.

Step 4's stripping requirement is not obvious: models happily reproduce a raw affiliate URL
they saw in an example, and then half your clicks bypass tracking.

## Images

- Multi-image posts: build a collage or an album. Both need a size/count cap per platform.
- AI image enhancement (background cleanup, redesign) is a paid-tier feature — it is slow and
  costs per call, so gate it and make it opt-in per campaign.
- Always have a text-only fallback. An image pipeline failure must degrade to a text post,
  not to no post.
- Fetching remote images is a user-supplied-URL operation: SSRF guard, size cap, timeout.

## Failure handling

- Record `error_message` on the post, keep the row, mark `failed`. Deleting failed posts
  destroys the evidence needed to diagnose a pattern.
- A high failure rate on a campaign should **auto-pause** it and notify the owner rather than
  burning quota against a broken token for days.
- Notify the owner in their language, with an actionable next step ("reconnect Facebook in
  Settings"), not a raw API error string.
