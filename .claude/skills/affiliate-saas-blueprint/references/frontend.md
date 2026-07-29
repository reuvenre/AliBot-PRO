# Frontend

Next.js App Router. The dashboard is a control panel for the automation, not the product
itself — most of the value is server-side, so resist over-building here.

## Route groups

```
src/app/
├── (auth)/          public — login, register, forgot/reset password, OAuth callback
├── (dashboard)/     protected — layout enforces authentication
│   ├── dashboard/   overview
│   ├── campaigns/   list, new, [id]
│   ├── posts/ scheduled/ quick-post/
│   ├── products/ products/discover/
│   ├── groups/      channels + per-channel window/interval
│   ├── templates/ coupons/ suppliers/
│   ├── reports/ orders/
│   ├── settings/    credentials, subscription, preferences
│   └── admin/       users, promotions, security
├── pricing/ blog/ compare/ terms/ privacy/    public marketing + SEO
└── r/[code]/        short-link resolver → records click → redirects
```

Path alias `@/` → `src/`.

## Auth flow

**`middleware.ts` only redirects unauthenticated users — it makes no API calls.** Calling the
API from middleware invalidates ISR caching for every request and slows the whole app. Real
session validation happens inside the dashboard layout via a `useAuth` hook.

The split is deliberate: middleware does the cheap, static check (is there a token at all);
the layout does the authoritative one (is it valid, what plan).

## API client

`src/lib/api-client.ts` is the single shared Axios instance:

- attaches the JWT access token from `localStorage`
- on 401, refreshes via the refresh cookie and retries the original request once
- queues concurrent requests during a refresh so five parallel 401s trigger one refresh

**Always use this instance.** A raw `axios` call skips the refresh handling, so it fails
whenever the 15-minute access token has expired — an intermittent bug that reproduces only
after idling.

## Plan-aware UI

Fetch plans and the user's entitlements from the API (`GET /subscription/plans`) and drive the
UI from that response. Hardcoding feature lists in components is how the pricing page ends up
promising something the backend doesn't grant.

Locked features should be **visible but disabled**, with the required plan named. Hiding them
entirely removes the upgrade prompt, which is the point of tiering.

## RTL and i18n

If the client's market is RTL (Hebrew, Arabic):

- `dir="rtl"` at the layout level; use logical CSS properties (`margin-inline-start`, not
  `margin-left`) so a future LTR deployment doesn't need a rewrite.
- Localise error pages too — untranslated error states are the most-seen untranslated screens.
- Number, currency, and date formatting via `Intl`, not string concatenation.
- Verify both light and dark themes explicitly. Accent colours that read fine on dark
  frequently fail contrast on light; state banners (success/warning/error) need colours
  declared per theme rather than inherited.

## Screens that matter

Ranked by how much support load they remove:

1. **Settings → credentials**, with a **Test connection** button per integration that makes a
   real API call and reports a specific, actionable result. This single feature deflects more
   support than everything else combined — "your Facebook token expired, reconnect here"
   instead of "it stopped working".
2. **Campaign editor** — keywords, cron, filters, channels, platforms, language. This is where
   users spend their time; make the cron human-readable ("every hour, 09:00–22:00").
3. **Scheduled/queue view** — what is about to go out, with the ability to cancel or reschedule.
   Users need to see the pipeline to trust the automation.
4. **Reports** — revenue per campaign/keyword/channel. The retention driver.
5. **Quick post** — a manual one-off publish. Every client asks for it within a week.
6. **Guide** — an in-app setup walkthrough for obtaining each platform's tokens. Token
   acquisition is the hardest part of onboarding, by a wide margin.

## Legal and compliance

Cookie consent, Terms, Privacy, and a footer linking them. Required for ad platforms and app
review, trivial to add up front, tedious to retrofit.

## Dependency posture

Keep Next, React, and axios reasonably current — this stack accumulates security advisories
faster than most, and jumping several majors at once during an incident is far worse than
routine upgrades.
