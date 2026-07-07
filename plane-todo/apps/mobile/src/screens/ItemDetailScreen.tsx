import type { WorkItem } from "@plane-todo/core";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { isDone } from "../data/done";
import { getExpandedState } from "../data/done";
import { sanitizeHtml } from "../lib/sanitizeHtml";

export interface ItemDetailScreenProps {
  item: WorkItem;
}

export function ItemDetailScreen({ item }: ItemDetailScreenProps) {
  // v1: render description as plain text — never raw HTML in RN.
  const description = sanitizeHtml(item.description_html);
  const state = getExpandedState(item);
  const done = isDone(item);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{item.name}</Text>

      <View style={styles.meta}>
        {state ? (
          <Text style={[styles.badge, done && styles.badgeDone]}>
            {state.name}
          </Text>
        ) : null}
        {item.target_date ? (
          <Text style={styles.due}>Due {item.target_date}</Text>
        ) : null}
      </View>

      {description ? (
        <Text style={styles.body}>{description}</Text>
      ) : (
        <Text style={styles.bodyEmpty}>No description.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  meta: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: {
    fontSize: 13,
    color: "#1f2937",
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  badgeDone: { backgroundColor: "#dcfce7", color: "#166534" },
  due: { fontSize: 13, color: "#6b7280" },
  body: { fontSize: 15, lineHeight: 22, color: "#374151" },
  bodyEmpty: { fontSize: 15, color: "#9ca3af", fontStyle: "italic" },
});
