# CLAUDE.md

Project context for Claude Code. Read this first, then `docs/PLAN.md` and `docs/TASKS.md`.

## What this is

A minimal, production-minded checkout that sells one digital product two ways — a
one-time purchase and a recurring subscription. It's a portfolio piece: the point is to
demonstrate engineering judgment in payments, not feature breadth. Full intent in `docs/PRD.md`.

The same product is built once **per payment provider** under its own subpath (`/stripe`,
`/adyen`, `/xendit`), sharing the design system + `lib/` core but not a payments abstraction —
the providers' flows don't share a model ([ADR-0009](docs/decisions/ADR-0009-multi-provider-structure.md)).
**Stripe and Xendit are built; Adyen is planned.** `/` is a hub linking to each. Code is
namespaced per provider (`pages/<p>/`, `components/<p>/`, `scripts/<p>/`, `lib/<p>/`, and
`<p>-*` functions); shared primitives stay unprefixed. Most rules below describe Stripe but
apply equally to Xendit.

## Stack

- Astro (static output) + TypeScript + plain CSS (hand-authored design tokens on `:root`, no CSS framework)
- Netlify Functions (serverless) for server endpoints + the provider webhooks
- Stripe Node SDK on the server; Stripe.js + Payment Element on the client
- Stripe **test mode only** — no live keys, ever

## Architecture (the core idea)

Both purchase flows converge on one client step: confirming a PaymentIntent with the Payment Element.

- One-time → server creates a PaymentIntent → returns `client_secret`
- Subscription → server creates a Customer + Subscription → returns the first invoice's PaymentIntent `client_secret`
- The same Payment Element confirms either. **The difference is entirely server-side.**

Reasoning lives in `docs/decisions/`.

## Project structure (as built)

The Payment Element is a **vanilla-TS island, not a React component** (kept that
way to meet the performance budget — see ADR-0006 / STANDARDS). Full code map and
"where do I change X" live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```
src/
  pages/
    index.astro          # landing hub (links to each provider) — SHARED
    stripe/ , xendit/    # each: index.astro (checkout) + success.astro
  components/
    PlanOption.astro      # reusable plan row (per-provider price/locale) — SHARED
    TrustNote.astro       # "Secured by {provider}" — SHARED
    stripe/ , xendit/     # provider-flavoured UI (Checkout, DemoIntro, …)
  scripts/
    test-cards.ts         # click-to-copy chips — SHARED
    stripe/ , xendit/     # browser islands (vanilla TS): checkout (+ stripe success)
  lib/                   # catalog/money/idempotency/log/brand SHARED;
    stripe/ , xendit/    #   provider domain logic (payment-state/errors/… ; session/webhook)
  layouts/Layout.astro   # <head>, SEO, `provider` prop → per-brand theming (ADR-0010)
netlify/functions/       # prefixed per provider (stripe-* / xendit-*)
  stripe-create-payment-intent.ts / stripe-create-subscription.ts
  stripe-webhook.ts / stripe-webhook-status.ts
  xendit-create-session.ts / xendit-webhook.ts
  _shared/                 # stripe.ts / xendit.ts clients, http helpers, request parsing
.env.example
.gitignore
```

## Hard rules (non-negotiable)

1. **Never commit secrets.** `.env` is gitignored; only `.env.example` ships. This is a public repo.
2. **Amounts are computed server-side** from the catalog. The client sends only a product/price key — never a price or amount.
3. **Fulfillment happens on webhooks, never on the redirect/success URL.**
4. **Use idempotency keys** when creating PaymentIntents and Subscriptions.
5. **Verify the Stripe webhook signature** before processing any event.
6. **Handle every PaymentIntent state**: `requires_action` (3DS), `processing`, `succeeded`, `failed` — each with real UX.
7. **No raw card data** touches our server or repo. The Payment Element handles it.

## Quality bar

See `docs/STANDARDS.md` for the full bar across design, engineering, performance, and domain.
It is not optional: a milestone isn't done until it meets the bar and its critical-path tests pass.

## Workflow & tooling — agent-skills

This repo uses the [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) plugin.

```
/plugin marketplace add addyosmani/agent-skills
/plugin install agent-skills@addy-agent-skills
```

Lifecycle: `/spec` → `/plan` → `/build` → `/test` → `/review` → `/code-simplify` → `/ship`.

These docs already are the spec — they follow `spec-driven-development` and `documentation-and-adrs`,
so do not regenerate them from scratch. Start at `/plan` to break `docs/TASKS.md` into atomic,
acceptance-criteria'd tasks, then `/build` each slice test-first.

Lean on these skills for the quality pillars:

- UI/UX → `frontend-ui-engineering`
- Tests → `test-driven-development`, `browser-testing-with-devtools`
- Performance → `performance-optimization`
- Payments rigor → `security-and-hardening`, `observability-and-instrumentation`, `doubt-driven-development`
- Stripe API correctness → `source-driven-development` (this is how you satisfy the rule below)

## Before implementing the subscription flow

Stripe's first-invoice PaymentIntent flow has shifted across API versions. Verify the current
approach against the official Stripe docs (https://docs.stripe.com) before writing
`create-subscription`: confirm the SDK version, how to create a subscription with an incomplete
first payment, and how to surface that PaymentIntent's client secret.

## Environment variables

- `PUBLIC_STRIPE_KEY` — test publishable key (`pk_test_…`), client-side
- `STRIPE_SECRET_KEY` — test secret key (`sk_test_…`), server-side
- `STRIPE_WEBHOOK_SECRET` — from `stripe listen` locally / dashboard in prod
- `PRICE_ONE_TIME`, `PRICE_SUBSCRIPTION` — Stripe test Price IDs

## How to work this project

Build phase by phase per `docs/PLAN.md`, starting at the first unchecked milestone. For each
slice: write the test first, implement, verify locally, confirm it meets `docs/STANDARDS.md`,
check off items in `docs/TASKS.md`, then commit with a Conventional Commit tagged to the
milestone (e.g. `feat(m2): payment element confirm flow`). Ask before anything destructive, and
before anything that publishes or deploys.
