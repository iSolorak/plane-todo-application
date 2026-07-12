import type { WorkItem } from "@plane-todo/core";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { getExpandedState, isDone } from "../data/done";
import { PRIORITY_COLOR, priorityLabel } from "../lib/priority";
import { toPreview } from "../lib/sanitizeHtml";
import { colors, radii, shadows, typography } from "../theme";
import { TaskIllustration } from "./TaskIllustration";

export interface ItemRowProps {
  item: WorkItem;
  onPress: (item: WorkItem) => void;
  onToggleDone: (item: WorkItem) => void;
  busy?: boolean;
  current?: boolean;
}

export function ItemRow({
  item,
  onPress,
  onToggleDone,
  busy,
  current,
}: ItemRowProps) {
  const { width } = useWindowDimensions();
  const done = isDone(item);
  const preview = toPreview(item.description_html, 100);
  const title = item.name?.trim() || "Untitled task";
  const priority = item.priority ?? "none";
  const state = getExpandedState(item);
  const stateLabel = state?.name?.trim() || (done ? "Done" : current ? "Now" : "Task");
  const dateLabel = item.target_date ? item.target_date.slice(5, 10) : "No date";
  const priorityColor = PRIORITY_COLOR[priority] ?? colors.faint;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        width < 360 && styles.cardCompact,
        done && styles.cardDone,
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
    >
      <View style={styles.main}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={done ? `Reopen ${title}` : `Complete ${title}`}
            accessibilityState={{ checked: done, busy }}
            hitSlop={10}
            disabled={busy}
            onPress={() => onToggleDone(item)}
            style={[styles.checkbox, done && styles.checkboxDone]}
          >
            <Text style={styles.checkboxMark}>{done ? "✓" : ""}</Text>
          </Pressable>

          <View style={styles.titleWrap}>
            <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
              {title}
            </Text>
          </View>
        </View>

        <Text style={preview ? styles.preview : styles.previewEmpty} numberOfLines={2}>
          {preview || "No description yet."}
        </Text>

        <View style={styles.metaRow}>
          <View style={[styles.statusPill, current && styles.statusPillCurrent]}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: done
                    ? colors.green
                    : current
                      ? colors.orange
                      : colors.faint,
                },
              ]}
            />
            <Text style={styles.statusText} numberOfLines={1}>
              {stateLabel}
            </Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaText} numberOfLines={1}>
              {dateLabel}
            </Text>
          </View>
          {priority !== "none" ? (
            <View style={styles.metaPill}>
              <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
              <Text style={styles.metaText} numberOfLines={1}>
                {priorityLabel(priority)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {width >= 340 ? (
        <TaskIllustration
          status={state?.group ?? stateLabel}
          priority={priority}
          completed={done}
          size="small"
          variant={priority === "urgent" || priority === "high" ? "orbit" : "stack"}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardCompact: {
    padding: 16,
    gap: 10,
  },
  cardDone: {
    opacity: 0.86,
    backgroundColor: colors.surface,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.faint,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxDone: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "900",
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
    lineHeight: 25,
  },
  titleDone: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  preview: {
    ...typography.body,
    color: colors.muted,
  },
  previewEmpty: {
    ...typography.body,
    color: colors.faint,
    fontStyle: "italic",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceWarm,
  },
  statusPillCurrent: {
    backgroundColor: colors.cardPeach,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
    maxWidth: 108,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 112,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: "700",
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
