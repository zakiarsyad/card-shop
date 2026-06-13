/**
 * Replay-safe processing for webhook events. Stripe delivers at-least-once and
 * can re-deliver or reorder events, so every handler must tolerate duplicates
 * (docs/STANDARDS.md → Domain).
 *
 * This in-memory store dedupes within a single function instance. That is
 * deliberately the *demo* scope: a real deployment swaps in a durable store
 * (Redis/Postgres) keyed by event id — see the production notes in the README.
 * The interface is the same, so only the store changes.
 */

export interface IdempotencyStore {
  seen(id: string): boolean;
  remember(id: string): void;
}

export function createMemoryStore(): IdempotencyStore {
  const ids = new Set<string>();
  return {
    seen: (id) => ids.has(id),
    remember: (id) => {
      ids.add(id);
    },
  };
}

export interface ProcessResult {
  /** true if the handler ran; false if this id was already processed. */
  processed: boolean;
}

/**
 * Run `handler` exactly once per id. A second call with the same id is a no-op.
 * The id is remembered only after the handler succeeds, so a thrown handler can
 * be retried by Stripe's redelivery.
 */
export async function processOnce(
  store: IdempotencyStore,
  id: string,
  handler: () => void | Promise<void>,
): Promise<ProcessResult> {
  if (store.seen(id)) return { processed: false };
  await handler();
  store.remember(id);
  return { processed: true };
}
