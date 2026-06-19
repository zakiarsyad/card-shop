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
3. **Shared shell, per-provider subpaths.** The same product is built once per
   payment provider under its own subpath (`/stripe`, `/adyen`, `/xendit`),
   sharing the design system + `lib/` core but *not* a payments abstraction —
   the providers' confirm flows don't share a model
   ([ADR-0009](decisions/ADR-0009-multi-provider-structure.md)). Stripe and Xendit are built (Adyen is planned); `/` is a hub linking to each.

## Request lifecycles (follow the files)

**One-time purchase**
```
src/pages/stripe/index.astro      user picks a plan, clicks "Continue to payment"
  → src/scripts/stripe/checkout.ts POSTs { plan: "one_time" } …
    → netlify/functions/stripe-create-payment-intent.ts
        → _shared/checkout.ts   validate body + plan + idempotency key
        → src/lib/catalog.ts    resolve server-side amount
        → Stripe                create PaymentIntent → client_secret
  ← checkout.ts                 mount Payment Element, confirm → redirect
    → src/pages/stripe/success.astro + src/scripts/stripe/success.ts   read status (display only)
Stripe → netlify/functions/stripe-webhook.ts   payment_intent.succeeded → fulfill
```

**Subscription** — identical, except the middle step:
```
    → netlify/functions/stripe-create-subscription.ts
        → Stripe   create Customer + Subscription (incomplete first payment)
        → src/lib/stripe/subscription.ts   pull client_secret from first invoice
```
The browser code (`checkout.ts`) is the same for both — that's the point
([ADR-0003](decisions/ADR-0003-one-product-two-ways.md)).

## Directory map

Shared shell on the left, per-provider implementations on the right
([ADR-0009](decisions/ADR-0009-multi-provider-structure.md)).

```
src/
  lib/                  ← THE CORE. Pure, tested domain logic.
    catalog.ts            plans + per-provider prices (server-authoritative) — SHARED
    money.ts              integer minor units, zero-decimal currencies, formatting — SHARED
    idempotency.ts        replay-safe "process this event id exactly once" — SHARED
    log.ts                structured logger that redacts secrets — SHARED
    stripe/               Stripe domain logic
      payment-state.ts      PaymentIntent status → UI state machine (+ copy)
      errors.ts             Stripe errors → user-facing taxonomy (declined/network/…)
      subscription.ts       extract the first-invoice client secret from a subscription
      webhook-events.ts     event routing: payment_intent.succeeded vs invoice.* (no double-grant)
    xendit/               Xendit domain logic
      session.ts            build the Components Payment Session (PAY / SUBSCRIPTION)
      webhook.ts            x-callback-token verification + fulfillment routing
    *.test.ts             every module is unit-tested right beside it
  components/
    PlanOption.astro      one reusable plan row (per-provider price/locale) — SHARED
    TrustNote.astro       "Secured by {provider}" reassurance — SHARED
    stripe/               Stripe UI: DemoIntro, TestCards, Checkout
    xendit/               Xendit UI: DemoIntro, Checkout (+ inline-3DS modal)
  pages/                ← thin composition (Astro)
    index.astro           landing hub: links to each provider subpath — SHARED
    stripe/               index.astro (checkout) + success.astro (reads, never fulfills)
    xendit/               index.astro (checkout) + success.astro
  scripts/              ← browser controllers (vanilla TS, no framework)
    checkout-ui.ts        shared button/status/error DOM helpers — SHARED
    webhook-indicator.ts  shared success-page "webhook received" badge (poll) — SHARED
    test-cards.ts         click-to-copy for the test-card chips — SHARED
    stripe/               checkout.ts (Stripe.js confirm) + success.ts
    xendit/               checkout.ts (Components SDK confirm) + success.ts
  layouts/Layout.astro   <head>, fonts, preconnect, GA, SEO; `provider` prop → per-brand theming
  styles/global.css      design tokens (plain CSS custom properties on :root) + per-provider themes — SHARED

netlify/functions/      ← serverless endpoints (thin shells over src/lib); prefixed per provider
  stripe-create-payment-intent.ts   one-time
  stripe-create-subscription.ts     recurring
  stripe-webhook.ts                 verifies signature, routes events, "fulfills", marks receipt
  stripe-webhook-status.ts          has this payment's webhook arrived? (success-page indicator)
  xendit-create-session.ts          create a Components Payment Session (PAY / SUBSCRIPTION)
  xendit-webhook.ts                 verify x-callback-token, route to fulfillment, mark receipt
  xendit-webhook-status.ts          has this payment's webhook arrived? (success-page indicator)
  _shared/
    checkout.ts              shared request parsing/validation
    stripe.ts / xendit.ts    provider API clients (reject live keys)
    http.ts                  json()/errorResponse()/readJson() helpers
    webhook-store.ts         Netlify Blobs receipt marker (Stripe: PaymentIntent id; Xendit: reference_id)

docs/                   ← read these to understand the "why" (start with README.md)
```

## "Where do I change…?"

| You want to… | Edit |
|---|---|
| Change a price or add a plan | `src/lib/catalog.ts` (+ a Stripe Price ID in `.env`) |
| Change a user-facing error message | `src/lib/stripe/errors.ts` |
| Change what a payment status shows | `src/lib/stripe/payment-state.ts` (`STATE_COPY`) |
| Handle a new webhook event | `src/lib/stripe/webhook-events.ts` |
| Change the checkout card UI | `src/components/stripe/Checkout.astro` (+ `PlanOption.astro`) |
| Change the left-column pitch / test cards | `src/components/stripe/DemoIntro.astro` / `TestCards.astro` |
| Change the page layout (two columns) | `src/pages/stripe/index.astro` |
| Change the confirm/3DS flow | `src/scripts/stripe/checkout.ts` |
| Change colors / type / spacing | `@theme` block in `src/styles/global.css` |

## Conventions a new dev should know

- **TDD.** Logic goes in `src/lib/` with a co-located `*.test.ts`; write the
  test first. Run `npm test`. Don't unit-test framework glue or trivial getters.
- **Money is integer minor units.** Never floats. Use `src/lib/money.ts`.
- **Secrets only in `.env`** (gitignored). `.env.example` is the committed
  template. Never log secrets — `log.ts` redacts them defensively.
- **No UI framework.** The checkout is a vanilla-TS Astro island
  (`src/scripts/stripe/checkout.ts`), *not* a React component, to keep first-load JS
  tiny — the Payment Element loads from Stripe's CDN only when the user intends
  to pay. (An earlier sketch imagined a React `CheckoutForm.tsx`; we went vanilla
  to meet the performance budget in [`STANDARDS.md`](STANDARDS.md).)
- **Stripe-aligned design.** One variable sans (Inter) everywhere; Stripe's
  navy/slate palette with the `#635BFF` blurple. Tokens are the `@theme` block in
  `src/styles/global.css`; rationale in
  [`decisions/ADR-0006`](decisions/ADR-0006-visual-design-language.md). The CTA
  copy is plan-aware so a subscription never reads as a one-time charge.

## Run it locally

See [`README.md`](../README.md#getting-started). In short: `npm install`,
fill `.env` from `.env.example`, `npm run dev` (Netlify dev on :8888), and
`stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook`
in a second terminal. `npm test` runs the unit suite.
