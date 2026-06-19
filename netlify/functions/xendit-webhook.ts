import type { Context } from "@netlify/functions";
import { json, errorResponse, methodNotAllowed } from "./_shared/http";
import { createLogger } from "../../src/lib/log";
import { createMemoryStore, processOnce } from "../../src/lib/idempotency";
import { verifyCallbackToken, decideFulfillment, type XenditWebhookEvent } from "../../src/lib/xendit/webhook";
import { markXenditSeen } from "./_shared/webhook-store";

// Module scope: dedupes within a warm instance. A durable store replaces this in
// production — same as the Stripe webhook (see idempotency.ts / README).
const idempotency = createMemoryStore();

/**
 * Xendit webhook. Source of truth for fulfillment (ADR-0002):
 *  1. Verify the static `x-callback-token` against our stored token.
 *  2. Process each payment exactly once (replay-safe).
 *  3. Route a succeeded payment.capture to fulfillment (logged/stubbed here).
 * Always 200 on a verified event so Xendit stops retrying.
 */
export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed();

  const log = createLogger({ fn: "xendit-webhook" });

  if (!verifyCallbackToken(req.headers.get("x-callback-token"), process.env.XENDIT_CALLBACK_TOKEN)) {
    log.warn("invalid callback token");
    return errorResponse(401, "bad_token", "Invalid callback token.");
  }

  let evt: XenditWebhookEvent;
  try {
    evt = (await req.json()) as XenditWebhookEvent;
  } catch {
    return errorResponse(400, "bad_body", "Request body must be JSON.");
  }

  const paymentId = evt.data?.payment_id ?? "";
  const elog = log.child({ event: evt.event, paymentId });
  // Visible arrival marker — confirms (in Netlify logs) that Xendit reached us
  // and which reference_id it carries (must match the success page's `ref`).
  elog.info("webhook received", { refId: evt.data?.reference_id });

  // Mark the receipt for the success-page indicator, keyed by the SESSION
  // reference_id the page polls. `payment_session.completed` carries that exact
  // id; `payment.capture` appends a per-payment suffix (…_XXXX), so its
  // reference_id would never match the page's `ref`. Idempotent (setJSON), so it
  // runs outside the dedupe gate — and `payment.capture`/`payment_session.completed`
  // share a payment_id, which per-instance dedup could otherwise collapse.
  if (evt.event === "payment_session.completed" && evt.data?.reference_id) {
    try {
      await markXenditSeen(evt.data.reference_id, Math.floor(Date.now() / 1000));
    } catch (e) {
      elog.warn("receipt marker failed", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  try {
    // No stable payment_id (non-payment events) → process once, can't dedupe.
    const result = await processOnce(idempotency, paymentId || crypto.randomUUID(), async () => {
      const action = decideFulfillment(evt);
      if (!action) {
        elog.debug("no fulfillment for event");
        return;
      }
      // "Fulfillment" — logged here; a real system grants entitlement + ledger row.
      elog.info("fulfillment", { effect: action.effect, ref: action.ref, action: action.description });
    });

    if (!result.processed) elog.info("duplicate event — no-op (replay-safe)");
    return json({ received: true, duplicate: !result.processed });
  } catch (err) {
    // 5xx so Xendit retries; the id wasn't remembered, so the retry runs.
    elog.error("handler failed", { message: err instanceof Error ? err.message : String(err) });
    return errorResponse(500, "handler_error", "Processing failed.");
  }
}
