export type PushStatus =
  | "disabled" // no notifier configured
  | "registering"
  | "registered"
  | "denied" // permission not granted
  | "unsupported" // running in Expo Go, where remote push is unavailable
  | "error";

export interface PushState {
  status: PushStatus;
  token: string | null;
}
