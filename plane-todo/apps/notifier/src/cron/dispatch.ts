import type { Store } from "../db.js";
import type { PushMessage, PushResult, Senders } from "../senders/index.js";

export interface DispatchResult {
  /** Registered device tokens at dispatch time. */
  tokenCount: number;
  /** null when tokenCount === 0 (push wasn't even attempted). */
  push: PushResult | null;
}

/**
 * Send one notification across both channels (best-effort) and prune any
 * device tokens Expo reported as unregistered. Never throws. Returns a
 * detailed result so callers (cron + debug endpoints) can distinguish
 * "no devices" from a real Expo/FCM failure — a bug the previous void return
 * type helped hide.
 */
export async function dispatch(
  store: Store,
  senders: Senders,
  message: PushMessage,
): Promise<DispatchResult> {
  const tokens = store.listDeviceTokens();
  let push: PushResult | null = null;
  if (tokens.length > 0) {
    push = await senders.sendPush(tokens, message);
    for (const token of push.invalidTokens) store.removeDevice(token);
  }
  await senders.sendEmail(message.title, message.body);
  return { tokenCount: tokens.length, push };
}
