import { describe, it, expect, vi } from "vitest";
import { Expo } from "expo-server-sdk";
import { createPushSender } from "../src/senders/push.js";

// --- Mock nodemailer (SMTP) --------------------------------------------------
const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn(async () => ({ messageId: "mock" })),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

import { createEmailSender } from "../src/senders/email.js";

const VALID_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

describe("createEmailSender (SMTP)", () => {
  it("returns null when SMTP is not fully configured", () => {
    expect(createEmailSender({})).toBeNull();
    expect(createEmailSender({ host: "smtp.test", from: "a@b.co" })).toBeNull(); // no `to`
    expect(createEmailSender({ host: "smtp.test", to: "c@d.co" })).toBeNull(); // no `from`
  });

  it("sends a single mail to SMTP_TO when configured", async () => {
    const sender = createEmailSender({
      host: "smtp.test",
      port: 587,
      from: "from@test.co",
      to: "to@test.co",
    });
    expect(sender).not.toBeNull();

    await sender!.send("Subject", "Body");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "from@test.co",
        to: "to@test.co",
        subject: "Subject",
        text: "Body",
      }),
    );
  });
});

describe("createPushSender (Expo)", () => {
  it("drops tokens Expo reports as DeviceNotRegistered", async () => {
    const fakeExpo = {
      chunkPushNotifications: (msgs: unknown[]) => [msgs],
      sendPushNotificationsAsync: async (chunk: unknown[]) =>
        chunk.map(() => ({
          status: "error",
          message: "gone",
          details: { error: "DeviceNotRegistered" },
        })),
    } as unknown as Expo;

    const sender = createPushSender(fakeExpo);
    const res = await sender.send([VALID_TOKEN], { title: "t", body: "b" });
    expect(res.invalidTokens).toEqual([VALID_TOKEN]);
  });

  it("filters out non-Expo tokens before sending", async () => {
    const sendSpy = vi.fn(async (chunk: unknown[]) =>
      chunk.map(() => ({ status: "ok", id: "1" })),
    );
    const fakeExpo = {
      chunkPushNotifications: (msgs: unknown[]) => (msgs.length ? [msgs] : []),
      sendPushNotificationsAsync: sendSpy,
    } as unknown as Expo;

    const sender = createPushSender(fakeExpo);
    const res = await sender.send(["not-a-real-token"], { title: "t", body: "b" });
    expect(res.invalidTokens).toEqual([]);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("does not throw when a chunk send rejects (best-effort)", async () => {
    const fakeExpo = {
      chunkPushNotifications: (msgs: unknown[]) => [msgs],
      sendPushNotificationsAsync: async () => {
        throw new Error("network down");
      },
    } as unknown as Expo;

    const sender = createPushSender(fakeExpo);
    const res = await sender.send([VALID_TOKEN], { title: "t", body: "b" });
    expect(res.invalidTokens).toEqual([]);
  });
});
