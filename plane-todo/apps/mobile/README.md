# @plane-todo/mobile

Expo / React Native client for Plane work items. Consumes
[`@plane-todo/core`](../../packages/core) for all API access and
[TanStack Query](https://tanstack.com/query) for caching.

## Done toggle & states

- **States are fetched per project and cached aggressively** (`useStates`,
  `staleTime` = 1 hour) — a project's workflow rarely changes.
- **A work item is "done" iff its current state's `group` is `completed` or
  `cancelled`.** Lists are fetched with `expand=state` (`useWorkItems`) so
  `state.group` is available inline — no extra per-item lookup. See
  [`isDone`](src/data/done.ts).
- **Complete** ([`useCompleteItem`](src/data/useItemMutations.ts)) PATCHes the
  item's `state` to the target chosen by
  [`pickCompleteState`](src/data/states.ts): the default `completed` state if
  one is flagged, else the lowest-`sequence` completed state.
- **Reopen** ([`useReopenItem`](src/data/useItemMutations.ts)) PATCHes `state`
  to [`pickReopenState`](src/data/states.ts): the project's default state, else
  the lowest-`sequence` `unstarted` state.
- Both mutations invalidate the work-item query on success.

## Active lists & "Show done"

The Today/All list ([`TodayScreen`](src/screens/TodayScreen.tsx)) hides done
items by default via [`filterItems`](src/lib/filterItems.ts). A **Show done**
toggle ([`ShowDoneToggle`](src/components/ShowDoneToggle.tsx)) flips this and
shows how many are hidden.

## Descriptions (`description_html`)

**v1 does not render raw HTML in React Native.** Plane's `description_html` is
stripped to plain text with a small in-house sanitizer
([`sanitizeHtml`](src/lib/sanitizeHtml.ts)) — tags removed, block boundaries and
`<br>` turned into newlines, entities decoded, whitespace collapsed. Used for
both the list preview (`toPreview`) and the detail view. No
`react-native-render-html` in this pass.

## Configuration

Set via Expo public env vars (e.g. in `.env` / `app.config`):

| Var                              | Notes                                         |
| -------------------------------- | --------------------------------------------- |
| `EXPO_PUBLIC_PLANE_BASE_URL`     | Base URL of your self-hosted Plane            |
| `EXPO_PUBLIC_PLANE_WORKSPACE_SLUG`| Workspace slug                               |
| `EXPO_PUBLIC_PLANE_API_KEY`      | API key (used unless an access token is set)  |
| `EXPO_PUBLIC_PLANE_ACCESS_TOKEN` | Optional OAuth token; takes precedence        |
| `EXPO_PUBLIC_PLANE_PROJECT_ID`   | Project to show on the Today screen           |

## Develop

```bash
pnpm install
pnpm --filter @plane-todo/core build   # mobile consumes the built core types
pnpm --filter @plane-todo/mobile start # expo
```

### Typechecking

- `pnpm --filter @plane-todo/mobile typecheck` — checks the framework-agnostic
  data/logic layer (`src/data`, `src/lib`, tests). This is the default so it
  passes even without the native React Native toolchain installed.
- `pnpm --filter @plane-todo/mobile typecheck:app` — checks the full app,
  including the RN screens (`App.tsx`, `src/screens`, `src/components`).

### Tests

`pnpm --filter @plane-todo/mobile test` runs Vitest over the pure logic: state
selection, done detection, list filtering, and the HTML sanitizer.

> Note: relative imports in this package are **extensionless** (not the `.js`
> convention used by the Node-built `core`/`notifier` packages), because Metro
> does not support importing `.tsx` files via a `.js` specifier.
