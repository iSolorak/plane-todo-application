import { describe, it, expect, vi } from "vitest";
import { PlaneClient, type FetchLike } from "../src/index.js";

interface RecordedCall {
  url: string;
  method?: string;
}

function makeFetch(json: unknown) {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = vi.fn(async (url, init) => {
    calls.push({ url, method: init?.method });
    return {
      ok: true,
      status: 200,
      statusText: "",
      text: async () => JSON.stringify(json),
    };
  });
  return { fetchImpl, calls };
}

const BASE = "https://plane.acme.dev";
const SLUG = "acme";
const PROJECT = "proj-1";

function client(fetchImpl: FetchLike) {
  return new PlaneClient({
    baseUrl: BASE,
    workspaceSlug: SLUG,
    auth: { type: "apiKey", apiKey: "k" },
    fetch: fetchImpl,
  });
}

describe("listStates", () => {
  it("returns the typed State array from the response", async () => {
    const payload = [
      {
        id: "st-todo",
        name: "Todo",
        color: "#3b82f6",
        group: "unstarted",
        sequence: 1000,
        default: true,
        project_id: PROJECT,
      },
      {
        id: "st-done",
        name: "Done",
        color: "#22c55e",
        group: "completed",
        sequence: 4000,
        default: false,
        project_id: PROJECT,
      },
    ];
    const { fetchImpl } = makeFetch(payload);

    const states = await client(fetchImpl).listStates(PROJECT);

    expect(states).toHaveLength(2);
    // Shape: the discriminating fields the mobile app relies on are present.
    expect(states[0]).toMatchObject({
      id: "st-todo",
      name: "Todo",
      group: "unstarted",
      sequence: 1000,
      default: true,
    });
    expect(states[1]!.group).toBe("completed");
  });

  it("hits the project states endpoint with a trailing slash", async () => {
    const { fetchImpl, calls } = makeFetch([]);

    await client(fetchImpl).listStates(PROJECT);

    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toBe(
      `${BASE}/api/v1/workspaces/${SLUG}/projects/${PROJECT}/states/`,
    );
    expect(calls[0]!.url.endsWith("/")).toBe(true);
  });
});
