import { authHeaders, type PlaneAuth } from "./auth.js";
import { PlaneApiError } from "./errors.js";
import type {
  CreateWorkItemInput,
  FieldSelection,
  ListWorkItemsParams,
  Paginated,
  Project,
  State,
  UpdateWorkItemInput,
  WorkItem,
} from "./types.js";

/** Minimal structural type for `fetch`, so the client works on Node18+ and RN. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
}>;

export interface PlaneClientOptions {
  /** Base URL of the self-hosted Plane instance, e.g. "https://plane.acme.dev". */
  baseUrl: string;
  /** Workspace slug that scopes all requests. */
  workspaceSlug: string;
  /** Authentication strategy (discriminated union). */
  auth: PlaneAuth;
  /**
   * Custom fetch implementation. Defaults to the global `fetch` (Node 18+, RN,
   * browsers). Injecting one is primarily useful for testing.
   */
  fetch?: FetchLike;
}

type QueryValue = string | number | boolean | string[] | undefined | null;
type QueryParams = Record<string, QueryValue>;

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
}

/** Raw cursor-pagination envelope as returned by Plane list endpoints. */
interface PlaneListResponse<T> {
  results?: T[];
  next_cursor?: string | null;
  prev_cursor?: string | null;
  next_page_results?: boolean;
  prev_page_results?: boolean;
  count?: number;
  total_pages?: number;
  total_results?: number;
}

export class PlaneClient {
  private readonly baseUrl: string;
  private readonly workspaceSlug: string;
  private readonly auth: PlaneAuth;
  private readonly fetchImpl: FetchLike;

  constructor(options: PlaneClientOptions) {
    if (!options.baseUrl) throw new Error("PlaneClient: `baseUrl` is required");
    if (!options.workspaceSlug)
      throw new Error("PlaneClient: `workspaceSlug` is required");
    if (!options.auth) throw new Error("PlaneClient: `auth` is required");

    // Strip trailing slashes so we can safely append `/api/v1` + path.
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.workspaceSlug = options.workspaceSlug;
    this.auth = options.auth;

    const resolvedFetch = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!resolvedFetch) {
      throw new Error(
        "PlaneClient: no `fetch` available. Provide `options.fetch` or run on a platform with global fetch (Node 18+, React Native, browsers).",
      );
    }
    this.fetchImpl = resolvedFetch;
  }

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------

  listProjects(): Promise<Project[]> {
    return this.request<Project[]>(
      "GET",
      `/workspaces/${this.slug()}/projects/`,
    );
  }

  getProject(id: string): Promise<Project> {
    return this.request<Project>(
      "GET",
      `/workspaces/${this.slug()}/projects/${enc(id)}/`,
    );
  }

  // ---------------------------------------------------------------------------
  // States
  // ---------------------------------------------------------------------------

  /** List the workflow states configured for a project. */
  listStates(projectId: string): Promise<State[]> {
    return this.request<State[]>(
      "GET",
      `/workspaces/${this.slug()}/projects/${enc(projectId)}/states/`,
    );
  }

  // ---------------------------------------------------------------------------
  // Work items
  // ---------------------------------------------------------------------------

  async listWorkItems(
    projectId: string,
    params?: ListWorkItemsParams,
  ): Promise<Paginated<WorkItem>> {
    const raw = await this.request<PlaneListResponse<WorkItem>>(
      "GET",
      this.workItemsPath(projectId),
      { query: normalizeQuery(params) },
    );

    // Plane always returns `next_cursor`/`prev_cursor`, so the cursor cannot be
    // used as a has-more signal — rely on the explicit page-results booleans.
    return {
      results: raw.results ?? [],
      nextCursor: raw.next_cursor ?? null,
      prevCursor: raw.prev_cursor ?? null,
      hasMore: raw.next_page_results ?? false,
      hasPrev: raw.prev_page_results ?? false,
      count: raw.count ?? 0,
      totalPages: raw.total_pages ?? 0,
      totalResults: raw.total_results ?? 0,
    };
  }

  getWorkItem(
    projectId: string,
    id: string,
    opts?: FieldSelection,
  ): Promise<WorkItem> {
    return this.request<WorkItem>(
      "GET",
      `${this.workItemsPath(projectId)}${enc(id)}/`,
      { query: normalizeQuery(opts) },
    );
  }

  createWorkItem(
    projectId: string,
    data: CreateWorkItemInput,
  ): Promise<WorkItem> {
    return this.request<WorkItem>("POST", this.workItemsPath(projectId), {
      body: data,
    });
  }

  updateWorkItem(
    projectId: string,
    id: string,
    patch: UpdateWorkItemInput,
  ): Promise<WorkItem> {
    return this.request<WorkItem>(
      "PATCH",
      `${this.workItemsPath(projectId)}${enc(id)}/`,
      { body: patch },
    );
  }

  deleteWorkItem(projectId: string, id: string): Promise<void> {
    return this.request<void>(
      "DELETE",
      `${this.workItemsPath(projectId)}${enc(id)}/`,
    );
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private slug(): string {
    return enc(this.workspaceSlug);
  }

  private workItemsPath(projectId: string): string {
    return `/workspaces/${this.slug()}/projects/${enc(projectId)}/work-items/`;
  }

  private buildUrl(path: string, query?: QueryParams): string {
    let p = path.startsWith("/") ? path : `/${path}`;
    // Plane requires a trailing slash on every endpoint.
    if (!p.endsWith("/")) p += "/";
    const url = `${this.baseUrl}/api/v1${p}`;
    const qs = serializeQuery(query);
    return qs ? `${url}?${qs}` : url;
  }

  private async request<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, opts.query);

    // Auth headers are built per-request and never retained or logged.
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...authHeaders(this.auth),
    };

    const init: { method: string; headers: Record<string, string>; body?: string } = {
      method,
      headers,
    };

    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }

    const res = await this.fetchImpl(url, init);

    if (!res.ok) {
      throw await toPlaneApiError(res);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const text = await res.text();
    return (text ? (JSON.parse(text) as T) : (undefined as T));
  }
}

// -----------------------------------------------------------------------------
// Free helpers
// -----------------------------------------------------------------------------

/** Encode a single path segment (UUIDs are safe, but slugs may not be). */
function enc(segment: string): string {
  return encodeURIComponent(segment);
}

/**
 * Flatten a params object into query-value form, joining array-valued fields
 * (like `fields`/`expand`) into comma-separated strings as Plane expects.
 */
function normalizeQuery(params?: object): QueryParams | undefined {
  if (!params) return undefined;
  const out: QueryParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      out[key] = value.map(String);
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

function serializeQuery(query?: QueryParams): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      sp.append(key, value.join(","));
    } else {
      sp.append(key, String(value));
    }
  }
  return sp.toString();
}

async function toPlaneApiError(res: {
  status: number;
  statusText: string;
  text: () => Promise<string>;
}): Promise<PlaneApiError> {
  let body: unknown;
  let code = String(res.status);
  let message = res.statusText || `HTTP ${res.status}`;

  try {
    const text = await res.text();
    if (text) {
      body = JSON.parse(text);
      if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        if (typeof b.code === "string") code = b.code;
        // Plane / DRF surface messages under varying keys.
        const m = b.detail ?? b.error ?? b.message;
        if (typeof m === "string") message = m;
      }
    }
  } catch {
    // Non-JSON error body — keep status-derived defaults.
  }

  return new PlaneApiError({ status: res.status, code, message, body });
}
