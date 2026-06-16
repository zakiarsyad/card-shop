import type { Context } from "@netlify/functions";
import { getStripe } from "./_shared/stripe";
import { json, errorResponse, methodNotAllowed, correlationId } from "./_shared/http";
import { parseCheckoutRequest } from "./_shared/checkout";
import { createLogger } from "../../src/lib/log";

/**
 * Creates a one-time PaymentIntent. The client sends only a plan key; the
 * amount is resolved server-side from the catalog (ADR-0004). An idempotency
 * key makes retries of the same checkout attempt safe (STANDARDS → Domain).
 */
export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed();

  const parsed = await parseCheckoutRequest(req, "payment");
  if (parsed instanceof Response) return parsed;
  const { plan, idempotencyKey } = parsed;

  const cid = correlationId();
  const log = createLogger({ fn: "create-payment-intent", cid });

  try {
    const stripe = getStripe();
    log.info("creating payment intent", { plan: plan.key, amount: plan.amount, currency: plan.currency });

    const intent = await stripe.paymentIntents.create(
      {
        amount: plan.amount,
        currency: plan.currency,
        // Card only — keep the demo's payment step unambiguous (no wallets/Link).
        payment_method_types: ["card"],
        metadata: { plan: plan.key, product: "pro_ui_kit", cid },
      },
      { idempotencyKey },
    );

    log.info("payment intent created", { id: intent.id, status: intent.status });

    return json({
      clientSecret: intent.client_secret,
      amount: plan.amount,
      currency: plan.currency,
      plan: plan.key,
    });
  } catch (err) {
    log.error("payment intent failed", { message: err instanceof Error ? err.message : String(err) });
    return errorResponse(502, "stripe_error", "We couldn't start the payment. Please try again.");
  }
}
