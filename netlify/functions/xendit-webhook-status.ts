import type { Context } from "@netlify/functions";
import { json, errorResponse, methodNotAllowed } from "./_shared/http";
import { wasXenditSeen } from "./_shared/webhook-store";
import { createLogger } from "../../src/lib/log";

/**
 * Has Xendit's webhook for this payment reached the server yet? The success
 * page polls this to show a live "fulfillment confirmed" indicator. Read-only.
 * Keyed by the session reference_id the client created the session with.
 */
export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== "GET") return methodNotAllowed("GET");

  const ref = new URL(req.url).searchParams.get("ref");
  if (!ref || ref.length < 8) {
    return errorResponse(400, "invalid_request", "Missing reference id.");
  }

  try {
    const at = await wasXenditSeen(ref);
    return json({ received: at != null, at });
  } catch (err) {
    createLogger({ fn: "xendit-webhook-status" }).warn("status check failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return json({ received: false });
  }
}
