import type { ReactNode } from "react";
import { PushContext } from "../data/pushContext";
import { usePushRegistration } from "./usePushRegistration";

/** Runs push registration once and shares its status via context (Settings). */
export function PushProvider({
  enabled,
  notifierBaseUrl,
  children,
}: {
  enabled: boolean;
  notifierBaseUrl: string | undefined;
  children: ReactNode;
}) {
  const state = usePushRegistration(enabled, notifierBaseUrl);
  return <PushContext.Provider value={state}>{children}</PushContext.Provider>;
}
