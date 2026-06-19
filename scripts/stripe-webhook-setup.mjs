/**
 * One-off: register (or inspect) the Stripe webhook endpoint via the SDK.
 * The signing secret it prints must be set as STRIPE_WEBHOOK_SECRET on the site.
 *
 * Run locally (Node 20+ reads .env itself):
 *   node --env-file=.env scripts/stripe-webhook-setup.mjs
 *
 * Test mode only — uses your sk_test key from .env.
 */
import Stripe from "stripe";

const URL = "https://checkout.zakiarsyad.com/.netlify/functions/stripe-webhook";
const EVENTS = ["payment_intent.succeeded", "invoice.paid"]; // one-time + subscription

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY not in env — run with: node --env-file=.env scripts/stripe-webhook-setup.mjs");
if (!key.startsWith("sk_test")) throw new Error("Refusing to run with a non-test key.");

const stripe = new Stripe(key);

console.log("Existing webhook endpoints:");
const { data } = await stripe.webhookEndpoints.list({ limit: 100 });
for (const e of data) console.log(`  ${e.status.padEnd(8)} ${e.url}  [${e.enabled_events.join(", ").slice(0, 60)}]`);

const existing = data.find((e) => e.url === URL);
if (existing) {
  console.log(`\nEndpoint for our URL already exists (id ${existing.id}, status ${existing.status}).`);
  console.log("Stripe only reveals the signing secret at creation time. If you don't have it stored,");
  console.log("delete this endpoint in the dashboard and re-run this script to mint a fresh one.");
} else {
  const ep = await stripe.webhookEndpoints.create({ url: URL, enabled_events: EVENTS, description: "checkout demo (multi-provider)" });
  console.log(`\nCreated endpoint ${ep.id}`);
  console.log("SIGNING SECRET (set this as STRIPE_WEBHOOK_SECRET on the site):");
  console.log("  " + ep.secret);
}
