/**
 * Authentication strategies for the Plane API, modeled as a discriminated
 * union so the correct credential shape is required for each type.
 */
export type PlaneAuth =
  | { type: "apiKey"; apiKey: string }
  | { type: "oauth"; accessToken: string };

/**
 * Build the auth header(s) for a single request. Called per-request so
 * credentials are never stored on the request object longer than needed and
 * are never logged. Returns a fresh object each call.
 */
export function authHeaders(auth: PlaneAuth): Record<string, string> {
  switch (auth.type) {
    case "apiKey":
      return { "X-API-Key": auth.apiKey };
    case "oauth":
      return { Authorization: `Bearer ${auth.accessToken}` };
    default: {
      // Exhaustiveness guard: if a new auth type is added this fails to compile.
      const _never: never = auth;
      throw new Error(
        `Unsupported auth type: ${String((_never as { type?: unknown }).type)}`,
      );
    }
  }
}
