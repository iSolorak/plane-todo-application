import type { WorkItem } from "@plane-todo/core";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ItemRow } from "../components/ItemRow";
import { ShowDoneToggle } from "../components/ShowDoneToggle";
import { isDone } from "../data/done";
import { useCompleteItem, useReopenItem } from "../data/useItemMutations";
import { useWorkItems } from "../data/useWorkItems";
import { countDone, filterItems } from "../lib/filterItems";

export interface TodayScreenProps {
  projectId: string;
  onOpenItem: (item: WorkItem) => void;
}

export function TodayScreen({ projectId, onOpenItem }: TodayScreenProps) {
  const [showDone, setShowDone] = useState(false);
  const { data: items = [], isLoading, refetch, isRefetching } = useWorkItems(projectId);
  const complete = useCompleteItem(projectId);
  const reopen = useReopenItem(projectId);

  const visible = useMemo(
    () => filterItems(items, { showDone }),
    [items, showDone],
  );
  const hiddenDone = useMemo(() => countDone(items), [items]);

  const toggleDone = (item: WorkItem) => {
    if (isDone(item)) reopen.mutate(item);
    else complete.mutate(item);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ShowDoneToggle
        value={showDone}
        onValueChange={setShowDone}
        hiddenCount={hiddenDone}
      />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            onPress={onOpenItem}
            onToggleDone={toggleDone}
            busy={
              (complete.isPending && complete.variables?.id === item.id) ||
              (reopen.isPending && reopen.variables?.id === item.id)
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {showDone ? "No items." : "Nothing active. 🎉"}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "#e5e7eb" },
  empty: { textAlign: "center", color: "#6b7280", marginTop: 48 },
});
