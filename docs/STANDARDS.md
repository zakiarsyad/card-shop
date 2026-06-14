# Standards

The quality bar for this project, by pillar. Each bar is concrete and checkable. Where the
`agent-skills` plugin owns the detailed workflow, the relevant skill is named — defer to it
rather than reinventing the process here.

## Design & UX — simple, clean, trustworthy

Goal: a checkout that feels premium and effortless, and reads as a deliberate design choice,
not a template.
Skill: `frontend-ui-engineering` (component architecture, design systems, responsive, WCAG 2.1 AA).

Bar:

- A deliberate type system on a clear scale. We use **one** high-quality variable sans (Inter,
  the free analog of Stripe's Söhne) across the whole UI, with hierarchy from weight/size/tracking
  rather than a second face — a Stripe-aligned choice (see
  [`decisions/ADR-0006`](decisions/ADR-0006-visual-design-language.md), which supersedes the
  earlier "display + body pairing" rule).
- Stripe-aligned palette: navy ink (`#0A2540`), slate body (`#425466`), the blurple accent
  (`#635BFF`), a cool `#F6F9FC` canvas, and Stripe's error red (`#DF1B41`). Tokens live in
  `src/styles/global.css`.
- Restraint: spend boldness in one signature moment (the live total); keep everything around it
  quiet. Cut decoration that doesn't serve the checkout.
- Trust is the design job: honest affordances, clear states, no dark patterns, and **no
  ambiguity** — the visitor always knows the amount, the cadence, and the next step. The CTA says
  exactly what it does and keeps that name through the flow: `Pay $49` for one-time,
  `Subscribe · $9.00/mo` for recurring (a subscription must never read as a one-time charge).
- Quality floor, non-negotiable: responsive to mobile, visible keyboard focus,
  `prefers-reduced-motion` respected, AA contrast.
- Copy is design material: active-voice actions; errors explain what happened and how to fix it,
  in the interface's voice.

## Engineering — clean, structured, tested

Goal: code a senior reviewer would approve without comment.
Skills: `incremental-implementation`, `test-driven-development`, `code-review-and-quality`,
`code-simplification`, `api-and-interface-design`.

Bar:

- Thin vertical slices: implement → test → verify → commit. No change spanning multiple files
  without tests.
- TDD on logic and behavior; test pyramid roughly 80/15/5 (unit / integration / e2e).
- Tests cover what matters: price resolution, payment-state transitions, webhook handling and
  idempotency, error mapping. Skip trivial getters and framework code.
- Clear module boundaries — catalog, intent creation, confirm UI, webhook handling are separable
  and independently testable.
- Clarity over cleverness: small functions, names drawn from the domain, no premature abstraction.

## Performance — lightweight & lightning fast

Goal: near-instant first load; ship almost no JavaScript until it's actually needed.
Skill: `performance-optimization`.

Bar:

- Astro static by default; the Payment Element is the only interactive island.
- Defer Stripe.js until the user intends to pay (it's the heaviest dependency) and load it from
  Stripe's CDN (required for PCI anyway).
- Budgets: Lighthouse ≥ 95 across the board; LCP < 1.5s and CLS < 0.05 on a mid-tier mobile;
  product-page first-load JS (excluding Stripe.js) under ~30 KB gzipped.
- No UI-framework runtime unless it earns its weight; prefer the platform + Astro.
- `preconnect` to Stripe; system-font fallback to avoid layout shift.

## Domain — payments depth (staff-level)

Goal: choices only someone who has run payments in production would make. The signal lives in the
rigor, not in name-dropping a former employer.
Skills: `security-and-hardening`, `observability-and-instrumentation`, `doubt-driven-development`,
`source-driven-development`.

Bar:

- Money is integer minor units; respect zero-decimal currencies; never floats.
- Idempotency keys at every create boundary (PaymentIntent, Subscription).
- Webhooks are the source of truth: verify signatures, process idempotently, tolerate duplicate
  and out-of-order delivery.
- A complete payment state machine; decline and error codes mapped to a clear user-facing taxonomy.
- Structured, correlated logging of the payment lifecycle — never log secrets or card data.
- Apply `doubt-driven-development` to every payment-critical, irreversible path before committing.
- Ground every Stripe decision in current official docs via `source-driven-development` — do not
  trust model memory for the API surface.
- **Production notes** (surfaced in the README): explicitly name what a real deployment would add
  — reconciliation/ledger, dunning on failed renewals, an audit trail, alerting, PCI SAQ-A scope.
  Naming the scope you deliberately deferred is itself the staff-level signal.
