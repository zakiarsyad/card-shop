/**
 * Xendit success page controller. We only reach this page once the payment is
 * confirmed (the SDK's session-complete event, or our webhook poll for
 * subscriptions), so the outcome is already success — no status retrieval is
 * needed (display-only; fulfillment is the webhook's job, ADR-0002).
 *
 * The one live bit is the shared webhook indicator: poll until Xendit's webhook
 * for this payment reaches the server, then flip the badge to confirmed.
 */
import { watchWebhook } from "../webhook-indicator";

export function renderSuccess(): void {
  watchWebhook({
    id: new URLSearchParams(window.location.search).get("ref"),
    provider: "Xendit",
    statusUrl: (id) => `/.netlify/functions/xendit-webhook-status?ref=${encodeURIComponent(id)}`,
  });
}
