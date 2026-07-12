import { useEffect, useState } from "react";
import type { PushState } from "../data/pushTypes";
import {
  ensureAndroidChannel,
  getExpoPushToken,
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
  });

  useEffect(() => {
    if (!enabled || !notifierBaseUrl) {
      setState({ status: "disabled", token: null });
      return;
    }

    let cancelled = false;
    const run = async () => {
      setState((prev) => ({ ...prev, status: "registering" }));
      try {
        await ensureAndroidChannel();
        const permission = await requestPermission();
        if (permission !== "granted") {
          if (!cancelled) setState({ status: "denied", token: null });
          return;
        }
        const token = await getExpoPushToken();
        if (!token) {
          if (!cancelled) setState({ status: "error", token: null });
          return;
        }
        const previouslyRegistered = await loadRegisteredPushToken();
        if (token !== previouslyRegistered) {
          await postTokenToNotifier(notifierBaseUrl, token);
          await saveRegisteredPushToken(token);
        }
        if (!cancelled) setState({ status: "registered", token });
      } catch {
        // Best-effort: never crash the app over push registration.
        if (!cancelled) setState({ status: "error", token: null });
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [enabled, notifierBaseUrl]);

  return state;
}
