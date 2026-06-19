import { getStore } from "@netlify/blobs";

// A tiny cross-request marker so a success page can confirm that the provider's
// webhook for a payment actually reached the server. Netlify Blobs is a
// serverless KV store, auto-configured on Netlify and in `netlify dev`.
const STORE = "webhook-receipts";

async function mark(key: string, at: number): Promise<void> {
  await getStore(STORE).setJSON(key, { at });
}

async function seen(key: string): Promise<number | null> {
  const rec = (await getStore(STORE).get(key, { type: "json" })) as { at?: number } | null;
  return rec && typeof rec.at === "number" ? rec.at : null;
}

/** Stripe — keyed by PaymentIntent id. */
export const markPaymentSeen = (paymentIntentId: string, at: number): Promise<void> =>
  mark(`pi/${paymentIntentId}`, at);
export const wasPaymentSeen = (paymentIntentId: string): Promise<number | null> => seen(`pi/${paymentIntentId}`);

/** Xendit — keyed by our session reference_id (echoed back in the payment webhook). */
export const markXenditSeen = (referenceId: string, at: number): Promise<void> => mark(`xnd/${referenceId}`, at);
export const wasXenditSeen = (referenceId: string): Promise<number | null> => seen(`xnd/${referenceId}`);
