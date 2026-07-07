import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Plane webhook signature: HMAC-SHA256(rawBody, secret) as lowercase
 * hex, compared to the `X-Plane-Signature` header with a constant-time compare.
 *
 * `rawBody` MUST be the exact bytes received, read before any JSON parsing.
 */
export function verifySignature(
  rawBody: Buffer,
  secret: string,
  signature: string | undefined,
): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  // Both sides are lowercase hex of the same length when valid; timingSafeEqual
  // requires equal-length buffers, so guard on length first.
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}
