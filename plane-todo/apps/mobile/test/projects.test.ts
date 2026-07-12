import { describe, it, expect } from "vitest";
import type { Project } from "@plane-todo/core";
import {
  normalizeProjects,
  selectActiveProjectId,
  selectTodayProjectIds,
} from "../src/data/projects";

const PROJECTS: Project[] = [
  { id: "p1", name: "One" },
  { id: "p2", name: "Two" },
];

/** What Plane actually returned at runtime: the paginated envelope. */
const PAGINATED_WRAPPER = {
  results: PROJECTS,
  next_cursor: "20:1:0",
  prev_cursor: "20:0:1",
  next_page_results: false,
  prev_page_results: false,
  count: 2,
  total_pages: 1,
  total_results: 2,
} as unknown as Project[];

describe("normalizeProjects", () => {
  it("passes a normal array through", () => {
    expect(normalizeProjects(PROJECTS)).toEqual(PROJECTS);
  });

  it("unwraps the paginated { results } envelope", () => {
    expect(normalizeProjects(PAGINATED_WRAPPER)).toEqual(PROJECTS);
  });

  it("returns [] for undefined/null/garbage", () => {
    expect(normalizeProjects(undefined)).toEqual([]);
    expect(normalizeProjects(null)).toEqual([]);
    expect(normalizeProjects({ nope: true })).toEqual([]);
    expect(normalizeProjects("p1")).toEqual([]);
  });
});

describe("selectTodayProjectIds", () => {
  it("uses the default project only when configured", () => {
    expect(selectTodayProjectIds(PROJECTS, "p2")).toEqual(["p2"]);
  });

  it("spans all projects when no default (normal array)", () => {
    expect(selectTodayProjectIds(PROJECTS, undefined)).toEqual(["p1", "p2"]);
  });

  it("is empty (not throwing) for undefined input while loading", () => {
    expect(selectTodayProjectIds(undefined, undefined)).toEqual([]);
  });

  it("unwraps a paginated-wrapper input instead of throwing", () => {
    expect(selectTodayProjectIds(PAGINATED_WRAPPER, undefined)).toEqual([
      "p1",
      "p2",
    ]);
  });

  it("still honors the default project over a wrapper input", () => {
    expect(selectTodayProjectIds(PAGINATED_WRAPPER, "p9")).toEqual(["p9"]);
  });
});

describe("selectActiveProjectId", () => {
  it("prefers the default, else the first project", () => {
    expect(selectActiveProjectId(PROJECTS, "p2")).toBe("p2");
    expect(selectActiveProjectId(PROJECTS, undefined)).toBe("p1");
    expect(selectActiveProjectId(undefined, undefined)).toBeUndefined();
  });

  it("handles the paginated wrapper", () => {
    expect(selectActiveProjectId(PAGINATED_WRAPPER, undefined)).toBe("p1");
  });
});
