import type { PlaneAuth, PlaneClientOptions } from "@plane-todo/core";

/**
 * App configuration from Expo public env vars (EXPO_PUBLIC_*). For a real
 * deployment prefer a secure token exchange over shipping an API key in the
 * bundle; the apiKey path here is for self-hosted/single-user convenience.
 */
function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function resolveAuth(): PlaneAuth {
  const token = process.env.EXPO_PUBLIC_PLANE_ACCESS_TOKEN;
  if (token) return { type: "oauth", accessToken: token };
  return { type: "apiKey", apiKey: readEnv("EXPO_PUBLIC_PLANE_API_KEY") };
}

export function resolveClientOptions(): PlaneClientOptions {
  return {
    baseUrl: readEnv("EXPO_PUBLIC_PLANE_BASE_URL"),
    workspaceSlug: readEnv("EXPO_PUBLIC_PLANE_WORKSPACE_SLUG"),
    auth: resolveAuth(),
  };
}

export const DEFAULT_PROJECT_ID =
  process.env.EXPO_PUBLIC_PLANE_PROJECT_ID ?? "";
