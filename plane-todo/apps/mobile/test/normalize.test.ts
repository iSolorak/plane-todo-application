import { describe, it, expect } from "vitest";
import type { Project } from "@plane-todo/core";
import { normalizeList } from "../src/data/normalize";

const PROJECTS: Project[] = [
  { id: "p1", name: "One" },
  { id: "p2", name: "Two" },
];

describe("normalizeList (the query select/normalizer)", () => {
  it("passes a bare array through", () => {
    expect(normalizeList<Project>(PROJECTS)).toEqual(PROJECTS);
    expect(normalizeList<Project>([])).toEqual([]);
  });

  it("unwraps the paginated { results } wrapper", () => {
    const wrapper = {
      results: PROJECTS,
      next_cursor: "20:1:0",
      next_page_results: false,
      count: 2,
      total_pages: 1,
      total_results: 2,
    };
    expect(normalizeList<Project>(wrapper)).toEqual(PROJECTS);
  });

  it("yields [] for undefined (loading state)", () => {
    expect(normalizeList<Project>(undefined)).toEqual([]);
  });

  it("yields [] for null, non-lists and malformed wrappers", () => {
    expect(normalizeList(null)).toEqual([]);
    expect(normalizeList("p1")).toEqual([]);
    expect(normalizeList(42)).toEqual([]);
    expect(normalizeList({ results: "not-an-array" })).toEqual([]);
    expect(normalizeList({ other: [] })).toEqual([]);
  });
});
