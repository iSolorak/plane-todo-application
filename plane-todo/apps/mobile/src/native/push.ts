import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type PushPermission = "granted" | "denied" | "undetermined";

// Foreground handler: show a banner even when the app is open.
// SDK 54's expo-notifications replaced `shouldShowAlert` with the more granular
// `shouldShowBanner` + `shouldShowList` presentation flags.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Request notification permission, respecting a prior hard denial (no nag). */
export async function requestPermission(): Promise<PushPermission> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  if (!current.canAskAgain) return "denied";
  const requested = await Notifications.requestPermissionsAsync();
  if (requested.granted) return "granted";
  return requested.canAskAgain ? "undetermined" : "denied";
}

/** Fetch the Expo push token, using the EAS projectId from app config. */
export async function getExpoPushToken(): Promise<string | null> {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  // In Expo Go a projectId is REQUIRED to obtain an Expo push token; without it
  // getExpoPushTokenAsync throws. Resolve from app config (set EAS_PROJECT_ID,
  // e.g. via `eas init`) or the classic easConfig fallback.
  const projectId =
    extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) {
    throw new Error(
      "Missing EAS projectId — set EAS_PROJECT_ID (run `eas init`) so push tokens can be issued.",
    );
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data ?? null;
}

export async function postTokenToNotifier(
  baseUrl: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/devices`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error(`notifier /devices responded ${res.status}`);
  }
}
