# @plane-todo/notifier

A single-user reminder/notification service for [Plane](https://plane.so) work
items. It receives Plane webhooks, keeps a local SQLite mirror of items that
have a `target_date`, and sends **push** (Expo) + **email** (SMTP) reminders on
a schedule.

- **Node 18+, ESM, [Fastify](https://fastify.dev/).**
- Consumes [`@plane-todo/core`](../../packages/core) for Plane API reads.
- **No auth on the service itself** — it is meant to run on Plane's private
  compose network, reachable only as `http://notifier:3005`.

## Core guarantee: sending happens only in cron

The webhook path **never sends notifications**. It only updates the `reminders`
table. All sending happens in the cron jobs and is guarded by the `sent_log`
table, so each `(work_item_id, offset_key)` fires **at most once**. This is the
idempotency contract — webhooks can be redelivered freely without causing
duplicate notifications.

## How it works

```
Plane ──(webhook: issue created/updated/deleted)──▶ /webhooks/plane
                                                        │ verify HMAC, dedupe
                                                        ▼
                                                 reminders table  (no sending)
                                                        │
   cron every 5 min ── offset reminders ───────────────┤ guarded by sent_log
   cron daily ─────── digest ──────────────────────────┘   → push + email
```

## Endpoints

| Method   | Path              | Body            | Purpose                                          |
| -------- | ----------------- | --------------- | ------------------------------------------------ |
| `POST`   | `/webhooks/plane` | Plane payload   | Verify signature, dedupe, upsert/delete reminder |
| `POST`   | `/devices`        | `{ token }`     | Register an Expo push token                      |
| `DELETE` | `/devices`        | `{ token }`     | Remove an Expo push token                        |
| `GET`    | `/health`         | –               | Liveness check                                   |

## Setting up the Plane webhook

1. In Plane, go to **Workspace Settings → Webhooks → Add webhook**.
2. Set the URL to your notifier's webhook endpoint. On Plane's own compose
   network that is:

   ```
   http://notifier:3005/webhooks/plane
   ```

3. Enable at least the **Issues (work items)** events.
4. Plane generates a **secret**. Copy it into the notifier's
   `PLANE_WEBHOOK_SECRET` env var. The service verifies every request as
   `HMAC-SHA256(rawBody, PLANE_WEBHOOK_SECRET)` (hex) against the
   `X-Plane-Signature` header, using a constant-time comparison. Mismatches get
   a `401`.
5. Redelivered webhooks are deduped by the `X-Plane-Delivery` id (an in-memory
   LRU of the last 500 ids), so retries are safe.

See [`docker-compose.snippet.yml`](./docker-compose.snippet.yml) for how to join
the notifier to Plane's network so `notifier:3005` resolves.

## Environment variables

| Variable               | Required | Default              | Notes                                                    |
| ---------------------- | -------- | -------------------- | -------------------------------------------------------- |
| `PLANE_BASE_URL`       | ✅       | –                    | Base URL of your self-hosted Plane (no `/api`).          |
| `PLANE_WORKSPACE_SLUG` | ✅       | –                    | Workspace slug.                                          |
| `PLANE_API_KEY`        | ✅       | –                    | Plane API key (sent as `X-API-Key`).                     |
| `PLANE_PROJECT_IDS`    | ✅       | –                    | Comma-separated project ids to track.                    |
| `PLANE_WEBHOOK_SECRET` | ✅       | –                    | Shared secret from the Plane webhook config.             |
| `SMTP_HOST`            | –        | –                    | Email disabled unless HOST + FROM + TO are all set.      |
| `SMTP_PORT`            | –        | `587`                | `465` implies TLS.                                        |
| `SMTP_USER`            | –        | –                    | Omit for unauthenticated relays.                         |
| `SMTP_PASS`            | –        | –                    |                                                          |
| `SMTP_FROM`            | –        | –                    | From address.                                            |
| `SMTP_TO`              | –        | –                    | The single recipient (this is a single-user service).    |
| `TZ`                   | –        | `UTC`                | Timezone for the 5-minute offset cron.                   |
| `PORT`                 | –        | `3005`               | Listen port.                                             |
| `DB_PATH`              | –        | `./data/notifier.db` | SQLite file path.                                        |
| `CONFIG_PATH`          | –        | `./config.json`      | Reminder-offset config file.                             |

The service **fails fast on boot** with a clear error listing every missing
required variable.

## How offsets work

Reminder offsets live in [`config.json`](./config.json):

```json
{
  "offsets": [
    { "key": "1d", "minutesBefore": 1440 },
    { "key": "1h", "minutesBefore": 60 }
  ],
  "digest": { "enabled": true, "time": "08:00", "tz": "UTC" },
  "minCatchupMinutes": 30
}
```

- Plane `target_date` is **date-only** (`YYYY-MM-DD`). It is anchored to
  **23:59:59 local time** in `digest.tz` (the end of that day for you), not UTC
  midnight — so the offset is correct for non-UTC users and shifts automatically
  across DST. Call this the `targetInstant`.

- Every **5 minutes**, for each reminder that has a `target_date` and each
  configured offset, the job computes:

  ```
  fireTime = targetInstant − minutesBefore
  ```

  An offset is **eligible** when all of these hold:

  ```
  now >= fireTime                              (offset window opened)
  AND now < targetInstant                      (still before the deadline)
  AND (targetInstant − now) >= minCatchupMinutes   (deadline isn't basically-now)
  AND (work_item_id, offset_key) NOT in sent_log
  ```

  After sending it records the `(work_item_id, offset_key)` pair in `sent_log`,
  so it never fires twice.

  - `key` is an arbitrary label (`"1d"`, `"1h"`, …) — it's the `offset_key`
    used for idempotency, so **don't reuse a key for a different offset**.
  - `minutesBefore` is minutes before the target.
  - **Bounded catch-up**: because eligibility only needs `now >= fireTime` (not
    a narrow window at exactly `fireTime`), a task created *after* an offset's
    fireTime still fires once — as long as the deadline is at least
    `minCatchupMinutes` away. Missed offsets closer than that are dropped as
    noise (firing "1 day before" for something due in 10 minutes helps no one);
    the digest and nearer offsets cover the imminent case. `minCatchupMinutes`
    is a top-level config value, default `30`.

- **Digest**: once daily at `digest.time` in `digest.tz`, all reminders due
  *today* are summarized into **one** push + **one** email. Idempotency uses a
  `sent_log` key of `digest:<YYYY-MM-DD>`, so a restart on the same day won't
  re-send.

## SQLite schema

Migrations run on boot and are idempotent (`CREATE TABLE IF NOT EXISTS`).

```sql
reminders(work_item_id TEXT PK, project_id, name, target_date TEXT, url, dedup_hash, updated_at)
sent_log(work_item_id TEXT, offset_key TEXT, sent_at, PRIMARY KEY(work_item_id, offset_key))
devices(token TEXT PK, added_at)
```

## Develop & run

```bash
pnpm install
pnpm --filter @plane-todo/core build      # notifier consumes the built core
cp apps/notifier/.env.example apps/notifier/.env   # then edit

pnpm --filter @plane-todo/notifier dev     # tsx watch
pnpm --filter @plane-todo/notifier test    # vitest
pnpm --filter @plane-todo/notifier start   # run once
```

## Deploying with Plane

Use [`docker-compose.snippet.yml`](./docker-compose.snippet.yml) to attach the
service to Plane's compose network. Once running, point the Plane webhook at
`http://notifier:3005/webhooks/plane` and paste the generated secret into
`PLANE_WEBHOOK_SECRET`.
