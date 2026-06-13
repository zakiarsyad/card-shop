import { getPlan, type Plan, type PlanMode } from "../../../src/lib/catalog";
import { errorResponse, readJson } from "./http";

export interface CheckoutRequest {
  plan: Plan;
  /** A stable key for Stripe idempotency: the client's token, or a fresh one. */
  idempotencyKey: string;
  email?: string;
}

/**
 * Parse and validate a checkout request shared by both create endpoints:
 * the body must be JSON, the plan key must be known, and its mode must match
 * the endpoint. Returns the parsed request, or a ready-to-return error
 * Response (caller does `if (x instanceof Response) return x`).
 */
export async function parseCheckoutRequest(
  req: Request,
  expectMode: PlanMode,
): Promise<CheckoutRequest | Response> {
  const body = await readJson(req);
  if (typeof body !== "object" || body === null) {
    return errorResponse(400, "invalid_body", "Request body must be JSON.");
  }

  const { plan: planKey, idempotencyKey, email } = body as Record<string, unknown>;

  let plan: Plan;
  try {
    plan = getPlan(planKey);
  } catch {
    return errorResponse(400, "unknown_plan", "Unknown plan.");
  }

  if (plan.mode !== expectMode) {
    const message =
      expectMode === "payment"
        ? "Use the subscription endpoint for recurring plans."
        : "Use the one-time endpoint for non-recurring plans.";
    return errorResponse(400, "wrong_endpoint", message);
  }

  return {
    plan,
    idempotencyKey: resolveIdempotencyKey(idempotencyKey),
    email: typeof email === "string" ? email : undefined,
  };
}

/** Trust a client-supplied idempotency token for retry-dedupe, else mint one. */
export function resolveIdempotencyKey(value: unknown): string {
  return typeof value === "string" && value.length >= 8 ? value : crypto.randomUUID();
}
