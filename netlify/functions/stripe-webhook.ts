import type { Context } from "@netlify/functions";
import { getStripe } from "./_shared/stripe";
import { json, errorResponse, methodNotAllowed } from "./_shared/http";
import { createLogger } from "../../src/lib/log";
import { isHandledEvent, decideFulfillment } from "../../src/lib/stripe/webhook-events";
import { createMemoryStore, processOnce } from "../../src/lib/idempotency";
import { markPaymentSeen } from "./_shared/webhook-store";

// Module scope: survives across warm invocations of this instance. A durable
// store (Redis/Postgres) would replace this in production — see README.
const idempotency = createMemoryStore();

/**
 * Stripe webhook. The source of truth for fulfillment (ADR-0002):
 *  1. Verify the signature against the raw body — reject anything unsigned.
 *  2. Process each event id exactly once (replay-safe).
 *  3. Route to the fulfillment effect; here that's logged/stubbed.
 * Always 200 on a verified event (even if unhandled) so Stripe stops retrying.
 */
export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed();

  const log = createLogger({ fn: "stripe-webhook" });
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    log.warn("missing signature or secret");
    return errorResponse(400, "bad_signature", "Missing signature.");
  }

  // The raw body is required for signature verification — never parse first.
  const raw = await req.text();

  let event;
  try {
    const stripe = getStripe();
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
  } catch (err) {
    log.warn("signature verification failed", { message: err instanceof Error ? err.message : String(err) });
    return errorResponse(400, "bad_signature", "Signature verification failed.");
  }

  const elog = log.child({ eventId: event.id, type: event.type });

  if (!isHandledEvent(event.type)) {
    elog.debug("ignoring unhandled event");
    return json({ received: true, handled: false });
  }

  try {
    const evt = event as unknown as {
      id: string;
      type: string;
      created: number;
      data: { object: Record<string, unknown> };
    };
    const result = await processOnce(idempotency, event.id, async () => {
      // Mark the payment's webhook as received so the success page can confirm
      // it (fires for both one-time and a subscription's first charge). Best-
      // effort — a store hiccup must never fail the webhook (→ Stripe retries).
      if (evt.type === "payment_intent.succeeded" && typeof evt.data.object.id === "string") {
        try {
          await markPaymentSeen(evt.data.object.id, evt.created);
        } catch (e) {
          elog.warn("receipt marker failed", { message: e instanceof Error ? e.message : String(e) });
        }
      }

      const action = decideFulfillment(evt);
      if (!action) return;
      // "Fulfillment" — in this demo we log the audit line; a real system would
      // grant/revoke entitlements, write a ledger row, and send a receipt.
      elog.info("fulfillment", { effect: action.effect, ref: action.ref, action: action.description });
    });

    if (!result.processed) elog.info("duplicate event — no-op (replay-safe)");
    return json({ received: true, handled: true, duplicate: !result.processed });
  } catch (err) {
    // Return 5xx so Stripe retries; the id was not remembered, so the retry runs.
    elog.error("handler failed", { message: err instanceof Error ? err.message : String(err) });
    return errorResponse(500, "handler_error", "Processing failed.");
  }
}
