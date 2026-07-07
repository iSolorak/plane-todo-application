import nodemailer from "nodemailer";
import type { SmtpConfig } from "../config.js";

export interface EmailSender {
  send(subject: string, text: string): Promise<void>;
}

/**
 * Build a nodemailer-backed email sender that sends a single mail to
 * `SMTP_TO`. Returns null when SMTP is not configured (host/from/to missing),
 * so the caller can skip email cleanly.
 */
export function createEmailSender(smtp: SmtpConfig): EmailSender | null {
  if (!smtp.host || !smtp.from || !smtp.to) return null;

  const port = smtp.port ?? 587;
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port,
    secure: port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  const from = smtp.from;
  const to = smtp.to;
  return {
    async send(subject, text) {
      await transport.sendMail({ from, to, subject, text });
    },
  };
}
