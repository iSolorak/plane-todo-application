import { describe, it, expect, beforeEach } from "vitest";
import { openDb, Store } from "../src/db.js";
import {
  handlePlaneWebhook,
  type HandlerContext,
} from "../src/webhook/handler.js";

const CTX: HandlerContext = {
  projectIds: ["p1"],
  baseUrl: "https://plane.test",
  workspaceSlug: "acme",
};

const BASE_ISSUE = {
  id: "wi1",
  name: "Ship it",
  project_id: "p1",
  target_date: "2026-07-10",
};

describe("handlePlaneWebhook", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(openDb(":memory:"));
  });

  it("upserts a reminder on created with a target_date", () => {
    const result = handlePlaneWebhook(
      store,
      { event: "issue", action: "created", data: BASE_ISSUE },
      CTX,
    );

    expect(result).toEqual({ handled: true, op: "upsert" });
    const rows = store.allWithTargetDate();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Ship it");
    expect(rows[0]!.url).toBe("https://plane.test/acme/projects/p1/issues/wi1");
  });

  it("is idempotent — updated overwrites the same row", () => {
    handlePlaneWebhook(
      store,
      { event: "issue", action: "created", data: BASE_ISSUE },
      CTX,
    );
    handlePlaneWebhook(
      store,
      {
        event: "issue",
        action: "updated",
        data: { ...BASE_ISSUE, name: "Ship it (renamed)" },
      },
      CTX,
    );

    const rows = store.allWithTargetDate();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Ship it (renamed)");
  });

  it("deletes the reminder AND its sent_log on a deleted event", () => {
    handlePlaneWebhook(
      store,
      { event: "issue", action: "created", data: BASE_ISSUE },
      CTX,
    );
    store.markSent("wi1", "1h", new Date().toISOString());
    expect(store.isSent("wi1", "1h")).toBe(true);

    const result = handlePlaneWebhook(
      store,
      { event: "issue", action: "deleted", data: { id: "wi1" } },
      CTX,
    );

    expect(result).toEqual({ handled: true, op: "delete" });
    expect(store.allWithTargetDate()).toHaveLength(0);
    expect(store.isSent("wi1", "1h")).toBe(false);
  });

  it("removes the row when target_date becomes null", () => {
    handlePlaneWebhook(
      store,
      { event: "issue", action: "created", data: BASE_ISSUE },
      CTX,
    );
    const result = handlePlaneWebhook(
      store,
      {
        event: "issue",
        action: "updated",
        data: { ...BASE_ISSUE, target_date: null },
      },
      CTX,
    );

    expect(result).toEqual({ handled: true, op: "delete" });
    expect(store.allWithTargetDate()).toHaveLength(0);
  });

  it("accepts `project` as an alias for the project id", () => {
    handlePlaneWebhook(
      store,
      {
        event: "issue",
        action: "created",
        data: { id: "wi2", name: "Alt", project: "p1", target_date: "2026-07-11" },
      },
      CTX,
    );
    expect(store.allWithTargetDate()).toHaveLength(1);
  });

  it("ignores non-issue events without touching the DB", () => {
    const result = handlePlaneWebhook(
      store,
      { event: "cycle", action: "created", data: { id: "c1" } },
      CTX,
    );
    expect(result.handled).toBe(false);
    expect(store.allWithTargetDate()).toHaveLength(0);
  });

  it("ignores events for projects outside PLANE_PROJECT_IDS", () => {
    const result = handlePlaneWebhook(
      store,
      {
        event: "issue",
        action: "created",
        data: { id: "wiX", project_id: "other", target_date: "2026-07-10" },
      },
      CTX,
    );
    expect(result.handled).toBe(false);
    expect(store.allWithTargetDate()).toHaveLength(0);
  });
});
