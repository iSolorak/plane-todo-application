# plane-todo-application

A simple, friendly **to-do app built on top of a self-hosted
[Plane](https://github.com/makeplane/plane) instance**. Work items live in
Plane; this project adds a clean mobile experience and timely reminders on top
of Plane's REST API and webhooks.

The base URL, workspace, and credentials are **always supplied by you** — no
Plane instance, key, or slug is hardcoded.

## What's in here

This is a [pnpm workspace](https://pnpm.io/workspaces). Everything lives under
[`plane-todo/`](plane-todo):

| Package | What it is |
| --- | --- |
| [`packages/core`](plane-todo/packages/core) — `@plane-todo/core` | Typed TypeScript client for the Plane REST API (API-key or OAuth auth). ESM, runs on Node 18+ and React Native. |
| [`apps/mobile`](plane-todo/apps/mobile) | Expo / React Native app. A tidy to-do UI over your Plane work items. Credentials are entered in-app and stored in the device keychain via `expo-secure-store`. |
| [`apps/notifier`](plane-todo/apps/notifier) | A small Fastify service that receives Plane webhooks and sends reminders (push + optional email). Uses SQLite for local state. |

## Prerequisites

- **Node 22+** (the pnpm version pinned here requires it).
- **[pnpm](https://pnpm.io) 9+** — enable via Corepack: `corepack enable`.
- A reachable **self-hosted Plane** instance, plus an API key (or OAuth token).
- For the mobile app: the [Expo](https://docs.expo.dev/) tooling / Expo Go.

## Setup

```bash
# from the repo root
corepack enable
cd plane-todo
pnpm install

# build / test everything
pnpm -r build
pnpm -r test
```

### Notifier service (`apps/notifier`)

The notifier is the only package that reads environment variables. Copy its
example file and fill in your own values:

```bash
cd plane-todo/apps/notifier
cp .env.example .env      # then edit .env — see the file for each variable
pnpm dev
```

Reminder offsets and the daily digest are configured in
[`apps/notifier/config.json`](plane-todo/apps/notifier/config.json) (times use
the IANA timezone set there / via `TZ`; the default is `UTC`).

### Mobile app (`apps/mobile`)

```bash
cd plane-todo/apps/mobile
pnpm start
```

The mobile app has **no `.env`** — you enter your Plane base URL, workspace
slug, and API key on the in-app setup screen, and they're stored securely on
the device (never written to the repo).

> Building a real binary with EAS? Run `eas init` to attach **your own** Expo
> project — the repo intentionally ships no `extra.eas.projectId`. Update the
> `ios.bundleIdentifier` / `android.package` in
> [`app.json`](plane-todo/apps/mobile/app.json) (currently the placeholder
> `com.example.planetodo`) to your own reverse-DNS id.

## ⚠️ Never commit secrets

- **Never commit your `.env`, API keys, tokens, webhook secrets, or your Plane
  instance URL/slug.** `.env` files are gitignored; only `*.example` files are
  tracked. Credentials are always user-supplied at runtime.
- See [SECURITY.md](SECURITY.md) for how credentials are handled and how to
  report a vulnerability.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workspace layout, install steps,
and how to run tests.

## License

[MIT](LICENSE)
