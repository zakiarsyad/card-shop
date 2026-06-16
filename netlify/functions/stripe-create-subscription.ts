import type { Context } from "@netlify/functions";
import type Stripe from "stripe";
import { getStripe } from "./_shared/stripe";
import { json, errorResponse, methodNotAllowed, correlationId } from "./_shared/http";
import { parseCheckoutRequest } from "./_shared/checkout";
import { priceIdFor } from "../../src/lib/catalog";
import {
  extractSubscriptionClientSecret,
  subscriptionPeriodEnd,
  type SubscriptionLike,
} from "../../src/lib/stripe/subscription";
import { createLogger } from "../../src/lib/log";

/**
 * Creates a Customer + Subscription with an incomplete first payment and
 * returns the first invoice's PaymentIntent client secret. The frontend then
 * confirms it through the *same* Payment Element path as the one-time flow
 * (ADR-0003). The difference between the two flows is entirely here on the
 * server.
 */
export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed();

  const parsed = await parseCheckoutRequest(req, "subscription");
  if (parsed instanceof Response) return parsed;
  const { plan, idempotencyKey, email } = parsed;

  const cid = correlationId();
  const log = createLogger({ fn: "create-subscription", cid });

  try {
    const stripe = getStripe();
    const priceId = priceIdFor(plan.key);

    // A guest customer — no accounts in scope (PRD non-goals). Idempotent so a
    // retried attempt reuses the same customer rather than creating duplicates.
    const customer = await stripe.customers.create(
      { metadata: { product: "pro_ui_kit", cid }, ...(email ? { email } : {}) },
      { idempotencyKey: `${idempotencyKey}:customer` },
    );

    log.info("creating subscription", { customer: customer.id, price: priceId });

    const params = {
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      // Card only — keep the demo's payment step unambiguous (no wallets/Link).
      payment_settings: {
        save_default_payment_method: "on_subscription",
        payment_method_types: ["card"],
      },
      billing_mode: { type: "flexible" },
      expand: ["latest_invoice.confirmation_secret"],
      metadata: { plan: plan.key, product: "pro_ui_kit", cid },
    } as unknown as Stripe.SubscriptionCreateParams;

    const subscription = await stripe.subscriptions.create(params, { idempotencyKey });
    const sub = subscription as unknown as SubscriptionLike;
    const clientSecret = extractSubscriptionClientSecret(sub);

    log.info("subscription created", { id: subscription.id, status: subscription.status });

    return json({
      clientSecret,
      amount: plan.amount,
      currency: plan.currency,
      plan: plan.key,
      subscriptionId: subscription.id,
      // The next charge date is already on the created object — return it so the
      // success page can show it without a second Stripe call.
      nextChargeAt: subscriptionPeriodEnd(sub),
    });
  } catch (err) {
    log.error("subscription failed", { message: err instanceof Error ? err.message : String(err) });
    return errorResponse(502, "stripe_error", "We couldn't start the subscription. Please try again.");
  }
}
