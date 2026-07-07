import type { WorkItem } from "@plane-todo/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { DEFAULT_PROJECT_ID, resolveClientOptions } from "./src/config";
import { createPlaneClient, PlaneClientProvider } from "./src/data/client";
import { ItemDetailScreen } from "./src/screens/ItemDetailScreen";
import { TodayScreen } from "./src/screens/TodayScreen";

const queryClient = new QueryClient();

export default function App() {
  const client = useMemo(() => createPlaneClient(resolveClientOptions()), []);
  const [selected, setSelected] = useState<WorkItem | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <PlaneClientProvider value={client}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            {selected ? (
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <Text style={styles.back}>‹ Back</Text>
              </Pressable>
            ) : (
              <Text style={styles.h1}>Today</Text>
            )}
          </View>

          {selected ? (
            <ItemDetailScreen item={selected} />
          ) : (
            <TodayScreen
              projectId={DEFAULT_PROJECT_ID}
              onOpenItem={setSelected}
            />
          )}
          <StatusBar style="auto" />
        </SafeAreaView>
      </PlaneClientProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "white" },
  header: {
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  h1: { fontSize: 20, fontWeight: "700", color: "#111827" },
  back: { fontSize: 16, color: "#2563eb" },
});
