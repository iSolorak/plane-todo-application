import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Stack,
  useGlobalSearchParams,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createPlaneClient, PlaneClientProvider } from "../src/data/client";
import { isSetupComplete, useConfig } from "../src/data/config";
import { ConfigProvider } from "../src/native/ConfigProvider";
import { PushProvider } from "../src/native/PushProvider";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ConfigProvider>
          <Gate />
          <StatusBar style="auto" />
        </ConfigProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * Builds the PlaneClient from stored config, kicks off push registration, and
 * keeps the user on /setup until setup is complete.
 */
function Gate() {
  const { config, ready } = useConfig();
  const complete = isSetupComplete(config);

  const client = useMemo(
    () =>
      config && complete
        ? createPlaneClient({
            baseUrl: config.planeBaseUrl,
            workspaceSlug: config.workspaceSlug,
            auth: { type: "apiKey", apiKey: config.planeApiKey },
          })
        : null,
    [complete, config],
  );

  const segments = useSegments();
  const router = useRouter();
  const { edit } = useGlobalSearchParams<{ edit?: string }>();
  useEffect(() => {
    if (!ready) return;
    const inSetup = segments[0] === "setup";
    if (!complete && !inSetup) router.replace("/setup");
    // If setup is already complete, only bounce out of /setup when the user
    // didn't enter it intentionally to edit (Settings → "Edit configuration"
    // passes `?edit=1`). setup.tsx returns to the app on save/cancel.
    else if (complete && inSetup && !edit) router.replace("/(tabs)/today");
  }, [ready, complete, segments, router, edit]);

  return (
    <PushProvider enabled={complete} notifierBaseUrl={config?.notifierBaseUrl}>
      <PlaneClientProvider value={client}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="setup" options={{ title: "Setup" }} />
          <Stack.Screen name="item/[id]" options={{ title: "Item" }} />
          <Stack.Screen
            name="item/new"
            options={{ title: "New item", presentation: "modal" }}
          />
        </Stack>
      </PlaneClientProvider>
    </PushProvider>
  );
}
