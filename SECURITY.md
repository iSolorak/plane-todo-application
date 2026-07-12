# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities **privately** — do **not** open a public
GitHub issue.

- Preferred: GitHub's **[Private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)**
  ("Report a vulnerability" under the repository's **Security** tab).
- Include steps to reproduce, affected package(s)/versions, and any relevant
  logs — with secrets redacted.

We aim to acknowledge reports within a few business days.

## How credentials are handled

- **API keys and tokens are user-supplied at runtime and are never stored in
  this repository.**
  - **Mobile app:** you enter your Plane base URL, workspace slug, and API key
    on the in-app setup screen; they are stored in the device keychain via
    `expo-secure-store` — never in source or in the repo.
  - **Notifier service:** configuration comes from environment variables (see
    [`apps/notifier/.env.example`](plane-todo/apps/notifier/.env.example)). Your
    real `.env` is gitignored.
- Errors are sanitized so raw server messages (which could contain a key or
  token) are never surfaced to the user or logs.
- The webhook endpoint verifies Plane's shared-secret signature; the raw body,
  headers, and secret are never logged.

## Never commit secrets

Never commit a real `.env`, API key, token, webhook secret, EAS project ID, or
the URL/slug of a private Plane instance. Only `*.example` files are tracked.
See [`.gitignore`](.gitignore).

If a secret is ever committed, **revoke/rotate it immediately** at the provider
(e.g. regenerate the Plane API key). Rotation is the only reliable remedy — a
leaked value must be treated as compromised even after history is rewritten.

## Supported versions

This project is pre-1.0. Security fixes are applied to the latest `main`.
