/**
 * Shared UI helpers for both provider checkout islands — the button spinner,
 * the status banner, and the error banner. Each island owns its provider-
 * specific confirm flow; this owns the common DOM states so they don't drift.
 */
export interface CheckoutUi {
  setButton: (label: string, opts?: { busy?: boolean; disabled?: boolean }) => void;
  showStatus: (tone: string, title: string, message: string) => void;
  clearStatus: () => void;
  showError: (title: string, message: string) => void;
  clearError: () => void;
}

export function createCheckoutUi(els: { primary: HTMLButtonElement; status: HTMLElement; error: HTMLElement }): CheckoutUi {
  const { primary, status, error } = els;
  return {
    setButton(label, opts = {}) {
      primary.dataset.busy = opts.busy ? "true" : "false";
      primary.disabled = Boolean(opts.disabled);
      primary.innerHTML = `<span class="btn__spinner" aria-hidden="true"></span><span>${label}</span>`;
    },
    showStatus(tone, title, message) {
      status.hidden = false;
      status.dataset.tone = tone;
      status.textContent = message ? `${title} ${message}` : title;
    },
    clearStatus() {
      status.hidden = true;
      status.textContent = "";
    },
    showError(title, message) {
      error.hidden = false;
      error.innerHTML = `<strong></strong><span></span>`;
      error.querySelector("strong")!.textContent = title;
      error.querySelector("span")!.textContent = message;
    },
    clearError() {
      error.hidden = true;
      error.textContent = "";
    },
  };
}
