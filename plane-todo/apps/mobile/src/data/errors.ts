import { isPlaneApiError, type PlaneApiError } from "@plane-todo/core";

export interface UserFacingError {
  message: string;
  /** True for 401 — the caller should route to /setup ("API key invalid"). */
  unauthorized: boolean;
}

/**
 * Map any thrown error into a safe, user-facing message. Deliberately
 * status-driven (never echoes raw server text) so the API key or other secrets
 * can never leak into the UI.
 */
export function toUserFacingError(err: unknown): UserFacingError {
  if (isPlaneApiError(err)) {
    return { message: messageForStatus(err), unauthorized: err.status === 401 };
  }
  if (isLikelyNetworkError(err)) {
    return {
      message: "Can't reach Plane — check your connection and the base URL.",
      unauthorized: false,
    };
  }
  return { message: "Something went wrong. Please try again.", unauthorized: false };
}

export function isUnauthorized(err: unknown): boolean {
  return isPlaneApiError(err) && err.status === 401;
}

function messageForStatus(err: PlaneApiError): string {
  if (err.status === 401) return "API key invalid.";
  if (err.status === 403) return "You don't have access to this resource.";
  if (err.status === 404) return "Not found.";
  if (err.status === 429) return "Too many requests — try again shortly.";
  if (err.status >= 500) return "Plane server error — try again later.";
  return "Request failed. Please check your setup.";
}

function isLikelyNetworkError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /network request failed|failed to fetch|network error|timeout/i.test(
      err.message,
    )
  );
}
