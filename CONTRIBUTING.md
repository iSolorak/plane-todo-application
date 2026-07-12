# Contributing

Thanks for your interest in contributing! This covers the workspace layout and
the local development workflow.

## Prerequisites

- **Node 22+** (pnpm 9 requires it). Shipped runtime targets: Node 18+ / React
  Native for `@plane-todo/core`, Node 18+ for the notifier.
- **pnpm 9+** — enable via Corepack:
  ```bash
  corepack enable
  corepack prepare pnpm@9 --activate
  ```

## Workspace layout

The pnpm workspace lives under `plane-todo/`:

```
plane-todo/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   └── core/            # @plane-todo/core — typed Plane REST client (tsup, ESM)
└── apps/
    ├── mobile/          # Expo / React Native app (secrets via expo-secure-store)
    └── notifier/        # Fastify webhook + reminder service (SQLite)
```

## Getting started

```bash
corepack enable
cd plane-todo
pnpm install

# The notifier is the only package that uses environment variables:
cd apps/notifier
cp .env.example .env     # fill in your own values — never commit .env
```

## Common commands

Run from `plane-todo/`:

```bash
pnpm -r build       # build every package
pnpm -r test        # run every package's test suite (vitest)
pnpm -r typecheck   # type-check everywhere (build @plane-todo/core first)
```

Scope to one package with `--filter`:

```bash
pnpm --filter @plane-todo/core test
pnpm --filter notifier dev
pnpm --filter mobile start
```

> Tip: type-checking the apps resolves `@plane-todo/core` from its build
> output, so run `pnpm --filter @plane-todo/core build` once before
> `pnpm -r typecheck`.

## Before opening a pull request

1. `pnpm -r typecheck` passes.
2. `pnpm -r test` passes (add or update tests for your change).
3. `pnpm -r build` succeeds.
4. **No secrets.** Never commit real API keys, tokens, webhook secrets, `.env`
   files, EAS project IDs, or your own Plane instance's URL/slug. Use
   placeholders and the `.env.example` files. Keep `app.json`'s bundle
   identifier and any EAS config generic (`eas init` sets your own locally).

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md). Do
not open a public issue for security problems.
