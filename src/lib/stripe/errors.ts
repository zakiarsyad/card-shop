/**
 * Maps Stripe errors to a small, user-facing taxonomy. Each message explains
 * what happened and what to do — in the interface's voice, active tense.
 * See docs/STANDARDS.md → Design ("Copy is design material") and Domain
 * ("decline and error codes mapped to a clear user-facing taxonomy").
 *
 * Pure and framework-free: takes a plain error-shaped object (the same shape
 * Stripe.js returns on confirmError) so it's fully unit-testable.
 */

export type ErrorKind =
  | "card_declined"
  | "incorrect_details"
  | "authentication_required"
  | "processing_error"
  | "rate_limited"
  | "network"
  | "config"
  | "unknown";

export interface UserError {
  kind: ErrorKind;
  title: string;
  message: string;
  /** Can the user reasonably retry as-is (vs. needing a different card)? */
  retryable: boolean;
}

/** The error shape we consume (subset of Stripe.StripeError / StripeJS error). */
export interface StripeLikeError {
  type?: string;
  code?: string;
  decline_code?: string;
  message?: string;
}

// Specific decline_codes get tailored guidance; the rest fall back to generic.
const DECLINE_MESSAGES: Record<string, string> = {
  insufficient_funds: "Your card has insufficient funds. Try another card.",
  lost_card: "This card was reported lost. Use a different card.",
  stolen_card: "This card was reported stolen. Use a different card.",
  expired_card: "Your card has expired. Use a different card.",
  incorrect_cvc: "The security code (CVC) is incorrect. Check it and try again.",
  card_velocity_exceeded: "This card has hit its limit. Try another card.",
};

export function mapStripeError(err: StripeLikeError | null | undefined): UserError {
  const type = err?.type ?? "";
  const code = err?.code ?? "";
  const declineCode = err?.decline_code ?? "";

  // 3-D Secure failed or was canceled. Checked before the type buckets because
  // Stripe sends this as an `invalid_request_error`, which would otherwise be
  // mistaken for our own misconfiguration.
  if (code === "payment_intent_authentication_failure") {
    return {
      kind: "authentication_required",
      title: "Authentication failed",
      message:
        "Your bank couldn't verify this payment, or it was canceled. No charge was made — try again, or use a different card.",
      retryable: true,
    };
  }

  // Card declined — the most common real-world case.
  if (code === "card_declined" || type === "card_error") {
    if (code === "expired_card" || code === "incorrect_cvc" || code === "incorrect_number") {
      return {
        kind: "incorrect_details",
        title: "Check your card details",
        message:
          DECLINE_MESSAGES[code] ??
          "Some card details look off. Double-check the number, expiry, and CVC.",
        retryable: true,
      };
    }
    if (code === "authentication_required") {
      return {
        kind: "authentication_required",
        title: "Authentication needed",
        message: "Your bank needs to verify this payment. Try again and complete the prompt.",
        retryable: true,
      };
    }
    return {
      kind: "card_declined",
      title: "Your card was declined",
      message:
        DECLINE_MESSAGES[declineCode] ??
        "Your bank declined it. Try a different card, or contact your bank.",
      retryable: true,
    };
  }

  // User mistyped something the Element validates.
  if (type === "validation_error") {
    return {
      kind: "incorrect_details",
      title: "Check your payment details",
      message: "Please complete the highlighted fields and try again.",
      retryable: true,
    };
  }

  // Transient connectivity — a plain retry usually works.
  if (type === "api_connection_error") {
    return {
      kind: "network",
      title: "Connection problem",
      message: "We couldn't reach our payment provider. Check your connection and try again.",
      retryable: true,
    };
  }

  if (type === "rate_limit_error") {
    return {
      kind: "rate_limited",
      title: "Too many attempts",
      message: "Please wait a few seconds, then try again.",
      retryable: true,
    };
  }

  // Our misconfiguration (bad key, bad request) — not the user's fault.
  if (type === "authentication_error" || type === "invalid_request_error") {
    return {
      kind: "config",
      title: "Something's misconfigured",
      message: "We hit a setup error on our end. No charge was made — please try again later.",
      retryable: false,
    };
  }

  if (type === "api_error") {
    return {
      kind: "processing_error",
      title: "Payment provider error",
      message: "Our payment provider had a hiccup. No charge was made — please try again.",
      retryable: true,
    };
  }

  return {
    kind: "unknown",
    title: "Something went wrong",
    message: err?.message?.trim()
      ? err.message
      : "An unexpected error occurred. No charge was made — please try again.",
    retryable: true,
  };
}
