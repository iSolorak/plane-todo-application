import { Expo, type ExpoPushMessage } from "expo-server-sdk";

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  /** Number of tokens actually handed to Expo (post filter). */
  attempted: number;
  /** Tickets Expo returned with status === "ok". */
  accepted: number;
  /** Ticket-level errors Expo returned per-message (kept short for logs). */
  ticketErrors: string[];
  /** Tokens Expo reported as DeviceNotRegistered — callers should drop. */
  invalidTokens: string[];
  /** Non-fatal chunk-send errors (e.g. Expo API down, network failure). */
  chunkErrors: string[];
}

export interface PushSender {
  send(tokens: string[], message: PushMessage): Promise<PushResult>;
}

/**
 * Expo push sender. Filters non-Expo tokens, chunks messages, and returns a
 * detailed result (attempted / accepted / errors / invalid tokens) so callers
 * can distinguish "0 devices" from "Expo rejected" from "Expo unreachable".
 * Never throws.
 */
export function createPushSender(expo: Expo = new Expo()): PushSender {
  return {
    async send(tokens, message) {
      const invalidTokens: string[] = [];
      const ticketErrors: string[] = [];
      const chunkErrors: string[] = [];
      const valid = tokens.filter((t) => Expo.isExpoPushToken(t));
      let accepted = 0;

      if (valid.length === 0) {
        return { attempted: 0, accepted: 0, ticketErrors, invalidTokens, chunkErrors };
      }

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
            if (ticket.status === "ok") {
              accepted++;
              return;
            }
            // ticket.status === "error"
            const errCode = ticket.details?.error;
            if (errCode === "DeviceNotRegistered") {
              const msg = chunk[i];
              if (msg && typeof msg.to === "string") invalidTokens.push(msg.to);
            }
            ticketErrors.push(`${errCode ?? "unknown"}: ${ticket.message ?? ""}`);
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[push] chunk send failed:", err);
          chunkErrors.push(msg);
        }
      }

      return {
        attempted: valid.length,
        accepted,
        ticketErrors,
        invalidTokens,
        chunkErrors,
      };
    },
  };
}
