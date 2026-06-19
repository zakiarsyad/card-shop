/**
 * Client checkout controller. Framework-free (the only interactive island —
 * docs/STANDARDS.md → Performance). Stripe.js is dynamically imported on the
 * user's intent to pay, so it stays out of the initial bundle.
 *
 * The same confirm path serves both plans; only the server endpoint differs
 * (ADR-0003). Domain logic (state machine, error taxonomy) lives in src/lib
 * and is unit-tested; this file is the thin DOM/Stripe wiring around it.
 */
import { mapStripeError } from "../../lib/stripe/errors";
import { STATE_COPY } from "../../lib/stripe/payment-state";
import { formatAmount } from "../../lib/money";
import { PLANS, intervalSuffix, type PlanKey } from "../../lib/catalog";
import { createCheckoutUi } from "../checkout-ui";
import type { Stripe, StripeElements, StripePaymentElement } from "@stripe/stripe-js";

type Phase = "select" | "pay";

const ENDPOINTS: Record<PlanKey, string> = {
  one_time: "/.netlify/functions/stripe-create-payment-intent",
  subscription: "/.netlify/functions/stripe-create-subscription",
};

export function initCheckout(): void {
  const form = document.querySelector<HTMLElement>(".card");
  const primary = document.getElementById("primary") as HTMLButtonElement | null;
  const totalEl = document.getElementById("total-amount");
  const paymentSection = document.getElementById("payment-section");
  const statusEl = document.getElementById("status");
  const errorEl = document.getElementById("error");
  const recurringEl = document.getElementById("recurring-note");
  if (!form || !primary || !totalEl || !paymentSection || !statusEl || !errorEl) return;

  let phase: Phase = "select";
  let stripe: Stripe | null = null;
  let elements: StripeElements | null = null;
  let paymentElement: StripePaymentElement | null = null;
  let idempotencyKey = "";
  let nextChargeAt = 0; // subscription next-charge unix ts; threaded to /stripe/success

  const selectedPlan = (): PlanKey => {
    const checked = form.querySelector<HTMLInputElement>('input[name="plan"]:checked');
    return (checked?.value as PlanKey) ?? "one_time";
  };

  const { setButton, showStatus, clearStatus, showError, clearError } = createCheckoutUi({
    primary,
    status: statusEl,
    error: errorEl,
  });

  // The CTA must say exactly what it does — and never let a subscription read
  // like a one-time charge (docs/STANDARDS.md → Design; ADR-0006).
  const payLabel = (): string => {
    const plan = PLANS[selectedPlan()];
    const amount = formatAmount(plan.amount, plan.currency);
    return plan.interval ? `Subscribe · ${amount}${intervalSuffix(plan.interval)}` : `Pay ${amount}`;
  };

  // Keep the live total + recurring note in sync with the toggle. The total is
  // the amount due today; cadence lives in the recurring note (no "/mo" on a
  // "due today" figure).
  const syncTotal = () => {
    const plan = PLANS[selectedPlan()];
    totalEl.textContent = formatAmount(plan.amount, plan.currency);
    if (recurringEl) recurringEl.hidden = !plan.interval;
  };

  // Collapse the payment step back to plan selection. Used when the visitor
  // changes plan after opening payment: the mounted Element belongs to the old
  // plan's intent, so we tear it down and require a fresh "Continue" (which
  // creates a new intent for the new plan). idempotencyKey is reset so it isn't
  // reused across plans.
  const resetToSelect = () => {
    paymentElement?.destroy();
    paymentElement = null;
    elements = null;
    idempotencyKey = "";
    nextChargeAt = 0;
    paymentSection!.hidden = true;
    clearStatus();
    clearError();
    phase = "select";
    setButton("Continue to payment");
  };

  form.querySelectorAll<HTMLInputElement>('input[name="plan"]').forEach((input) => {
    input.addEventListener("change", () => {
      syncTotal();
      if (phase === "pay") resetToSelect();
    });
  });

  async function startPayment() {
    clearError();
    const plan = PLANS[selectedPlan()];
    setButton("Continue to payment", { busy: true, disabled: true });
    showStatus("submitting", "Setting up checkout…", "");

    try {
      idempotencyKey = idempotencyKey || crypto.randomUUID();

      const res = await fetch(ENDPOINTS[plan.key], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.key, idempotencyKey }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        clientSecret?: string;
        nextChargeAt?: number | null;
        error?: { message?: string };
      };
      if (!res.ok || !data.clientSecret) {
        throw new Error(data.error?.message ?? "We couldn't start checkout. Please try again.");
      }
      nextChargeAt = typeof data.nextChargeAt === "number" ? data.nextChargeAt : 0;

      const pk = import.meta.env.PUBLIC_STRIPE_KEY as string | undefined;
      if (!pk) throw new Error("Payments aren't configured (missing publishable key).");

      const { loadStripe } = await import("@stripe/stripe-js");
      stripe = await loadStripe(pk);
      if (!stripe) throw new Error("We couldn't load the payment form. Please reload and try again.");

      elements = stripe.elements({
        clientSecret: data.clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#635bff",
            colorText: "#0a2540",
            colorTextSecondary: "#697386",
            colorDanger: "#df1b41",
            fontFamily: "Inter Variable, system-ui, sans-serif",
            borderRadius: "10px",
            spacingUnit: "4px",
          },
        },
      });
      const el = elements.create("payment", { layout: "tabs" });
      paymentElement = el;
      el.mount("#payment-mount");

      paymentSection!.hidden = false;
      clearStatus();
      phase = "pay";
      setButton(payLabel());
      el.on("ready", () => el.focus());
    } catch (err) {
      clearStatus();
      showError("Couldn't start checkout", err instanceof Error ? err.message : "Please try again.");
      phase = "select";
      setButton("Continue to payment");
    }
  }

  async function confirm() {
    if (!stripe || !elements) return;
    clearError();
    setButton(payLabel(), { busy: true, disabled: true });
    showStatus("submitting", STATE_COPY.submitting.title, STATE_COPY.submitting.message);

    // No `redirect: 'if_required'`: let Stripe drive 3DS and redirect to the
    // return_url on success. The success page reads the final status. On a
    // decline/validation error, the promise resolves here with `error` set.
    // Carry the next-charge date to the success page so it can show the
    // recurring summary. Stripe appends its own params to this return_url.
    const returnUrl = new URL("/stripe/success", window.location.origin);
    if (nextChargeAt) returnUrl.searchParams.set("renews", String(nextChargeAt));

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl.toString() },
    });

    // We only get here on an immediate error (no redirect happened).
    const mapped = mapStripeError(error);
    clearStatus();
    showError(mapped.title, mapped.message);
    setButton(payLabel(), { disabled: false });
  }

  primary.addEventListener("click", () => {
    if (phase === "select") void startPayment();
    else void confirm();
  });

  // Initialize button markup (adds the spinner span).
  setButton("Continue to payment");
}
