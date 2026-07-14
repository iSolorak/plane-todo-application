import { useEffect, useState } from "react";
import type { PushState } from "../data/pushTypes";
import {
  ensureAndroidChannel,
  getExpoPushToken,
  isRemotePushSupported,
  postTokenToNotifier,
  requestPermission,
} from "./push";
import {
  loadRegisteredPushToken,
  saveRegisteredPushToken,
} from "./secureConfig";

/**
 * Registers this device's Expo push token with the notifier when enabled and a
 * notifier base URL is set. Re-POSTs only when the token changes. Permission
 * denial is surfaced as status (shown in Settings) — never re-prompted here.
 */
export function usePushRegistration(
  enabled: boolean,
  notifierBaseUrl: string | undefined,
): PushState {
  const [state, setState] = useState<PushState>({
    status: "disabled",
    token: null,
    errorMessage: null,
  });

  useEffect(() => {
    if (!enabled || !notifierBaseUrl) {
      setState({ status: "disabled", token: null, errorMessage: null });
      return;
    }

    // Expo Go can't do remote push — skip registration entirely so the
    // push-token APIs (which log the "removed from Expo Go" error) never run.
    if (!isRemotePushSupported()) {
      setState({ status: "unsupported", token: null, errorMessage: null });
      return;
    }

    let cancelled = false;
    const run = async () => {
      setState((prev) => ({ ...prev, status: "registering", errorMessage: null }));
      try {
        await ensureAndroidChannel();
        const permission = await requestPermission();
        if (permission !== "granted") {
          if (!cancelled)
            setState({ status: "denied", token: null, errorMessage: null });
          return;
        }
        const token = await getExpoPushToken();
        if (!token) {
          if (!cancelled)
            setState({
              status: "error",
              token: null,
              errorMessage: "Expo returned no push token.",
            });
          return;
        }
        const previouslyRegistered = await loadRegisteredPushToken();
        if (token !== previouslyRegistered) {
          await postTokenToNotifier(notifierBaseUrl, token);
          await saveRegisteredPushToken(token);
        }
        if (!cancelled)
          setState({ status: "registered", token, errorMessage: null });
      } catch (err) {
        // Best-effort: never crash the app over push registration, but surface
        // the reason to Settings so the user can act on it.
        console.warn("[push] registration failed:", err);
        if (!cancelled)
          setState({
            status: "error",
            token: null,
            errorMessage: describeError(err),
          });
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [enabled, notifierBaseUrl]);

  return state;
}

function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "Unknown error.";
}
