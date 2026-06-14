# Checkout

**Live:** [checkout.zakiarsyad.com](https://checkout.zakiarsyad.com)

A minimal, production-minded checkout that sells one product two ways — **one-time purchase**
or **subscription** — on Astro + Netlify Functions, using Stripe's Payment Element.

Built as a portfolio piece. The goal isn't feature breadth; it's the judgment that separates a
real payments integration from a tutorial: webhook-driven fulfillment, idempotency,
server-authoritative pricing, and complete payment-state handling.

> Runs in Stripe **test mode** only. No real money moves.

## Why it's built this way

- **Payment Element + PaymentIntent, not a hand-built card form.** Owning the UI without owning
  PCI scope is the senior trade-off. → [`docs/decisions/ADR-0001`](docs/decisions/ADR-0001-payment-element-over-raw.md)
- **Fulfillment on webhooks, never the redirect.** A user can close the tab before redirect; the
  webhook is the source of truth. → [`ADR-0002`](docs/decisions/ADR-0002-webhook-over-redirect.md)
- **One product, two ways — a shared confirm path.** Both flows reduce to confirming a
  PaymentIntent client-side; only the server differs. → [`ADR-0003`](docs/decisions/ADR-0003-one-product-two-ways.md)
- **Server-authoritative pricing.** The client sends a product key, never an amount. →
  [`ADR-0004`](docs/decisions/ADR-0004-server-side-catalog.md)
- **Astro + Netlify Functions.** Static frontend, serverless endpoints, one deploy target. →
  [`ADR-0005`](docs/decisions/ADR-0005-astro-netlify-functions.md)
- **Stripe-aligned visual design.** One sans (Inter), Stripe's palette + blurple. →
  [`ADR-0006`](docs/decisions/ADR-0006-visual-design-language.md)
- **Card-only, on purpose.** A focused demo; display is driven by the account's payment-method
  configuration, not the intent. → [`ADR-0007`](docs/decisions/ADR-0007-card-only-payment-methods.md)

**New to the code?** Start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — a 5-minute
code map: the request lifecycle traced through the actual files, a directory guide, and a
"where do I change X?" table.

Full reasoning lives in `docs/`. The quality bar — design, engineering, performance, and
payments depth — is written down in [`docs/STANDARDS.md`](docs/STANDARDS.md). How I work the repo
(spec-driven and markdown-first): [`docs/PROCESS.md`](docs/PROCESS.md).

## Stack

Astro · TypeScript · Tailwind CSS v4 · Netlify Functions · Stripe (Payment Element + Node SDK)

## Architecture

```
            choose plan
 [product page] ──────────────┐
                              ▼
        one-time ──► /create-payment-intent ──┐
                                              ├──► client_secret
        subscribe ─► /create-subscription ────┘        │
                                                        ▼
                                          [Payment Element confirm]
                                                        │
                                              3DS challenge if required
                                                        │
                                                        ▼
                              Stripe ──► /stripe-webhook ──► fulfillment
                              (payment_intent.succeeded / invoice.paid)
```

The client always does the same thing — confirm a PaymentIntent. The two server endpoints just
create that intent differently.

## Getting started

Prerequisites: Node 20+, a Stripe account (test mode), the Stripe CLI.

1. `npm install`
2. `cp .env.example .env` and fill in your test keys + Price IDs
3. `npm run dev`
4. Forward webhooks locally:
   `stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook`
   then put the printed signing secret in `STRIPE_WEBHOOK_SECRET`

### Test cards

| Scenario | Number |
|----------|--------|
| Success | `4242 4242 4242 4242` |
| Requires 3DS | `4000 0025 0000 3155` |
| Declined | `4000 0000 0000 0002` |

Any future expiry, any CVC, any ZIP.

## Production notes (deliberately out of scope)

This is a focused demo, not a production system. In a real deployment I'd add: a persistence
layer with a ledger and reconciliation against Stripe, dunning on failed subscription renewals,
an audit trail for every payment-lifecycle event, alerting on webhook failures and anomalies,
and a formal review of PCI SAQ-A scope. They're named here on purpose — knowing where the line
is matters as much as the code on this side of it.

## Status

Built in milestones — see [`docs/PLAN.md`](docs/PLAN.md) and [`docs/TASKS.md`](docs/TASKS.md).
The git history is organized to follow them.
