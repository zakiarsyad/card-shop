/**
 * Xendit checkout island. Framework-free; the Components SDK is dynamically
 * imported on intent to pay, so it stays out of first load.
 *
 * One product, two ways — one create-session endpoint serves both (PAY /
 * SUBSCRIPTION); the client only sends a plan key. Flow (verified against
 * xendit-components-web v0.0.24 + xendit/demo-store):
 *   create session → new XenditComponents({ componentsSdkKey })
 *   → on "init": mount the CARDS channel component
 *   → "submission-ready" enables the button → submit()
 *   → "action-begin"/"action-end" host the 3-D Secure challenge in a modal
 *   → "session-complete" → /xendit/success
 */
import { PLANS, priceFor, type PlanKey } from "../../lib/catalog";
import { formatAmount } from "../../lib/money";

type Phase = "select" | "pay";

const CREATE_SESSION = "/.netlify/functions/xendit-create-session";

export function initCheckout(): void {
  const form = document.querySelector<HTMLElement>(".card");
  const primary = document.getElementById("primary") as HTMLButtonElement | null;
  const totalEl = document.getElementById("total-amount");
  const recurringEl = document.getElementById("recurring-note");
  const paymentSection = document.getElementById("payment-section");
  const mountEl = document.getElementById("payment-mount");
  const actionEl = document.getElementById("action");
  const actionModal = document.getElementById("action-modal");
  const statusEl = document.getElementById("status");
  const errorEl = document.getElementById("error");
  if (!form || !primary || !totalEl || !paymentSection || !mountEl || !actionEl || !statusEl || !errorEl) return;

  let phase: Phase = "select";
  let components: import("xendit-components-web").XenditComponents | null = null;
  let sessionId = "";
  let idempotencyKey = "";

  const selectedPlan = (): PlanKey => {
    const checked = form.querySelector<HTMLInputElement>('input[name="plan"]:checked');
    return (checked?.value as PlanKey) ?? "one_time";
  };
  const idr = (key: PlanKey) => {
    const { amount, currency } = priceFor(PLANS[key], "xendit");
    return formatAmount(amount, currency, "id-ID");
  };

  const setButton = (label: string, opts: { busy?: boolean; disabled?: boolean } = {}) => {
    primary.dataset.busy = opts.busy ? "true" : "false";
    primary.disabled = Boolean(opts.disabled);
    primary.innerHTML = `<span class="btn__spinner" aria-hidden="true"></span><span>${label}</span>`;
  };
  const showStatus = (tone: string, title: string, message: string) => {
    statusEl.hidden = false;
    statusEl.dataset.tone = tone;
    statusEl.textContent = message ? `${title} ${message}` : title;
  };
  const clearStatus = () => {
    statusEl.hidden = true;
    statusEl.textContent = "";
  };
  const showError = (title: string, message: string) => {
    errorEl.hidden = false;
    errorEl.innerHTML = `<strong></strong><span></span>`;
    errorEl.querySelector("strong")!.textContent = title;
    errorEl.querySelector("span")!.textContent = message;
  };
  const clearError = () => {
    errorEl.hidden = true;
    errorEl.textContent = "";
  };

  // CTA says exactly what it does; a subscription never reads as a one-time charge.
  const payLabel = (): string => {
    const plan = PLANS[selectedPlan()];
    return plan.interval ? `Subscribe · ${idr(plan.key)}/mo` : `Pay ${idr(plan.key)}`;
  };
  const syncTotal = () => {
    const plan = PLANS[selectedPlan()];
    totalEl.textContent = idr(plan.key);
    if (recurringEl) recurringEl.hidden = !plan.interval;
  };

  // Changing plan after opening payment invalidates the session (it was created
  // for the old plan) — tear down and require a fresh "Continue".
  const resetToSelect = () => {
    components = null;
    sessionId = "";
    idempotencyKey = "";
    mountEl.replaceChildren();
    if (actionModal) actionModal.hidden = true;
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
      const res = await fetch(CREATE_SESSION, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.key, idempotencyKey }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        componentsSdkKey?: string;
        paymentSessionId?: string;
        error?: { message?: string };
      };
      if (!res.ok || !data.componentsSdkKey) {
        throw new Error(data.error?.message ?? "We couldn't start checkout. Please try again.");
      }
      sessionId = data.paymentSessionId ?? "";

      const { XenditComponents } = await import("xendit-components-web");
      const sdk = new XenditComponents({ componentsSdkKey: data.componentsSdkKey });
      components = sdk;

      sdk.addEventListener("init", () => {
        const channel = sdk.getActiveChannels({ filter: "CARDS" })[0];
        if (!channel) {
          showError("Card payments unavailable", "This account has no card channel enabled.");
          return;
        }
        mountEl!.replaceChildren(sdk.createChannelComponent(channel));
      });
      sdk.addEventListener("submission-ready", () => setButton(payLabel(), { disabled: false }));
      // 3-D Secure: host the challenge in the modal overlay.
      sdk.addEventListener("action-begin", () => {
        // Reveal the modal BEFORE mounting, so the challenge iframe renders into
        // a visible, sized container (mounting it hidden gives a zero-size frame).
        if (actionModal) actionModal.hidden = false;
        actionEl!.replaceChildren(sdk.createActionContainerComponent());
      });
      sdk.addEventListener("action-end", () => {
        if (actionModal) actionModal.hidden = true;
        actionEl!.replaceChildren();
      });
      sdk.addEventListener("session-complete", () => {
        const url = new URL("/xendit/success", window.location.origin);
        if (sessionId) url.searchParams.set("session", sessionId);
        window.location.assign(url.toString());
      });
      sdk.addEventListener("session-expired-or-canceled", () => {
        if (actionModal) actionModal.hidden = true;
        clearStatus();
        showError("Payment didn't go through", "No charge was made. You can try again.");
        setButton(payLabel(), { disabled: false });
      });

      paymentSection!.hidden = false;
      clearStatus();
      phase = "pay";
      setButton(payLabel(), { disabled: true }); // enabled on "submission-ready"
    } catch (err) {
      clearStatus();
      showError("Couldn't start checkout", err instanceof Error ? err.message : "Please try again.");
      phase = "select";
      setButton("Continue to payment");
    }
  }

  function pay() {
    if (!components) return;
    clearError();
    setButton(payLabel(), { busy: true, disabled: true });
    showStatus("submitting", "Confirming your payment…", "Hang tight — this only takes a moment.");
    components.submit();
  }

  primary.addEventListener("click", () => {
    if (phase === "select") void startPayment();
    else pay();
  });

  setButton("Continue to payment");
  syncTotal();
}
