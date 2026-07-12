export type PushStatus =
  | "disabled" // no notifier configured
  | "registering"
  | "registered"
  | "denied" // permission not granted
  | "error";

export interface PushState {
  status: PushStatus;
  token: string | null;
}
