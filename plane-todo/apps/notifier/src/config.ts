import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface SmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  to?: string;
}

export interface AppEnv {
  planeBaseUrl: string;
  planeWorkspaceSlug: string;
  planeApiKey: string;
  planeProjectIds: string[];
  planeWebhookSecret: string;
  smtp: SmtpConfig;
  tz: string;
  port: number;
  dbPath: string;
  configPath: string;
}

export interface Offset {
  key: string;
  minutesBefore: number;
}

export interface DigestConfig {
  enabled: boolean;
  /** "HH:mm" in `tz`. */
  time: string;
  tz: string;
}

export interface ReminderConfig {
  offsets: Offset[];
  digest: DigestConfig;
  /**
   * Bounded catch-up threshold (minutes). A missed offset still fires once as
   * long as the deadline is at least this far away; if it's closer, the offset
   * is dropped as noise (the digest / imminence covers it). Defaults to 30.
   */
  minCatchupMinutes: number;
}

const REQUIRED = [
  "PLANE_BASE_URL",
  "PLANE_WORKSPACE_SLUG",
  "PLANE_API_KEY",
  "PLANE_PROJECT_IDS",
  "PLANE_WEBHOOK_SECRET",
] as const;

/**
 * Read and validate environment variables. Throws a single clear error listing
 * every missing required variable (fail fast on boot). SMTP vars are optional —
 * email delivery is skipped cleanly when they are absent.
 */
export function loadEnv(
  source: NodeJS.ProcessEnv = process.env,
): AppEnv {
  const missing = REQUIRED.filter((k) => !source[k] || source[k]!.trim() === "");
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `See .env.example for the full list.`,
    );
  }

  const projectIds = (source.PLANE_PROJECT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (projectIds.length === 0) {
    throw new Error(
      "PLANE_PROJECT_IDS must contain at least one project id (comma-separated).",
    );
  }

  const port = source.PORT ? Number(source.PORT) : 3005;
  if (!Number.isFinite(port)) {
    throw new Error(`PORT is not a valid number: ${source.PORT}`);
  }

  const smtpPort = source.SMTP_PORT ? Number(source.SMTP_PORT) : undefined;
  if (source.SMTP_PORT && !Number.isFinite(smtpPort)) {
    throw new Error(`SMTP_PORT is not a valid number: ${source.SMTP_PORT}`);
  }

  return {
    planeBaseUrl: source.PLANE_BASE_URL!.replace(/\/+$/, ""),
    planeWorkspaceSlug: source.PLANE_WORKSPACE_SLUG!,
    planeApiKey: source.PLANE_API_KEY!,
    planeProjectIds: projectIds,
    planeWebhookSecret: source.PLANE_WEBHOOK_SECRET!,
    smtp: {
      host: emptyToUndef(source.SMTP_HOST),
      port: smtpPort,
      user: emptyToUndef(source.SMTP_USER),
      pass: emptyToUndef(source.SMTP_PASS),
      from: emptyToUndef(source.SMTP_FROM),
      to: emptyToUndef(source.SMTP_TO),
    },
    tz: emptyToUndef(source.TZ) ?? "UTC",
    port,
    dbPath: emptyToUndef(source.DB_PATH) ?? "./data/notifier.db",
    configPath: emptyToUndef(source.CONFIG_PATH) ?? "./config.json",
  };
}

/** Load and normalize the reminder-offset config file. */
export function loadReminderConfig(path: string): ReminderConfig {
  const raw = JSON.parse(readFileSync(resolve(path), "utf8")) as Partial<ReminderConfig>;

  const offsets = Array.isArray(raw.offsets) ? raw.offsets : [];
  for (const o of offsets) {
    if (typeof o.key !== "string" || typeof o.minutesBefore !== "number") {
      throw new Error(
        `Invalid offset in ${path}: each entry needs { key: string, minutesBefore: number }.`,
      );
    }
  }

  const digest: DigestConfig = {
    enabled: raw.digest?.enabled ?? false,
    time: raw.digest?.time ?? "08:00",
    tz: raw.digest?.tz ?? "UTC",
  };

  return {
    offsets,
    digest,
    minCatchupMinutes:
      typeof raw.minCatchupMinutes === "number" ? raw.minCatchupMinutes : 30,
  };
}

function emptyToUndef(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}
