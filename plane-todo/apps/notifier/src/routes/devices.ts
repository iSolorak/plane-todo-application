import { Expo } from "expo-server-sdk";
import type { FastifyInstance } from "fastify";
import type { Store } from "../db.js";

export interface DeviceRouteDeps {
  store: Store;
}

interface DeviceBody {
  token?: unknown;
}

export function registerDeviceRoutes(
  app: FastifyInstance,
  deps: DeviceRouteDeps,
): void {
  app.post("/devices", async (req, reply) => {
    const token = (req.body as DeviceBody)?.token;
    if (typeof token !== "string" || !Expo.isExpoPushToken(token)) {
      return reply.code(400).send({ error: "invalid expo push token" });
    }
    deps.store.upsertDevice(token);
    return reply.send({ ok: true });
  });

  app.delete("/devices", async (req, reply) => {
    const token = (req.body as DeviceBody)?.token;
    if (typeof token !== "string" || token.length === 0) {
      return reply.code(400).send({ error: "token required" });
    }
    deps.store.removeDevice(token);
    return reply.send({ ok: true });
  });
}
