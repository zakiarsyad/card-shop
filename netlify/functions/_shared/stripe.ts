import Stripe from "stripe";

/**
 * Build a Stripe client from the environment (server-side only).
 *
 * apiVersion is intentionally left to the SDK default: stripe-node v22 pins a
 * current "basil" version, which supports `billing_mode: flexible` and the
 * invoice `confirmation_secret` used by the subscription flow (verified against
 * https://docs.stripe.com/billing/subscriptions/build-subscriptions).
 */
export function getStripe(env: Record<string, string | undefined> = process.env): Stripe {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  if (key.startsWith("sk_live_")) {
    // Hard guard: this project is test-mode only (docs/CLAUDE.md hard rule).
    throw new Error("Live Stripe keys are not allowed in this project (test mode only)");
  }
  return new Stripe(key, {
    appInfo: { name: "card-checkout", version: "0.1.0", url: "https://checkout.zakiarsyad.com" },
    maxNetworkRetries: 2,
  });
}
