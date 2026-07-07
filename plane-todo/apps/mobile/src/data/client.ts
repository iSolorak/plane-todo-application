import { PlaneClient, type PlaneClientOptions } from "@plane-todo/core";
import { createContext, useContext } from "react";

export function createPlaneClient(options: PlaneClientOptions): PlaneClient {
  return new PlaneClient(options);
}

const PlaneClientContext = createContext<PlaneClient | null>(null);

/** Provider component to make a configured PlaneClient available to hooks. */
export const PlaneClientProvider = PlaneClientContext.Provider;

export function usePlaneClient(): PlaneClient {
  const client = useContext(PlaneClientContext);
  if (!client) {
    throw new Error(
      "usePlaneClient must be used within a <PlaneClientProvider>.",
    );
  }
  return client;
}
