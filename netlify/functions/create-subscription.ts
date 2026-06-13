import type { Context } from "@netlify/functions";
import type Stripe from "stripe";
import { getStripe } from "./_shared/stripe";
import { json, errorResponse, methodNotAllowed, readJson, correlationId } from "./_shared/http";
import { getPlan, priceIdFor } from "../../src/lib/catalog";
import { extractSubscriptionClientSecret, type SubscriptionLike } from "../../src/lib/subscription";
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

  const cid = correlationId();
  const log = createLogger({ fn: "create-subscription", cid });

  const body = await readJson(req);
  if (typeof body !== "object" || body === null) {
    return errorResponse(400, "invalid_body", "Request body must be JSON.");
  }
  const { plan: planKey, idempotencyKey, email } = body as Record<string, unknown>;

  let plan;
  try {
    plan = getPlan(planKey);
  } catch {
    return errorResponse(400, "unknown_plan", "Unknown plan.");
  }
  if (plan.mode !== "subscription") {
    return errorResponse(400, "wrong_endpoint", "Use the one-time endpoint for non-recurring plans.");
  }

  const idemKey =
    typeof idempotencyKey === "string" && idempotencyKey.length >= 8 ? idempotencyKey : crypto.randomUUID();

  try {
    const stripe = getStripe();
    const priceId = priceIdFor(plan.key);

    // A guest customer — no accounts in scope (PRD non-goals). Idempotent so a
    // retried attempt reuses the same customer rather than creating duplicates.
    const customer = await stripe.customers.create(
      { metadata: { product: "pro_ui_kit", cid }, ...(typeof email === "string" ? { email } : {}) },
      { idempotencyKey: `${idemKey}:customer` },
    );

    log.info("creating subscription", { customer: customer.id, price: priceId });

    const params = {
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      billing_mode: { type: "flexible" },
      expand: ["latest_invoice.confirmation_secret"],
      metadata: { plan: plan.key, product: "pro_ui_kit", cid },
    } as unknown as Stripe.SubscriptionCreateParams;

    const subscription = await stripe.subscriptions.create(params, { idempotencyKey: idemKey });
    const clientSecret = extractSubscriptionClientSecret(subscription as unknown as SubscriptionLike);

    log.info("subscription created", { id: subscription.id, status: subscription.status });

    return json({
      clientSecret,
      amount: plan.amount,
      currency: plan.currency,
      plan: plan.key,
      subscriptionId: subscription.id,
    });
  } catch (err) {
    log.error("subscription failed", { message: err instanceof Error ? err.message : String(err) });
    return errorResponse(502, "stripe_error", "We couldn't start the subscription. Please try again.");
  }
}
