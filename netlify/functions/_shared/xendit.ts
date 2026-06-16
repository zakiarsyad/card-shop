/**
 * Minimal Xendit API client (server-side only). HTTP Basic auth with the secret
 * key (key as username, empty password). Test mode only — rejects production
 * keys, mirroring the Stripe client guard (CLAUDE.md hard rule).
 */
const XENDIT_API = "https://api.xendit.co";

function authHeader(key: string): string {
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export interface XenditSession {
  payment_session_id: string;
  components_sdk_key: string;
  status: string;
}

export async function createPaymentSession(
  body: unknown,
  env: Record<string, string | undefined> = process.env,
): Promise<XenditSession> {
  const key = env.XENDIT_SECRET_KEY;
  if (!key) throw new Error("Missing XENDIT_SECRET_KEY");
  if (key.startsWith("xnd_production")) {
    throw new Error("Live Xendit keys are not allowed in this project (test mode only)");
  }

  const res = await fetch(`${XENDIT_API}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: authHeader(key) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Xendit /sessions ${res.status}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as XenditSession;
}
