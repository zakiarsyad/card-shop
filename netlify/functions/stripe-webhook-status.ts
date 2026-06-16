import type { Context } from "@netlify/functions";
import { json, errorResponse, methodNotAllowed } from "./_shared/http";
import { wasPaymentSeen } from "./_shared/webhook-store";
import { createLogger } from "../../src/lib/log";

/**
 * Has Stripe's webhook for this payment reached the server yet? The success
 * page polls this to show a live "fulfillment confirmed" indicator. Read-only.
 */
export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed("GET");

  const pi = new URL(req.url).searchParams.get("pi");
  if (!pi || !pi.startsWith("pi_")) {
    return errorResponse(400, "invalid_request", "Missing payment_intent id.");
  }

  try {
    const at = await wasPaymentSeen(pi);
    return json({ received: at != null, at });
  } catch (err) {
    createLogger({ fn: "webhook-status" }).warn("status check failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return json({ received: false });
  }
}
