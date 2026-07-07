import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlaneClient, PlaneApiError, type FetchLike } from "../src/index.js";

// -----------------------------------------------------------------------------
// Test helpers
// -----------------------------------------------------------------------------

interface RecordedCall {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body?: string;
}

interface MockResponseSpec {
  status?: number;
  statusText?: string;
  json?: unknown;
  text?: string;
}

/**
 * Build a mock fetch that records every call and returns a queued (or single)
 * response. Mirrors just enough of the Fetch API for the client.
 */
function makeFetch(responses: MockResponseSpec | MockResponseSpec[]) {
  const calls: RecordedCall[] = [];
  const queue = Array.isArray(responses) ? [...responses] : [responses];

  const fetchImpl: FetchLike = vi.fn(async (url, init) => {
    calls.push({
      url,
      method: init?.method,
      headers: { ...(init?.headers ?? {}) },
      body: init?.body,
    });

    const spec = (queue.length > 1 ? queue.shift() : queue[0]) as MockResponseSpec;
    const status = spec.status ?? 200;
    const bodyText =
      spec.text ?? (spec.json !== undefined ? JSON.stringify(spec.json) : "");

    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: spec.statusText ?? "",
      text: async () => bodyText,
    };
  });

  return { fetchImpl, calls };
}

const BASE = "https://plane.acme.dev";
const SLUG = "acme";
const PROJECT = "proj-1";

function apiKeyClient(fetchImpl: FetchLike) {
  return new PlaneClient({
    baseUrl: BASE,
    workspaceSlug: SLUG,
    auth: { type: "apiKey", apiKey: "secret-key" },
    fetch: fetchImpl,
  });
}

function oauthClient(fetchImpl: FetchLike) {
  return new PlaneClient({
    baseUrl: BASE,
    workspaceSlug: SLUG,
    auth: { type: "oauth", accessToken: "tok-123" },
    fetch: fetchImpl,
  });
}

// -----------------------------------------------------------------------------
// Auth header selection
// -----------------------------------------------------------------------------

describe("auth header selection", () => {
  it("sends X-API-Key for apiKey auth and no Authorization header", async () => {
    const { fetchImpl, calls } = makeFetch({ json: [] });
    await apiKeyClient(fetchImpl).listProjects();

    expect(calls[0]!.headers["X-API-Key"]).toBe("secret-key");
    expect(calls[0]!.headers["Authorization"]).toBeUndefined();
  });

  it("sends Authorization: Bearer for oauth auth and no X-API-Key", async () => {
    const { fetchImpl, calls } = makeFetch({ json: [] });
    await oauthClient(fetchImpl).listProjects();

    expect(calls[0]!.headers["Authorization"]).toBe("Bearer tok-123");
    expect(calls[0]!.headers["X-API-Key"]).toBeUndefined();
  });

  it("does not leak secrets into serialized request objects", async () => {
    const { fetchImpl, calls } = makeFetch({ json: [] });
    await oauthClient(fetchImpl).listProjects();
    // The token appears only in the Authorization header, nowhere in the URL/body.
    expect(calls[0]!.url).not.toContain("tok-123");
    expect(calls[0]!.body).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// URL construction & trailing slash
// -----------------------------------------------------------------------------

describe("url construction", () => {
  it("prefixes /api/v1 and enforces a trailing slash", async () => {
    const { fetchImpl, calls } = makeFetch({ json: [] });
    await apiKeyClient(fetchImpl).listProjects();

    expect(calls[0]!.url).toBe(`${BASE}/api/v1/workspaces/${SLUG}/projects/`);
    expect(calls[0]!.url.endsWith("/")).toBe(true);
  });

  it("keeps the trailing slash before the query string", async () => {
    const { fetchImpl, calls } = makeFetch({ json: { results: [] } });
    await apiKeyClient(fetchImpl).listWorkItems(PROJECT, { per_page: 50 });

    const [path, query] = calls[0]!.url.split("?");
    expect(path).toBe(
      `${BASE}/api/v1/workspaces/${SLUG}/projects/${PROJECT}/work-items/`,
    );
    expect(path!.endsWith("/")).toBe(true);
    expect(query).toContain("per_page=50");
  });

  it("strips redundant trailing slashes from baseUrl", async () => {
    const { fetchImpl, calls } = makeFetch({ json: [] });
    new PlaneClient({
      baseUrl: `${BASE}///`,
      workspaceSlug: SLUG,
      auth: { type: "apiKey", apiKey: "k" },
      fetch: fetchImpl,
    }).listProjects();

    // No double slashes after the scheme.
    const withoutScheme = calls[0]!.url.replace(/^https:\/\//, "");
    expect(withoutScheme).not.toContain("//");
  });

  it("joins array query params (fields/expand) with commas", async () => {
    const { fetchImpl, calls } = makeFetch({ json: { results: [] } });
    await apiKeyClient(fetchImpl).listWorkItems(PROJECT, {
      fields: ["id", "name"],
      expand: ["state", "assignees"],
    });

    const query = decodeURIComponent(calls[0]!.url.split("?")[1] ?? "");
    expect(query).toContain("fields=id,name");
    expect(query).toContain("expand=state,assignees");
  });

  it("encodes path segments", async () => {
    const { fetchImpl, calls } = makeFetch({ json: {} });
    await apiKeyClient(fetchImpl).getWorkItem(PROJECT, "a b/c");
    expect(calls[0]!.url).toContain("a%20b%2Fc");
  });
});

// -----------------------------------------------------------------------------
// HTTP verbs / bodies
// -----------------------------------------------------------------------------

describe("work item mutations", () => {
  it("POSTs JSON on create with Content-Type", async () => {
    const { fetchImpl, calls } = makeFetch({ json: { id: "wi-1", name: "New" } });
    const created = await apiKeyClient(fetchImpl).createWorkItem(PROJECT, {
      name: "New",
    });

    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calls[0]!.body!)).toEqual({ name: "New" });
    expect(created).toEqual({ id: "wi-1", name: "New" });
  });

  it("PATCHes on update", async () => {
    const { fetchImpl, calls } = makeFetch({ json: { id: "wi-1", name: "X" } });
    await apiKeyClient(fetchImpl).updateWorkItem(PROJECT, "wi-1", {
      priority: "high",
    });

    expect(calls[0]!.method).toBe("PATCH");
    expect(calls[0]!.url.endsWith("/work-items/wi-1/")).toBe(true);
    expect(JSON.parse(calls[0]!.body!)).toEqual({ priority: "high" });
  });

  it("DELETEs and tolerates a 204 empty body", async () => {
    const { fetchImpl, calls } = makeFetch({ status: 204 });
    const result = await apiKeyClient(fetchImpl).deleteWorkItem(PROJECT, "wi-1");

    expect(calls[0]!.method).toBe("DELETE");
    expect(result).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// Pagination
// -----------------------------------------------------------------------------

describe("cursor pagination", () => {
  it("derives hasMore/hasPrev from the page-results booleans, not the cursor", async () => {
    const { fetchImpl } = makeFetch({
      json: {
        results: [{ id: "wi-1" }, { id: "wi-2" }],
        next_cursor: "20:1:0",
        prev_cursor: "20:0:1",
        next_page_results: true,
        prev_page_results: false,
        count: 2,
        total_pages: 5,
        total_results: 100,
      },
    });

    const page = await apiKeyClient(fetchImpl).listWorkItems(PROJECT, {
      per_page: 20,
    });

    expect(page.results).toHaveLength(2);
    expect(page.nextCursor).toBe("20:1:0");
    expect(page.prevCursor).toBe("20:0:1");
    expect(page.hasMore).toBe(true);
    expect(page.hasPrev).toBe(false);
    expect(page.count).toBe(2);
    expect(page.totalPages).toBe(5);
    expect(page.totalResults).toBe(100);
  });

  it("reports hasMore=false when next_page_results is false even though next_cursor is present", async () => {
    const { fetchImpl } = makeFetch({
      json: {
        results: [{ id: "wi-9" }],
        // next_cursor is ALWAYS present in Plane responses, so it must not
        // drive hasMore — the last page still has a (non-navigable) cursor.
        next_cursor: "20:2:0",
        prev_cursor: "20:1:1",
        next_page_results: false,
        prev_page_results: true,
      },
    });

    const page = await apiKeyClient(fetchImpl).listWorkItems(PROJECT);
    expect(page.nextCursor).toBe("20:2:0");
    expect(page.hasMore).toBe(false);
    expect(page.hasPrev).toBe(true);
  });

  it("passes the cursor through as a query param", async () => {
    const { fetchImpl, calls } = makeFetch({ json: { results: [] } });
    await apiKeyClient(fetchImpl).listWorkItems(PROJECT, { cursor: "20:1:0" });
    expect(decodeURIComponent(calls[0]!.url)).toContain("cursor=20:1:0");
  });

  it("defaults to empty results and zeroed metadata when Plane omits fields", async () => {
    const { fetchImpl } = makeFetch({ json: {} });
    const page = await apiKeyClient(fetchImpl).listWorkItems(PROJECT);
    expect(page.results).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(page.prevCursor).toBeNull();
    expect(page.hasMore).toBe(false);
    expect(page.hasPrev).toBe(false);
    expect(page.count).toBe(0);
    expect(page.totalPages).toBe(0);
    expect(page.totalResults).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// Error mapping
// -----------------------------------------------------------------------------

describe("error mapping", () => {
  it("throws a typed PlaneApiError with status/code/message from the body", async () => {
    const { fetchImpl } = makeFetch({
      status: 404,
      statusText: "Not Found",
      json: { code: "work_item_not_found", detail: "The work item does not exist" },
    });

    await expect(
      apiKeyClient(fetchImpl).getWorkItem(PROJECT, "missing"),
    ).rejects.toMatchObject({
      name: "PlaneApiError",
      status: 404,
      code: "work_item_not_found",
      message: "The work item does not exist",
    });
  });

  it("is an instanceof PlaneApiError", async () => {
    const { fetchImpl } = makeFetch({ status: 500, statusText: "Server Error" });
    const err = await apiKeyClient(fetchImpl)
      .listProjects()
      .catch((e) => e);
    expect(err).toBeInstanceOf(PlaneApiError);
    expect(err.status).toBe(500);
    // Falls back to the status code when the body has no `code`.
    expect(err.code).toBe("500");
  });

  it("falls back to statusText when the error body is not JSON", async () => {
    const { fetchImpl } = makeFetch({
      status: 502,
      statusText: "Bad Gateway",
      text: "<html>nginx</html>",
    });
    const err: PlaneApiError = await oauthClient(fetchImpl)
      .listProjects()
      .catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.message).toBe("Bad Gateway");
  });
});

// -----------------------------------------------------------------------------
// Constructor validation
// -----------------------------------------------------------------------------

describe("constructor", () => {
  const noop: FetchLike = async () => ({
    ok: true,
    status: 200,
    statusText: "",
    text: async () => "",
  });

  it("requires baseUrl, workspaceSlug and auth", () => {
    expect(
      () =>
        new PlaneClient({
          baseUrl: "",
          workspaceSlug: SLUG,
          auth: { type: "apiKey", apiKey: "k" },
          fetch: noop,
        }),
    ).toThrow(/baseUrl/);
    expect(
      () =>
        new PlaneClient({
          baseUrl: BASE,
          workspaceSlug: "",
          auth: { type: "apiKey", apiKey: "k" },
          fetch: noop,
        }),
    ).toThrow(/workspaceSlug/);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });
});
