# @plane-todo/core

A small, typed client for the **self-hosted [Plane](https://plane.so) REST API**.
Works on Node 18+ and React Native (uses the platform `fetch`, no Node-only
dependencies). ESM + CJS builds via [tsup](https://tsup.egoist.dev/).

- `baseUrl` is **always injected** — nothing is hardcoded to `api.plane.so`.
- Credentials are attached per-request and never logged.
- Non-2xx responses throw a typed `PlaneApiError { status, code, message }`.
- Cursor pagination is normalized to `{ results, nextCursor, prevCursor, hasMore, hasPrev, count, totalPages, totalResults }`.

## Install

```bash
pnpm add @plane-todo/core
```

## Quick start

### API key auth

Plane personal/workspace API keys are sent via the `X-API-Key` header.

```ts
import { PlaneClient } from "@plane-todo/core";

const client = new PlaneClient({
  baseUrl: "https://plane.your-company.dev", // your self-hosted instance
  workspaceSlug: "acme",
  auth: { type: "apiKey", apiKey: process.env.PLANE_API_KEY! },
});

const projects = await client.listProjects();
```

### OAuth (bearer token) auth

OAuth access tokens are sent via `Authorization: Bearer <token>`.

```ts
import { PlaneClient } from "@plane-todo/core";

const client = new PlaneClient({
  baseUrl: "https://plane.your-company.dev",
  workspaceSlug: "acme",
  auth: { type: "oauth", accessToken: userSession.accessToken },
});
```

The `auth` option is a discriminated union, so TypeScript requires exactly the
right field for each type:

```ts
type PlaneAuth =
  | { type: "apiKey"; apiKey: string }
  | { type: "oauth"; accessToken: string };
```

## Work items

```ts
// List with cursor pagination
let page = await client.listWorkItems(projectId, {
  per_page: 50,
  order_by: "-created_at",
  expand: ["state", "assignees", "labels"],
});

console.log(page.results, page.hasMore, page.totalResults);

// Fetch the next page. `nextCursor` is ALWAYS present in Plane responses
// (format "per_page:page:is_prev"), so page off `hasMore`, not the cursor.
while (page.hasMore) {
  page = await client.listWorkItems(projectId, {
    per_page: 50,
    cursor: page.nextCursor!,
  });
}

// Get one
const item = await client.getWorkItem(projectId, itemId, {
  expand: ["state"],
});

// Create
const created = await client.createWorkItem(projectId, {
  name: "Ship the mobile app",
  priority: "high",
  target_date: "2026-08-01",
});

// Update (PATCH)
await client.updateWorkItem(projectId, created.id, { priority: "urgent" });

// Delete
await client.deleteWorkItem(projectId, created.id);
```

## Projects

```ts
const projects = await client.listProjects();
const project = await client.getProject(projectId);
```

## Error handling

Every non-2xx response throws a `PlaneApiError`:

```ts
import { PlaneClient, PlaneApiError, isPlaneApiError } from "@plane-todo/core";

try {
  await client.getWorkItem(projectId, "does-not-exist");
} catch (err) {
  if (isPlaneApiError(err)) {
    console.error(err.status); // 404
    console.error(err.code); // e.g. "work_item_not_found" (falls back to status)
    console.error(err.message); // human-readable detail from the API
  }
}
```

## API surface

```ts
new PlaneClient({ baseUrl, workspaceSlug, auth, fetch? });

client.listProjects(): Promise<Project[]>;
client.getProject(id): Promise<Project>;

client.listWorkItems(projectId, params?): Promise<Paginated<WorkItem>>;
client.getWorkItem(projectId, id, opts?): Promise<WorkItem>;
client.createWorkItem(projectId, data): Promise<WorkItem>;
client.updateWorkItem(projectId, id, patch): Promise<WorkItem>; // PATCH
client.deleteWorkItem(projectId, id): Promise<void>;
```

### `listWorkItems` params

| Param      | Type                 | Notes                                          |
| ---------- | -------------------- | ---------------------------------------------- |
| `fields`   | `string \| string[]` | Sparse fieldset; arrays are comma-joined.      |
| `expand`   | `string \| string[]` | Expand relations inline; arrays comma-joined.  |
| `per_page` | `number`             | Page size for cursor pagination.               |
| `order_by` | `string`             | e.g. `"created_at"` or `"-created_at"` (desc). |
| `cursor`   | `string`             | Opaque cursor from a previous `next_cursor`.   |

## Custom `fetch`

Pass your own fetch implementation for testing or to route through a proxy:

```ts
const client = new PlaneClient({
  baseUrl,
  workspaceSlug,
  auth,
  fetch: myFetch, // structurally compatible with global fetch
});
```

## Notes on the Plane API

- Every endpoint path receives a **trailing slash** automatically — Plane's
  DRF backend returns a redirect/404 otherwise.
- All paths are built as `${baseUrl}/api/v1/...` and scoped to the configured
  `workspaceSlug`.

## Development

```bash
pnpm install
pnpm --filter @plane-todo/core build
pnpm --filter @plane-todo/core test
```

## License

MIT
