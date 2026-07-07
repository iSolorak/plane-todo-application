import Fastify, { type FastifyInstance } from "fastify";
import type { AppEnv } from "./config.js";
import type { Store } from "./db.js";
import { registerDebugRoutes } from "./routes/debug.js";
import { registerDeviceRoutes } from "./routes/devices.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerWebhookRoute } from "./routes/webhooks.js";
import { LruSet } from "./webhook/dedup.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Exact bytes of the request body, captured before JSON parsing. */
    rawBody?: Buffer;
  }
}

export interface ServerDeps {
  store: Store;
  env: AppEnv;
  /** Overridable for tests. Defaults to an LRU of the last 500 delivery ids. */
  deliveryDedup?: LruSet;
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  // Capture the raw body Buffer AND parse JSON, so the webhook route can verify
  // the HMAC over the exact received bytes. Applies to all application/json.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      const buf = body as Buffer;
      req.rawBody = buf;
      if (buf.length === 0) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(buf.toString("utf8")));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  const dedup = deps.deliveryDedup ?? new LruSet(500);

  registerHealthRoute(app);
  registerWebhookRoute(app, { store: deps.store, env: deps.env, dedup });
  registerDeviceRoutes(app, { store: deps.store });

  // Debug/observability endpoints — never mounted in production.
  if (process.env.NODE_ENV !== "production") {
    registerDebugRoutes(app, { store: deps.store });
  }

  return app;
}
