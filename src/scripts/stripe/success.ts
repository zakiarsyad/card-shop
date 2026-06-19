/**
 * Success page controller. Reads the PaymentIntent status for *display only* —
 * it never fulfills (fulfillment is the webhook's job; ADR-0002).
 */
import { statusToUiState, STATE_COPY, type PaymentIntentStatus, type UiState } from "../../lib/stripe/payment-state";
import { watchWebhook } from "../webhook-indicator";

const TONE: Record<string, string> = {
  succeeded: "succeeded",
  processing: "processing",
  requires_action: "processing",
  failed: "failed",
};

// Stripe appends `redirect_status` to the return URL, so we know the outcome
// the instant the page loads — no need to show a "checking…" step while
// Stripe.js loads and we retrieve the PaymentIntent for the authoritative read.
const REDIRECT_UI: Record<string, UiState> = {
  succeeded: "succeeded",
  processing: "processing",
  failed: "failed",
};

export async function renderSuccess(): Promise<void> {
  const titleEl = document.getElementById("title");
  const messageEl = document.getElementById("message");
  const iconEl = document.getElementById("icon");
  if (!titleEl || !messageEl || !iconEl) return;

  // The card is invisible until the first paint, then fades in fully-formed —
  // so the user never sees it assemble (title, note, badge popping in one by
  // one and shoving the button down). One clean appearance, no layout jump.
  const card = document.querySelector(".card");
  const reveal = () => card?.classList.add("ready");

  const paint = (ui: UiState) => {
    const copy = STATE_COPY[ui];
    iconEl.dataset.tone = TONE[ui] ?? "pending";
    titleEl.textContent = copy.title || "Payment status";
    messageEl.textContent = copy.message;
    // Reveal the fulfillment note + live webhook indicator only once we have a
    // successful outcome — never alongside an unresolved/failed state.
    if (ui === "succeeded" || ui === "processing") {
      const note = document.getElementById("note");
      if (note) note.hidden = false;
      renderSubscription(params.get("renews"));
      watchWebhook({
        id: params.get("payment_intent"),
        provider: "Stripe",
        statusUrl: (id) => `/.netlify/functions/stripe-webhook-status?pi=${encodeURIComponent(id)}`,
      });
    }
    reveal();
  };

  const render = (tone: string, title: string, message: string) => {
    iconEl.dataset.tone = tone;
    titleEl.textContent = title;
    messageEl.textContent = message;
    reveal();
  };

  const params = new URLSearchParams(window.location.search);
  const clientSecret = params.get("payment_intent_client_secret");
  if (!clientSecret) {
    render("failed", "Nothing to show", "We couldn't find a payment to display. Head back to start a new one.");
    return;
  }

  // First paint from the redirect status — instant, so the page shows its real
  // outcome without a "checking…" step. The retrieve below is the authoritative
  // confirmation; watchWebhook guards against starting twice.
  const hinted = REDIRECT_UI[params.get("redirect_status") ?? ""];
  if (hinted) paint(hinted);

  try {
    const pk = import.meta.env.PUBLIC_STRIPE_KEY as string | undefined;
    if (!pk) throw new Error("missing key");
    const { loadStripe } = await import("@stripe/stripe-js");
    const stripe = await loadStripe(pk);
    if (!stripe) throw new Error("stripe failed to load");

    const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
    if (!paymentIntent) throw new Error("no payment intent");

    paint(statusToUiState(paymentIntent.status as PaymentIntentStatus));
  } catch {
    render(
      "processing",
      "We couldn't read the status",
      "Your payment may still be processing. If you completed checkout, it'll be confirmed once it settles.",
    );
  }
}

/**
 * Show "Subscription active — renews monthly · next charge …". The next-charge
 * date is passed in the URL (`renews`, a Unix timestamp) by the checkout — the
 * subscription's first charge succeeded to reach this page, so no extra Stripe
 * call is needed. Present only for the subscription plan.
 */
function renderSubscription(renews: string | null): void {
  const el = document.getElementById("subnote");
  if (!el || !renews) return;

  let line = "✓ Subscription active — renews monthly";
  const ts = Number(renews);
  if (Number.isFinite(ts) && ts > 0) {
    const date = new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    line += ` · next charge ${date}`;
  }
  el.textContent = line;
  el.hidden = false;
}

