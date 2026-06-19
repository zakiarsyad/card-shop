# Tasks

Living checklist, kept in sync with `PLAN.md`. Each task was implemented
test-first and committed per milestone (see the git history).

Items marked **(you)** require your Stripe account or a deploy target, so they
can't be done from code alone — they're set up and documented, ready to run.

## M0 — Setup

- [x] Init Astro + TypeScript project; CSS design tokens (plain `:root` custom properties — Tailwind, originally used only for `@theme` token declarations, was removed in M9)
- [x] Add Netlify config + functions directory (`netlify.toml`, `netlify/functions/`)
- [x] Install `stripe` and `@stripe/stripe-js`
- [x] Create a test Product + two Prices in Stripe; record the Price IDs
- [x] Create `.env.example`; create `.env`; add `.env` to `.gitignore`

## M1 — Catalog + one-time intent

- [x] Server-side catalog mapping product keys → Price IDs + amounts
- [x] `create-payment-intent` function: amount from catalog, idempotency key
- [x] Return `client_secret`; handle and shape errors

## M2 — Payment Element + confirm

- [x] Product page UI with a one-time / subscribe toggle
- [x] Mount the Payment Element with the `client_secret`
- [x] Shared confirm handler
- [x] State handling: `requires_action` (3DS), `processing`, `succeeded`, `failed`
- [x] Error taxonomy: declined vs network vs validation
- [x] Success page that reads status (does not fulfill)

## M3 — Subscription flow

- [x] Verify the current Stripe subscription API in the docs
- [x] `create-subscription`: Customer + Subscription with an incomplete first payment
- [x] Return the first invoice's PaymentIntent `client_secret`
- [x] Reuse the same confirm path

## M4 — Webhooks

- [x] `stripe-webhook` with signature verification
- [x] Handle `payment_intent.succeeded` / `payment_intent.payment_failed`
- [x] Handle `invoice.paid` / `invoice.payment_failed` / `customer.subscription.*`
- [x] Idempotent processing (replay-safe)
- [x] Log / stub fulfillment

## M5 — Polish + ship

- [x] Loading + trust states; error-taxonomy UX
- [x] Accessibility pass: keyboard, visible focus, reduced motion, AA contrast
- [x] Performance: static-by-default, ~3 KB gz product-page JS (budget 30 KB)
- [x] Defer Stripe.js to point-of-pay; `preconnect` to Stripe
- [x] Review + simplify pass over the codebase
- [x] Finalize README + diagram + production-notes section
- [x] Deploy to Netlify ([checkout.zakiarsyad.com](https://checkout.zakiarsyad.com)); env vars set
- [x] Register the production webhook; set `STRIPE_WEBHOOK_SECRET`
- [x] Card-only payment methods for a clear demo (see ADR-0007)
- [x] Lighthouse (mobile, production build): Perf/A11y/Best-Practices/SEO all 100; LCP ~1.5s, CLS 0
- [ ] Re-run Lighthouse against the live URL for real CDN/network numbers **(you, optional)**
- [ ] Verify both flows in-browser on the deployed URL **(you)**

## M6 — Multi-provider shell

- [x] Move the Stripe checkout under `/stripe` (pages, components, scripts)
- [x] Landing hub at `/` linking to each provider (Adyen/Xendit "coming soon")
- [x] Per-provider theming hook: Layout `provider` prop → `data-provider` tokens
- [x] ADR-0009 (structure) + ADR-0010 (theming); reframe README / ARCHITECTURE / CLAUDE

## M7 — Xendit (one-time built)

- [x] Verify Xendit's Components API (Payment Sessions, `mode: COMPONENTS`, callback token) in the docs
- [x] Create a Xendit test account + key **(you)**
- [x] Per-provider catalog pricing (IDR) + `priceFor`; IDR formatted as whole rupiah
- [x] `xendit-create-session` function (Basic auth, test-key guard) + request-builder tests
- [x] `/xendit` page + Components island (cards-only, inline 3-D Secure) + Xendit brand theme
- [x] End-to-end browser test — **verified over an HTTPS cloudflared tunnel**: card `4000 0000 0000 1000`
      → Components form → Pay → `/xendit/success`. (Xendit Components requires HTTPS, so it can't run on
      `http://localhost` — it works on the deployed HTTPS site; the dev tunnel needs `allowedHosts` in astro.config.)
- [x] `xendit-webhook` — `x-callback-token` verification + `payment.capture` → fulfillment routing
      (auth + fulfillment verified locally; cross-instance replay-safety is the same in-memory
      demo-scope as the Stripe webhook — durable store for prod)
- [x] Xendit brand theme (`#0066FF`) via `data-provider` tokens; no "Stripe" wording on the page
- [x] Test-card panel notes Xendit's "Simulate scenario" button
- [x] 3-D Secure renders in a centered modal overlay (not inline below the form)
- [x] Subscription parity — plan toggle + `session_type: "SUBSCRIPTION"` (monthly schedule + demo customer);
      session creation verified live for both plans. (Subscription completes via Xendit's card-save
      verification step — shown in the modal; confirm interactively in a real browser.)
- [x] Namespace per provider: `lib/stripe`/`lib/xendit`, `stripe-*`/`xendit-*` functions; shared
      code stays unprefixed (`lib/` core, `PlanOption`/`TrustNote`, `scripts/test-cards.ts`, `_shared/`)
- [x] Live success indicator on `/xendit/success` (webhook receipt marker + poll), like Stripe
      — keyed by the session `reference_id` (echoed in `payment.capture`); `xendit-webhook-status` endpoint

## M8 — Adyen (deferred)

- [ ] Deferred — a test account is hard to obtain. Build `/adyen` (Drop-in + webhook HMAC) when available.

## M9 — Cleanup & hardening

- [x] Xendit subscription completion: the Components SDK (v0.0.24) doesn't emit `session-complete`
      for SUBSCRIPTION sessions, so the island also polls our own `xendit-webhook-status` and navigates
      once the server confirms the session (webhook = source of truth, ADR-0002). One-time still uses the event.
- [x] Removed Tailwind CSS — it was pulled in only to declare design tokens via `@theme`, with no
      utility classes or `@apply` anywhere. Replaced with plain `:root` custom properties; dropped
      `tailwindcss` + `@tailwindcss/vite`. No visual change.
- [x] De-duplicated the providers: shared `scripts/checkout-ui.ts` (button/status/error helpers) and
      `scripts/webhook-indicator.ts` (the success-page badge), both used by Stripe and Xendit.
- [x] Audited for dead code / unused deps / unoptimized paths — none found.
- [x] Two-domain serve: `checkout.zakiarsyad.com` → the multi-provider site; `/` → `/stripe`;
      `/stripe` and `/xendit` serve directly. Stripe + Xendit webhooks registered to that host.
