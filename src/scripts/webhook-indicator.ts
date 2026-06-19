/**
 * Live "webhook received" badge for the success pages. Polls our receipt
 * endpoint until the provider's webhook for this payment reaches the server,
 * then flips the badge to confirmed — the visible proof that fulfillment runs
 * server-to-server (ADR-0002), not on this page. Shared by both providers; only
 * the label and the status endpoint differ.
 *
 * Expects the success page to render #webhook, #webhook-text, #webhook-caption.
 */
let started = false;

export function watchWebhook(opts: { id: string | null; provider: string; statusUrl: (id: string) => string }): void {
  if (started) return; // the caller may invoke this more than once (Stripe paints twice)
  const box = document.getElementById("webhook");
  const text = document.getElementById("webhook-text");
  if (!box || !text || !opts.id) return;
  started = true;
  const id = opts.id;

  const caption = document.getElementById("webhook-caption");
  if (caption) caption.hidden = false;

  const set = (state: string, label: string) => {
    box.dataset.state = state;
    text.textContent = label;
    box.hidden = false;
  };
  set("waiting", `Waiting for ${opts.provider}'s webhook…`);

  // Hold "waiting" visible for a beat even if the webhook is already in —
  // otherwise it flips to green too fast to notice.
  const startedAt = Date.now();
  const MIN_WAIT = 2800;
  const confirm = () => {
    const wait = Math.max(0, MIN_WAIT - (Date.now() - startedAt));
    window.setTimeout(() => set("received", "Webhook received — order fulfilled"), wait);
  };

  let tries = 0;
  const maxTries = 12; // ~24s
  const poll = async () => {
    tries += 1;
    try {
      const res = await fetch(opts.statusUrl(id));
      if (((await res.json()) as { received?: boolean }).received) {
        confirm();
        return;
      }
    } catch {
      /* transient */
    }
    if (tries >= maxTries) {
      set("idle", "Webhook not received yet — fulfillment completes in the background.");
      return;
    }
    window.setTimeout(() => void poll(), 2000);
  };
  void poll();
}
