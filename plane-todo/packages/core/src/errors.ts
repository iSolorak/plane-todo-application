/**
 * Typed error thrown for any non-2xx response from the Plane API.
 *
 * `status` is the HTTP status code, `code` is Plane's machine-readable error
 * code when present (falls back to the status), and `message` is a
 * human-readable description.
 */
export class PlaneApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** The parsed response body, when available, for advanced consumers. */
  readonly body: unknown;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    body?: unknown;
  }) {
    super(args.message);
    this.name = "PlaneApiError";
    this.status = args.status;
    this.code = args.code;
    this.body = args.body;
    // Restore prototype chain for downlevel targets (RN/Node with older transpile).
    Object.setPrototypeOf(this, PlaneApiError.prototype);
  }
}

export function isPlaneApiError(err: unknown): err is PlaneApiError {
  return err instanceof PlaneApiError;
}
