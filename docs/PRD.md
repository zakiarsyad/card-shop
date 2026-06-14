# PRD — Checkout

**Status:** Accepted
**Date:** 2026-06-13

## Problem / context

I'm moving toward independent product and design-dev work and interviewing for payments-adjacent
roles. I need a portfolio piece that proves payments domain expertise alongside design and
engineering — not a tutorial clone that any candidate could produce by following a quickstart.

## Goals

- Demonstrate a correct, production-minded Stripe integration end to end (test mode).
- Show both core payment models — one-time and recurring — sharing one clean architecture.
- Make the engineering judgment legible to a reviewer through both code and docs.
- Ship a polished, fast, trustworthy checkout UI.

## Non-goals (deliberately out of scope)

- Real products, real money, or live mode.
- A hand-rolled card form or any handling of raw card numbers (unnecessary PCI scope).
- User accounts, login, or a customer billing portal.
- Marketplaces / split payments (Stripe Connect).
- Tax, shipping, coupons, or a multi-currency catalog.
- A real persistence layer — fulfillment is logged/stubbed, not written to a real store.

Stating these is part of the point: scope discipline is itself the signal. Knowing what *not*
to build is the senior move.

## Users

- **Primary:** a hiring reviewer skimming the repo in ~5 minutes. They should grasp the "why"
  quickly — from the README and ADRs before they read a line of implementation.
- **Secondary:** a "customer" completing checkout, who should experience it as fast and trustworthy.

## Scope — one product, two ways

A single fake digital product ("Pro UI Kit") sold as:

- One-time purchase — **$49**
- All-access subscription — **$9 / month**

Prices and product are fake and live server-side; no real assets required.

## Success criteria

- Both flows complete in test mode, including a 3D Secure challenge.
- Declines and failures render correct, specific UX — not a broken page.
- Critical paths are covered by tests (test-first); see `STANDARDS.md`.
- The UI meets the design bar — simple, clean, trustworthy, accessible (AA).
- Performance budgets are met: Lighthouse ≥ 95, fast first load, minimal JS.
- No secrets in the repo; a clean `.env.example` is the only env artifact committed.
- The code and docs together let a reviewer explain *why* each choice was made.
- The git history reads as a milestone-by-milestone build.
