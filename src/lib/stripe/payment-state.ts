/**
 * The client-side payment state machine. A PaymentIntent has many Stripe
 * statuses; the UI collapses them into a handful of states with distinct UX.
 * See docs/STANDARDS.md → Domain: "A complete payment state machine."
 *
 * Pure and framework-free so it's unit-testable and reusable by both the
 * one-time and subscription flows (they share this confirm path — ADR-0003).
 */

// The subset of Stripe PaymentIntent statuses we may observe client-side.
export type PaymentIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded";

export type UiState =
  | "idle" // before the user has started paying
  | "submitting" // confirm call in flight
  | "requires_action" // 3DS / additional authentication needed
  | "processing" // bank is processing; outcome pending (e.g. some debits)
  | "succeeded" // payment captured
  | "failed"; // declined / canceled / needs a new method

/** Map a Stripe PaymentIntent status to the UI state it should render. */
export function statusToUiState(status: PaymentIntentStatus): UiState {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "processing":
      return "processing";
    case "requires_action":
    case "requires_confirmation":
      return "requires_action";
    case "requires_capture":
      // Funds authorized; for this project (no manual capture) treat as pending.
      return "processing";
    case "requires_payment_method":
    case "canceled":
      return "failed";
  }
}

/** Human-facing copy per UI state. Active voice; says what's happening. */
export const STATE_COPY: Record<UiState, { title: string; message: string }> = {
  idle: { title: "", message: "" },
  submitting: { title: "Confirming your payment…", message: "Hang tight — this only takes a moment." },
  requires_action: {
    title: "One more step",
    message: "Your bank needs to verify this payment. Follow the prompt to continue.",
  },
  processing: {
    title: "Payment processing",
    message: "Your payment is going through and will be confirmed once it settles.",
  },
  succeeded: { title: "Payment successful", message: "Thanks — your payment went through." },
  failed: { title: "Payment didn't go through", message: "No charge was made. You can try again." },
};
