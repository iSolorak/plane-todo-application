import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifySignature } from "../src/webhook/verify.js";

const SECRET = "webhook-secret";

function sign(body: Buffer, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifySignature (HMAC)", () => {
  it("accepts a correctly-signed body", () => {
    const body = Buffer.from(JSON.stringify({ event: "issue", action: "created" }));
    expect(verifySignature(body, SECRET, sign(body, SECRET))).toBe(true);
  });

  it("rejects a signature made with the wrong secret", () => {
    const body = Buffer.from("{}");
    expect(verifySignature(body, SECRET, sign(body, "not-the-secret"))).toBe(false);
  });

  it("rejects when the body was tampered with after signing", () => {
    const original = Buffer.from(JSON.stringify({ amount: 1 }));
    const signature = sign(original, SECRET);
    const tampered = Buffer.from(JSON.stringify({ amount: 999 }));
    expect(verifySignature(tampered, SECRET, signature)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifySignature(Buffer.from("{}"), SECRET, undefined)).toBe(false);
  });

  it("rejects a signature of a different length (no timingSafeEqual throw)", () => {
    expect(verifySignature(Buffer.from("{}"), SECRET, "deadbeef")).toBe(false);
  });
});
