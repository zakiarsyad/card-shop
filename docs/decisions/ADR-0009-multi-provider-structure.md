# ADR-0009: Multi-provider structure — shared shell, per-provider subpaths

**Status:** Accepted
**Date:** 2026-06-16
**Deciders:** Dev (solo)

## Context

The Stripe demo is being extended to show the *same* product checkout built on
other payment providers (Adyen, Xendit). The question is how to structure that
without (a) duplicating the design system three times, or (b) inventing a
provider abstraction that pretends the three are interchangeable.

They are *not* interchangeable: the client confirm flows differ fundamentally —
Stripe's Payment Element ("confirm one PaymentIntent"), Adyen's Drop-in, Xendit's
hosted/redirect session. A unified `PaymentProvider` interface would leak
immediately and kill the simplicity this project is built around.

## Decision

**One Astro app. One Netlify deploy. Subpaths per provider** (`/stripe`,
`/adyen`, `/xendit`), with a landing hub at `/`. Share the *shell*, not the
payments logic.

- **Shared (imported directly, no abstraction):** the design system (`Layout`,
  `styles`, generic UI like `PlanOption`), and the provider-agnostic domain core
  in `lib/` (`catalog`, `money`, `idempotency`, `log`). All three providers sell
  the same catalog product.
- **Per-provider, namespaced by folder/prefix:** `pages/<provider>/`,
  `components/<provider>/`, `scripts/<provider>/`, `lib/<provider>/`, and
  `<provider>-*` Netlify functions. Each provider is its own honest implementation
  that *reuses* the shared pieces by import.
- **Shared code stays unprefixed** in `lib/` (`catalog`, `money`, `idempotency`,
  `log`, `brand`), `components/` (`PlanOption`, `TrustNote`), `scripts/test-cards.ts`,
  and `functions/_shared/`.

> The Stripe `lib/` modules and functions were originally left flat and namespaced
> once the second provider (Xendit) landed — renaming earlier would have been churn
> against an unverified shape.

## Consequences

- One link to share, one deploy, design stays in sync for free — the right
  trade for a portfolio piece (subdomains/independent deploys are a *product*
  concern: deploy lifecycles, secret isolation, failure blast radius).
- The portfolio signal is stronger: three PSPs at the same polish, with the
  common core factored out — without faking a unified API.
- Lower-regret: if independent deploys are ever needed, the shared `lib`/
  `components` port straight into a workspace monorepo (`packages/*` + `apps/*`).
  Collapsing three sites back into one is the harder direction.
- Each provider's flow must be verified against its own current docs before
  building — the providers share no API model (cf. the Stripe-first-invoice
  caveat in CLAUDE.md).
