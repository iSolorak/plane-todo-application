import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type PushPermission = "granted" | "denied" | "undetermined";

// Foreground handler: show a banner even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
  const projectId = extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
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
