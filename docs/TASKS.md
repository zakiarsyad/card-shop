# Tasks

Living checklist, kept in sync with `PLAN.md`. Each task was implemented
test-first and committed per milestone (see the git history).

Items marked **(you)** require your Stripe account or a deploy target, so they
can't be done from code alone — they're set up and documented, ready to run.

## M0 — Setup

- [x] Init Astro + TypeScript project; add Tailwind CSS v4
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
