import { describe, it, expect } from "vitest";
import { LruSet } from "../src/webhook/dedup.js";

describe("LruSet delivery dedup", () => {
  it("reports first-seen vs duplicate", () => {
    const seen = new LruSet(500);
    expect(seen.add("delivery-1")).toBe(true); // newly added
    expect(seen.has("delivery-1")).toBe(true);
    expect(seen.add("delivery-1")).toBe(false); // duplicate
  });

  it("evicts the oldest id beyond capacity", () => {
    const seen = new LruSet(2);
    seen.add("a");
    seen.add("b");
    seen.add("c"); // evicts "a"

    expect(seen.has("a")).toBe(false);
    expect(seen.has("b")).toBe(true);
    expect(seen.has("c")).toBe(true);
    expect(seen.size).toBe(2);
  });

  it("re-adding a still-present id does not grow the set", () => {
    const seen = new LruSet(3);
    seen.add("a");
    seen.add("a");
    expect(seen.size).toBe(1);
  });
});
