import { createContext, useContext } from "react";

/**
 * User-provided configuration for a single-user self-hosted setup. Persisted in
 * expo-secure-store (see src/native/secureConfig). The API key is a secret —
 * never log it or show it in error UI.
 */
export interface AppConfig {
  planeBaseUrl: string;
  workspaceSlug: string;
  planeApiKey: string;
  /** Optional: base URL of the notifier service (push registration + config). */
  notifierBaseUrl?: string;
  /** Optional: project shown first on Today / used for the All tab. */
  defaultProjectId?: string;
}

export type ConfigDraft = Partial<AppConfig>;

/** The three fields required before the app can talk to Plane. */
export function isSetupComplete(cfg: ConfigDraft | null | undefined): cfg is AppConfig {
  return (
    !!cfg &&
    !!cfg.planeBaseUrl?.trim() &&
    !!cfg.workspaceSlug?.trim() &&
    !!cfg.planeApiKey?.trim()
  );
}

/** Basic per-field validation for the setup form (before hitting the network). */
export function configFieldErrors(
  draft: ConfigDraft,
): Partial<Record<keyof AppConfig, string>> {
  const errors: Partial<Record<keyof AppConfig, string>> = {};

  const base = draft.planeBaseUrl?.trim();
  if (!base) errors.planeBaseUrl = "Required";
  else if (!/^https?:\/\/.+/i.test(base))
    errors.planeBaseUrl = "Must start with http:// or https://";

  if (!draft.workspaceSlug?.trim()) errors.workspaceSlug = "Required";
  if (!draft.planeApiKey?.trim()) errors.planeApiKey = "Required";

  const notifier = draft.notifierBaseUrl?.trim();
  if (notifier && !/^https?:\/\/.+/i.test(notifier))
    errors.notifierBaseUrl = "Must start with http:// or https://";

  return errors;
}

/** Normalize a draft into a stored config (trim, drop empty optionals). */
export function normalizeConfig(draft: ConfigDraft): AppConfig {
  const clean = (v?: string) => v?.trim() || undefined;
  return {
    planeBaseUrl: clean(draft.planeBaseUrl) ?? "",
    workspaceSlug: clean(draft.workspaceSlug) ?? "",
    planeApiKey: draft.planeApiKey?.trim() ?? "",
    notifierBaseUrl: clean(draft.notifierBaseUrl),
    defaultProjectId: clean(draft.defaultProjectId),
  };
}

export interface ConfigContextValue {
  /** Loaded config, or null when setup is incomplete / not yet loaded. */
  config: AppConfig | null;
  /** True once secure-store has been read (avoids a setup flash on launch). */
  ready: boolean;
  save: (next: AppConfig) => Promise<void>;
  clear: () => Promise<void>;
}

export const ConfigContext = createContext<ConfigContextValue | null>(null);

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within a <ConfigProvider>.");
  return ctx;
}
