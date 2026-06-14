# ADR-0006: Stripe-aligned visual design language

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** Dev (solo)

## Context

The first cut used a warm-stone palette with a serif display face (Fraunces)
paired with Inter, per the original "deliberate type pairing" line in
`STANDARDS.md`. Two things prompted a revisit: (1) the checkout should read as
unambiguously trustworthy to a first-time visitor, and (2) the brief is a
*Stripe* checkout — it should feel like it belongs in Stripe's world.

A serif display face is distinctive but reads as editorial, not as payments.
Stripe's own product surfaces use a single clean sans (Söhne) and a cool
navy/slate palette with their "blurple" accent.

## Decision

Adopt a Stripe-aligned visual language:

- **Type:** one high-quality variable sans — **Inter** — across the entire UI
  (the widely-used free analog of Stripe's Söhne). Hierarchy comes from weight,
  size, and tracking, not from a second typeface. Drop Fraunces entirely.
- **Color:** Stripe's palette — navy ink `#0A2540`, slate body `#425466`, muted
  `#697386`, cool `#F6F9FC` canvas, the signature blurple `#635BFF` for primary
  actions, and Stripe's own error red `#DF1B41`.
- **Clarity:** the plan toggle and CTA state exactly what the visitor commits
  to. The subscription CTA reads `Subscribe · $9.00/mo` (never a one-time-looking
  `Pay $9.00`), backed by an explicit "Then $9.00 every month. Cancel anytime."
  note and a "Total due today" label.

## Options considered

- **Keep the Fraunces + Inter serif pairing** — distinctive, but off-brand for a
  Stripe checkout and an extra font family to ship.
- **Single Stripe-like sans (Inter)** — on-brand, cohesive, and lighter. *(chosen)*
- **A different sans (Geist, Hanken Grotesk, …)** — no advantage over Inter,
  which is already a dependency and is the closest free match to Söhne.

## Trade-off analysis

The single-family system is both more on-brand and faster: it removes a whole
font family (~80 KB of subset/weight files from the build) for one variable
Latin face at runtime. The small cost is losing the editorial serif accent —
which was never the right register for a payment form anyway.

## Consequences

- **Supersedes** the "one deliberate type pairing (display + body)" clause of
  `STANDARDS.md` → Design; that file is updated to describe the single-family
  system. The rest of the Design bar (restraint, trust, AA, reduced motion)
  stands unchanged.
- One fewer font family; lighter build; a cohesive, payments-appropriate look.
- The CTA/label copy removes the most dangerous ambiguity in a two-plan
  checkout — mistaking a subscription for a one-time charge.
- Revisit if: the brand ever wants a distinct display face, or licenses Söhne.
