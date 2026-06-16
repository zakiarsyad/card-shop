import type { Context } from "@netlify/functions";
import { json, errorResponse, methodNotAllowed, readJson, correlationId } from "./_shared/http";
import { getPlan } from "../../src/lib/catalog";
import { buildSessionRequest } from "../../src/lib/xendit/session";
import { createPaymentSession } from "./_shared/xendit";
import { createLogger } from "../../src/lib/log";

/**
 * Creates a Xendit Payment Session (Components mode) for either plan — the
 * client sends only a plan key; the amount/currency are resolved server-side
 * (ADR-0004). One endpoint serves both: PAY for one-time, SUBSCRIPTION for the
 * recurring plan. Returns the components_sdk_key the client SDK mounts.
 */
export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed();

  const body = await readJson(req);
  if (typeof body !== "object" || body === null) {
    return errorResponse(400, "invalid_body", "Request body must be JSON.");
  }
  const { plan: planKey, idempotencyKey } = body as Record<string, unknown>;

  let plan;
  try {
    plan = getPlan(planKey);
  } catch {
    return errorResponse(400, "unknown_plan", "Unknown plan.");
  }
  const referenceId =
    typeof idempotencyKey === "string" && idempotencyKey.length >= 8 ? idempotencyKey : crypto.randomUUID();

  const cid = correlationId();
  const log = createLogger({ fn: "xendit-create-session", cid });

  try {
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    // Xendit Components requires an HTTPS origin, so this can't run on
    // http://localhost. Fail with a clear message instead of a generic retry.
    if (!origin.startsWith("https://")) {
      log.warn("non-https origin rejected for xendit components", { origin });
      return errorResponse(
        400,
        "https_required",
        "Xendit needs HTTPS — open the deployed site (this step can't run on http://localhost).",
      );
    }
    const sessionReq = buildSessionRequest(plan, {
      referenceId,
      origin,
      // Xendit requires a subscription's anchor_date ≥ the session's expiry
      // (default 30 min), so anchor billing an hour out.
      anchorDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    log.info("creating xendit session", {
      plan: plan.key,
      type: sessionReq.session_type,
      amount: sessionReq.amount,
      currency: sessionReq.currency,
    });

    const session = await createPaymentSession(sessionReq);
    log.info("xendit session created", { id: session.payment_session_id, status: session.status });

    return json({
      paymentSessionId: session.payment_session_id,
      componentsSdkKey: session.components_sdk_key,
      plan: plan.key,
    });
  } catch (err) {
    log.error("xendit session failed", { message: err instanceof Error ? err.message : String(err) });
    return errorResponse(502, "xendit_error", "We couldn't start the payment. Please try again.");
  }
}
