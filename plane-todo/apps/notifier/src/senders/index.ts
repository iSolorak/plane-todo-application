import type { AppEnv } from "../config.js";
import { createEmailSender, type EmailSender } from "./email.js";
import { createPushSender, type PushMessage, type PushResult } from "./push.js";

export type { PushMessage, PushResult } from "./push.js";

/**
 * Best-effort notification surface used by the cron jobs. Both channels log and
 * continue on failure — a sender must never throw, so a cron tick is never
 * crashed by a transient push/SMTP error.
 */
export interface Senders {
  sendPush(tokens: string[], message: PushMessage): Promise<PushResult>;
  sendEmail(subject: string, text: string): Promise<void>;
}

export function createSenders(env: AppEnv): Senders {
  const push = createPushSender();
  const email: EmailSender | null = createEmailSender(env.smtp);
  if (!email) {
    console.warn("[email] SMTP not configured — email notifications disabled.");
  }

  return {
    async sendPush(tokens, message) {
      try {
        return await push.send(tokens, message);
      } catch (err) {
        console.error("[push] send failed:", err);
        return {
          attempted: 0,
          accepted: 0,
          ticketErrors: [],
          invalidTokens: [],
          chunkErrors: [err instanceof Error ? err.message : String(err)],
        };
      }
    },
    async sendEmail(subject, text) {
      if (!email) return;
      try {
        await email.send(subject, text);
      } catch (err) {
        console.error("[email] send failed:", err);
      }
    },
  };
}
