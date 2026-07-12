import { describe, it, expect } from "vitest";
import { PlaneApiError } from "@plane-todo/core";
import { isUnauthorized, toUserFacingError } from "../src/data/errors";

describe("toUserFacingError", () => {
  it("maps 401 to an invalid-key message flagged unauthorized", () => {
    const err = new PlaneApiError({ status: 401, code: "unauth", message: "no" });
    expect(toUserFacingError(err)).toEqual({
      message: "API key invalid.",
      unauthorized: true,
    });
    expect(isUnauthorized(err)).toBe(true);
  });

  it("maps 5xx to a server-error message", () => {
    const err = new PlaneApiError({ status: 503, code: "x", message: "boom" });
    const result = toUserFacingError(err);
    expect(result.message).toMatch(/server error/i);
    expect(result.unauthorized).toBe(false);
  });

  it("never echoes the raw server message (no secret leakage)", () => {
    const err = new PlaneApiError({
      status: 400,
      code: "bad",
      message: "token=SUPERSECRET rejected",
    });
    expect(toUserFacingError(err).message).not.toContain("SUPERSECRET");
  });

  it("distinguishes network errors from generic ones", () => {
    expect(toUserFacingError(new Error("Network request failed")).message).toMatch(
      /can't reach plane/i,
    );
    expect(toUserFacingError(new Error("weird")).message).toMatch(
      /something went wrong/i,
    );
    expect(isUnauthorized(new Error("weird"))).toBe(false);
  });
});
