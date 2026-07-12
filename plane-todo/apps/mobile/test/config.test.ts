import { describe, it, expect } from "vitest";
import {
  configFieldErrors,
  isSetupComplete,
  normalizeConfig,
} from "../src/data/config";

describe("isSetupComplete", () => {
  it("requires baseUrl, workspaceSlug and apiKey", () => {
    expect(isSetupComplete(null)).toBe(false);
    expect(isSetupComplete({ planeBaseUrl: "https://x", workspaceSlug: "w" })).toBe(
      false,
    );
    expect(
      isSetupComplete({
        planeBaseUrl: "https://x",
        workspaceSlug: "w",
        planeApiKey: "k",
      }),
    ).toBe(true);
  });

  it("treats whitespace-only values as missing", () => {
    expect(
      isSetupComplete({
        planeBaseUrl: "  ",
        workspaceSlug: "w",
        planeApiKey: "k",
      }),
    ).toBe(false);
  });
});

describe("configFieldErrors", () => {
  it("flags missing required fields", () => {
    const errors = configFieldErrors({});
    expect(errors.planeBaseUrl).toBeDefined();
    expect(errors.workspaceSlug).toBeDefined();
    expect(errors.planeApiKey).toBeDefined();
  });

  it("validates URL shape for base and notifier", () => {
    expect(configFieldErrors({ planeBaseUrl: "not-a-url" }).planeBaseUrl).toMatch(
      /http/i,
    );
    expect(
      configFieldErrors({
        planeBaseUrl: "https://x",
        workspaceSlug: "w",
        planeApiKey: "k",
        notifierBaseUrl: "ftp://nope",
      }).notifierBaseUrl,
    ).toMatch(/http/i);
  });

  it("passes a fully valid draft", () => {
    expect(
      configFieldErrors({
        planeBaseUrl: "https://plane.example.com",
        workspaceSlug: "acme",
        planeApiKey: "k",
        notifierBaseUrl: "https://notifier.example.com",
      }),
    ).toEqual({});
  });
});

describe("normalizeConfig", () => {
  it("trims values and drops empty optionals", () => {
    const cfg = normalizeConfig({
      planeBaseUrl: "  https://x  ",
      workspaceSlug: " w ",
      planeApiKey: " k ",
      notifierBaseUrl: "   ",
      defaultProjectId: "",
    });
    expect(cfg.planeBaseUrl).toBe("https://x");
    expect(cfg.workspaceSlug).toBe("w");
    expect(cfg.planeApiKey).toBe("k");
    expect(cfg.notifierBaseUrl).toBeUndefined();
    expect(cfg.defaultProjectId).toBeUndefined();
  });
});
