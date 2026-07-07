import type { WorkItem } from "@plane-todo/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { isDone } from "../data/done";
import { toPreview } from "../lib/sanitizeHtml";

export interface ItemRowProps {
  item: WorkItem;
  onPress: (item: WorkItem) => void;
  onToggleDone: (item: WorkItem) => void;
  busy?: boolean;
}

export function ItemRow({ item, onPress, onToggleDone, busy }: ItemRowProps) {
  const done = isDone(item);
  const preview = toPreview(item.description_html, 100);

  return (
    <Pressable style={styles.row} onPress={() => onPress(item)}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, busy }}
        hitSlop={8}
        disabled={busy}
        onPress={() => onToggleDone(item)}
        style={[styles.checkbox, done && styles.checkboxDone]}
      >
        <Text style={styles.checkboxMark}>{done ? "✓" : ""}</Text>
      </Pressable>

      <View style={styles.body}>
        <Text
          style={[styles.title, done && styles.titleDone]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {preview ? (
          <Text style={styles.preview} numberOfLines={1}>
            {preview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#9ca3af",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  checkboxMark: { color: "white", fontSize: 15, fontWeight: "700" },
  body: { flex: 1 },
  title: { fontSize: 16, color: "#111827" },
  titleDone: { color: "#9ca3af", textDecorationLine: "line-through" },
  preview: { fontSize: 13, color: "#6b7280", marginTop: 2 },
});
