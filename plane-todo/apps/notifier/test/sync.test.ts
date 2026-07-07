import { describe, it, expect, vi } from "vitest";
import type { PlaneClient } from "@plane-todo/core";
import { openDb, Store } from "../src/db.js";
import type { AppEnv } from "../src/config.js";
import { syncProjectReminders } from "../src/sync.js";

const ENV = {
  planeBaseUrl: "https://plane.test",
  planeWorkspaceSlug: "acme",
  planeProjectIds: ["p1"],
} as AppEnv;

describe("syncProjectReminders (Plane API read, mocked)", () => {
  it("pages through work items and upserts only those with a target_date", async () => {
    const pages = [
      {
        results: [
          { id: "a", name: "A", project_id: "p1", target_date: "2026-07-10" },
          { id: "b", name: "B", project_id: "p1", target_date: null },
        ],
        nextCursor: "100:1:0",
        prevCursor: null,
        hasMore: true,
        hasPrev: false,
        count: 2,
        totalPages: 2,
        totalResults: 3,
      },
      {
        results: [
          { id: "c", name: "C", project_id: "p1", target_date: "2026-07-12" },
        ],
        nextCursor: "100:2:0",
        prevCursor: "100:1:1",
        hasMore: false,
        hasPrev: true,
        count: 1,
        totalPages: 2,
        totalResults: 3,
      },
    ];

    let call = 0;
    const listWorkItems = vi.fn(
      async (_projectId: string, _params?: { cursor?: string }) => pages[call++],
    );
    const client = { listWorkItems } as unknown as PlaneClient;

    const store = new Store(openDb(":memory:"));
    await syncProjectReminders(client, store, ENV);

    expect(listWorkItems).toHaveBeenCalledTimes(2);
    // Second call must carry the cursor from the first page.
    expect(listWorkItems.mock.calls[1]![1]).toMatchObject({ cursor: "100:1:0" });

    const ids = store
      .allWithTargetDate()
      .map((r) => r.work_item_id)
      .sort();
    expect(ids).toEqual(["a", "c"]); // "b" had no target_date
  });
});
