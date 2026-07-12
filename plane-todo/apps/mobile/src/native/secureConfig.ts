import * as SecureStore from "expo-secure-store";
import type { AppConfig } from "../data/config";

const CONFIG_KEY = "plane_todo_config_v1";
const PUSH_TOKEN_KEY = "plane_todo_push_token_v1";

export async function loadConfig(): Promise<AppConfig | null> {
  const raw = await SecureStore.getItemAsync(CONFIG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppConfig;
  } catch {
    return null;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(config));
}

export async function clearConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(CONFIG_KEY);
}

/** Last Expo push token we successfully registered, to avoid redundant POSTs. */
export async function loadRegisteredPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
}

export async function saveRegisteredPushToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
}
