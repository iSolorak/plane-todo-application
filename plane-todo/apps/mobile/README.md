# @plane-todo/mobile

An [Expo](https://expo.dev) / React Native (TypeScript, **expo-router**) client
for [Plane](https://plane.so), for a **single-user self-hosted** setup on iOS +
Android. It talks to:

- **Plane** directly via [`@plane-todo/core`](../../packages/core), and
- **the notifier** ([`../notifier`](../notifier)) only to (a) register a push
  token and (b) read the reminder schedule for display.

There is no backend of its own.

## Configuration & secrets

On first run, **/setup** collects and stores in **expo-secure-store**:

| Field             | Required | Notes                                     |
| ----------------- | -------- | ----------------------------------------- |
| `planeBaseUrl`    | ✅        | e.g. `https://plane.example.com`          |
| `workspaceSlug`   | ✅        |                                           |
| `planeApiKey`     | ✅        | Stored securely; **never logged or shown** |
| `notifierBaseUrl` | –        | Enables push + the reminder view          |
| `defaultProjectId`| –        | Today/All scope to this project if set    |

Setup is validated by a single `listProjects()` call. The `PlaneClient` is built
from these values (`auth: { type: "apiKey", apiKey }`) and provided via React
context. If setup is incomplete the app routes to `/setup`; a **401** from any
request routes back to `/setup` with "API key invalid".

## Screens (expo-router)

```
app/
  _layout.tsx        providers (QueryClient, Config, Push, PlaneClient) + setup gate
  index.tsx          redirect → tabs or /setup
  setup.tsx          config form, validated via listProjects()
  (tabs)/today.tsx   items with target_date <= today across selected projects,
                     sorted by target_date then priority
  (tabs)/all.tsx     paginated; infinite scroll driven by core's hasMore
                     (not next_cursor); pull-to-refresh
  (tabs)/settings.tsx resolved config, push status, read-only notifier schedule
  item/[id].tsx      detail; edit target_date + priority (optimistic PATCH); done toggle
  item/new.tsx       create: name, project, priority, target_date
```

## Done toggle & states

- States are fetched per project via `listStates(projectId)` and cached with a
  long `staleTime` (`useStates`).
- A work item is **done** iff its current state's `group` is `completed` or
  `cancelled`. Lists/detail fetch with `expand=state` so `group` is inline.
- **Complete** → the default `completed` state, else the lowest-`sequence`
  completed state. **Reopen** → the project's default state, else the first
  `unstarted` state. (`pickCompleteState` / `pickReopenState`.)
- Done items are hidden from Today/All by default; a **Show done** toggle
  reveals them.

## Descriptions

`description_html` is **never rendered as raw HTML** in React Native. It is
stripped to plain text (tags removed, entities decoded) for both list previews
and the detail view (`sanitizeHtml`). No `react-native-render-html` in this pass.

## Data layer

All reads/writes go through `@tanstack/react-query` with per-project query keys.
Create and field PATCH (target_date / priority) and the done toggle are
**optimistic**, with snapshot/rollback on error and invalidation on settle
(`src/data/cache.ts`). `PlaneApiError` is mapped to safe, status-based
user-facing messages that never echo raw server text or secrets
(`src/data/errors.ts`).

## Push registration

On launch — when setup is complete **and** `notifierBaseUrl` is set — the app:

1. sets a foreground notification handler,
2. requests notification permission (respecting a prior hard denial — no nag),
3. gets the Expo push token (EAS `projectId` from `app.json` → `extra.eas`),
4. `POST`s it to `{notifierBaseUrl}/devices`, and re-POSTs **only when it
   changes** (last token is stored in secure-store).

Permission denial is surfaced as a status on the **Settings** screen; it is not
re-prompted. Push registration is best-effort and never crashes the app.

> **Expo push tokens require a real dev/prod build — not Expo Go.** In Expo Go
> `getExpoPushTokenAsync` won't return a usable device token. Create a
> development build (`eas build --profile development`) or a production build to
> test push end-to-end. You must also set a real `extra.eas.projectId` in
> `app.json`. End-to-end reminders additionally require the **notifier** to be
> running and reachable at `notifierBaseUrl`, with the token registered.

## Run

```bash
pnpm install
pnpm --filter @plane-todo/core build      # mobile consumes the built core types

pnpm --filter @plane-todo/mobile start     # expo (dev)
pnpm --filter @plane-todo/mobile ios        # or android
```

### Typechecking

- `typecheck` — the framework-agnostic + react-query data layer (`src/data`,
  `src/lib`, tests). Runs without the native RN/Expo toolchain, so it's the
  default used by the monorepo `pnpm -r typecheck`.
- `typecheck:app` — the full app including the RN screens (`app/`,
  `src/components`, `src/native`).

### Tests

`pnpm --filter @plane-todo/mobile test` runs Vitest over the pure logic: state
selection, done detection, date/sort, list filtering, config validation, error
mapping, project selection, and the HTML sanitizer.

## Monorepo notes

- Relative imports here are **extensionless** (Metro doesn't support the
  `.js`-for-`.tsx` convention used by the Node-built `core`/`notifier`).
- [`metro.config.js`](./metro.config.js) watches the workspace root and resolves
  from both app and root `node_modules` for the pnpm layout.
- The Settings "reminder schedule" reads the notifier's read-only
  `GET /config` (added alongside this app); it contains no secrets.
