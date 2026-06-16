# ADR-0010: Per-provider theming via design tokens

**Status:** Accepted
**Date:** 2026-06-16
**Deciders:** Dev (solo)

## Context

Each provider subpath (ADR-0009) should feel like *that* provider's brand —
Stripe's blurple, Adyen's green, Xendit's blue — while sharing one component set.
We don't want to fork components per provider just to recolor them.

## Decision

Theme by **swapping design tokens**, not forking markup. The UI already consumes
everything through CSS custom properties (`var(--color-accent)`, etc.; ADR-0006),
so the components never need to change.

- `Layout` takes a `provider` prop and sets **`data-provider`** on `<html>`.
- Each provider overrides only the tokens that differ under that selector:
  ```css
  [data-provider="adyen"]  { --color-accent: #0abf53; /* … */ }
  ```
  Defaults in the `@theme` block remain Stripe's, so Stripe needs no override.
- Token overrides are added **with each provider's page**, not up front — no
  unused rules for providers that don't exist yet.

## Consequences

- "Three branded checkouts" for the cost of a few token values; same component
  quality across all three, one place to maintain layout/behavior.
- Bounded scope: only re-*theme* (colors, maybe font/radius). If a provider ever
  needs a genuinely bespoke layout, its page can fork just its own components
  without touching the others — pages compose components freely.
