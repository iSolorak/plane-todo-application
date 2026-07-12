import { describe, it, expect } from "vitest";
import type { WorkItem } from "@plane-todo/core";
import { resolveProjectId, withProjectId } from "../src/data/itemRefs";

function wi(overrides: Partial<WorkItem> & { project?: string }): WorkItem {
  return {
    id: "wi1",
    name: "Task",
    description_html: null,
    sequence_id: 1,
    state: null,
    priority: "none",
    assignees: [],
    labels: [],
    start_date: null,
    target_date: null,
    project_id: undefined as unknown as string, // runtime shape under test
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  } as WorkItem;
}

describe("resolveProjectId", () => {
  it("prefers an explicit project_id", () => {
    expect(resolveProjectId(wi({ project_id: "p1", project: "p2" }), "p3")).toBe(
      "p1",
    );
  });

  it("falls back to the `project` alias when project_id is absent", () => {
    expect(resolveProjectId(wi({ project: "p2" }), "p3")).toBe("p2");
  });

  it("falls back to the project the query fetched from", () => {
    expect(resolveProjectId(wi({}), "p3")).toBe("p3");
  });

  it("returns undefined when nothing is available", () => {
    expect(resolveProjectId(wi({}))).toBeUndefined();
    expect(resolveProjectId(wi({ project_id: "" }))).toBeUndefined();
  });
});

describe("withProjectId", () => {
  it("stamps the fetched project id when the item lacks one", () => {
    const stamped = withProjectId(wi({}), "p9");
    expect(stamped.project_id).toBe("p9");
  });

  it("keeps the alias value over the fetched fallback", () => {
    expect(withProjectId(wi({ project: "p2" }), "p9").project_id).toBe("p2");
  });

  it("returns the same object when project_id is already correct", () => {
    const item = wi({ project_id: "p1" });
    expect(withProjectId(item, "p1")).toBe(item);
  });

  it("navigation params derived from a stamped item are complete", () => {
    const stamped = withProjectId(wi({}), "p1");
    const params = { id: stamped.id, projectId: stamped.project_id };
    expect(params).toEqual({ id: "wi1", projectId: "p1" });
  });
});
