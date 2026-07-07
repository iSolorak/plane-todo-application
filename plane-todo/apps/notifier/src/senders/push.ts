import { Expo, type ExpoPushMessage } from "expo-server-sdk";

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  /** Tokens that Expo reported as DeviceNotRegistered — callers should drop. */
  invalidTokens: string[];
}

export interface PushSender {
  send(tokens: string[], message: PushMessage): Promise<PushResult>;
}

/**
 * Expo push sender. Filters non-Expo tokens, chunks messages, and collects
 * tokens that Expo reports as `DeviceNotRegistered` so the caller can prune
 * them. Errors within a chunk are logged and skipped — never thrown.
 */
export function createPushSender(expo: Expo = new Expo()): PushSender {
  return {
    async send(tokens, message) {
      const invalidTokens: string[] = [];
      const valid = tokens.filter((t) => Expo.isExpoPushToken(t));
      if (valid.length === 0) return { invalidTokens };

      const messages: ExpoPushMessage[] = valid.map((to) => ({
        to,
        sound: "default",
        title: message.title,
        body: message.body,
        data: message.data,
      }));

      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          tickets.forEach((ticket, i) => {
            if (
              ticket.status === "error" &&
              ticket.details?.error === "DeviceNotRegistered"
            ) {
              const msg = chunk[i];
              if (msg && typeof msg.to === "string") invalidTokens.push(msg.to);
            }
          });
        } catch (err) {
          console.error("[push] chunk send failed:", err);
        }
      }

      return { invalidTokens };
    },
  };
}
