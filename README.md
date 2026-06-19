# Checkout

**Live:** [checkout.zakiarsyad.com](https://checkout.zakiarsyad.com)

A set of checkout demos — the **same** product (sold **one-time** or by **subscription**) built
once per payment provider, each under its own subpath and in its own brand, on a shared
Astro + Netlify Functions shell.

- **`/stripe`** — built, on Stripe's Payment Element. *(Adyen and Xendit are planned.)*

Built as a portfolio piece. The goal isn't feature breadth; it's the judgment that separates a
real payments integration from a tutorial: webhook-driven fulfillment, idempotency,
server-authoritative pricing, and complete payment-state handling.

> Runs in **test mode** only. No real money moves.

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
- **The webhook is observable.** The success page shows a live indicator that confirms when Stripe's
  webhook for the payment reached the server. → [`ADR-0008`](docs/decisions/ADR-0008-webhook-received-indicator.md)
- **One app, per-provider subpaths.** A shared design system + domain core; each provider is its own
  implementation, not a leaky shared abstraction. → [`ADR-0009`](docs/decisions/ADR-0009-multi-provider-structure.md)
- **Per-provider theming via tokens.** Same components, brand swapped through CSS custom properties. →
  [`ADR-0010`](docs/decisions/ADR-0010-per-provider-theming.md)

**New to the code?** Start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — a 5-minute
code map: the request lifecycle traced through the actual files, a directory guide, and a
"where do I change X?" table.

Full reasoning lives in `docs/`. The quality bar — design, engineering, performance, and
payments depth — is written down in [`docs/STANDARDS.md`](docs/STANDARDS.md). How I work the repo
(spec-driven and markdown-first): [`docs/PROCESS.md`](docs/PROCESS.md).

## Stack

Astro · TypeScript · plain CSS (hand-authored design tokens, no framework) · Netlify Functions · Stripe (Payment Element) + Xendit (Components SDK), both with the Node SDK

## Architecture (the Stripe flow)

```
            choose plan
 [  /stripe  ] ──────────────┐
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
2. `cp .env.example .env` and fill in your test keys + Price IDs (Stripe; Xendit keys for `/xendit`)
3. `npm run dev` — serves **HTTPS** at `https://localhost:8888` (a self-signed cert is
   auto-generated into `.cert/`; accept the browser warning once). Dev is HTTPS on purpose:
   **Xendit Components requires an HTTPS origin even in test mode**, so the Xendit checkout
   can't run on `http://localhost`.
4. Forward Stripe webhooks locally (note `https` + `--skip-verify` for the self-signed cert):
   `stripe listen --forward-to https://localhost:8888/.netlify/functions/stripe-webhook --skip-verify`
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
