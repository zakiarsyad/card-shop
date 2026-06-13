# Architecture & Code Map

New here? Read this first — it's the 5-minute tour. For *why* the big choices
were made, see [`decisions/`](decisions/). For the quality bar, see
[`STANDARDS.md`](STANDARDS.md).

## The 30-second mental model

> One product, sold two ways (one-time **$49** or **$9/mo**). Both flows end at
> the **same** client step: confirming a PaymentIntent with Stripe's Payment
> Element. The only difference is which server endpoint creates that intent.
> Fulfillment never happens in the browser — it happens on a Stripe **webhook**.

Two principles drive the whole layout:

1. **Pure core, thin shell.** All real logic lives in `src/lib/` as pure,
   framework-free functions with co-located tests. The Netlify functions and
   the browser scripts are thin wiring around that core. If you're looking for
   *behavior*, it's in `src/lib/`. If you're looking for *plumbing*, it's in
   `netlify/functions/` or `src/scripts/`.
2. **The server decides money; the client only picks a key.** The browser sends
   a plan key like `"one_time"`; the server resolves the real amount and price
   ([ADR-0004](decisions/ADR-0004-server-side-catalog.md)).

## Request lifecycles (follow the files)

**One-time purchase**
```
src/pages/index.astro        user picks a plan, clicks "Continue to payment"
  → src/scripts/checkout.ts   POSTs { plan: "one_time" } …
    → netlify/functions/create-payment-intent.ts
        → _shared/checkout.ts   validate body + plan + idempotency key
        → src/lib/catalog.ts    resolve server-side amount
        → Stripe                create PaymentIntent → client_secret
  ← checkout.ts                 mount Payment Element, confirm → redirect
    → src/pages/success.astro + src/scripts/success.ts   read status (display only)
Stripe → netlify/functions/stripe-webhook.ts   payment_intent.succeeded → fulfill
```

**Subscription** — identical, except the middle step:
```
    → netlify/functions/create-subscription.ts
        → Stripe   create Customer + Subscription (incomplete first payment)
        → src/lib/subscription.ts   pull client_secret from first invoice
```
The browser code (`checkout.ts`) is the same for both — that's the point
([ADR-0003](decisions/ADR-0003-one-product-two-ways.md)).

## Directory map

```
src/
  lib/                  ← THE CORE. Pure, tested domain logic.
    catalog.ts            plans, amounts, price-id resolution (server-authoritative)
    money.ts              integer minor units, zero-decimal currencies, formatting
    payment-state.ts      Stripe PaymentIntent status → UI state machine (+ copy)
    errors.ts             Stripe errors → user-facing taxonomy (declined/network/…)
    subscription.ts       extract the first-invoice client secret from a subscription
    idempotency.ts        replay-safe "process this event id exactly once"
    webhook-events.ts     which events we handle and what each means (grant/revoke/…)
    log.ts                structured logger that redacts secrets
    *.test.ts             every module is unit-tested right beside it
  pages/                ← static HTML (Astro)
    index.astro           product page + plan toggle (the only marketing copy)
    success.astro         post-payment status page (reads, never fulfills)
  scripts/              ← browser controllers (vanilla TS, no framework)
    checkout.ts           the interactive island: loads Stripe.js, confirms payment
    success.ts            reads PaymentIntent status for display
  layouts/Layout.astro   <head>, fonts, preconnect
  styles/global.css      design tokens (Tailwind v4 @theme) + base styles

netlify/functions/      ← serverless endpoints (thin shells over src/lib)
  create-payment-intent.ts   one-time
  create-subscription.ts     recurring
  stripe-webhook.ts          verifies signature, routes events, "fulfills"
  _shared/
    checkout.ts              shared request parsing/validation for both creates
    stripe.ts                Stripe client factory (rejects live keys)
    http.ts                  json()/errorResponse()/readJson() helpers

docs/                   ← read these to understand the "why" (start with README.md)
```

## "Where do I change…?"

| You want to… | Edit |
|---|---|
| Change a price or add a plan | `src/lib/catalog.ts` (+ a Stripe Price ID in `.env`) |
| Change a user-facing error message | `src/lib/errors.ts` |
| Change what a payment status shows | `src/lib/payment-state.ts` (`STATE_COPY`) |
| Handle a new webhook event | `src/lib/webhook-events.ts` |
| Change the checkout UI / layout | `src/pages/index.astro` + `src/styles/global.css` |
| Change the confirm/3DS flow | `src/scripts/checkout.ts` |
| Change colors / type / spacing | `@theme` block in `src/styles/global.css` |

## Conventions a new dev should know

- **TDD.** Logic goes in `src/lib/` with a co-located `*.test.ts`; write the
  test first. Run `npm test`. Don't unit-test framework glue or trivial getters.
- **Money is integer minor units.** Never floats. Use `src/lib/money.ts`.
- **Secrets only in `.env`** (gitignored). `.env.example` is the committed
  template. Never log secrets — `log.ts` redacts them defensively.
- **No UI framework.** The checkout is a vanilla-TS Astro island, *not* a React
  component, to keep first-load JS tiny (Payment Element loads from Stripe's CDN
  only when the user intends to pay). This is a deliberate deviation from the
  `CheckoutForm.tsx` sketch in `CLAUDE.md`, made to meet the performance budget
  in [`STANDARDS.md`](STANDARDS.md).

## Run it locally

See [`README.md`](../README.md#getting-started). In short: `npm install`,
fill `.env` from `.env.example`, `npm run dev` (Netlify dev on :8888), and
`stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook`
in a second terminal. `npm test` runs the unit suite.
