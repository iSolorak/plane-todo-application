import type { Store } from "../db.js";
import type { PushMessage, Senders } from "../senders/index.js";

/**
 * Send one notification across both channels (best-effort) and prune any device
 * tokens Expo reported as unregistered. Never throws.
 */
export async function dispatch(
  store: Store,
  senders: Senders,
  message: PushMessage,
): Promise<void> {
  const tokens = store.listDeviceTokens();
  if (tokens.length > 0) {
    const { invalidTokens } = await senders.sendPush(tokens, message);
    for (const token of invalidTokens) store.removeDevice(token);
  }
  await senders.sendEmail(message.title, message.body);
}
