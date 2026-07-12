import { createContext, useContext } from "react";
import type { PushState } from "./pushTypes";

export const PushContext = createContext<PushState>({
  status: "disabled",
  token: null,
});

export function usePush(): PushState {
  return useContext(PushContext);
}
