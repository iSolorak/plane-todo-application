import type { WorkItem } from "@plane-todo/core";
import { StyleSheet, Text, View } from "react-native";
import { isDone } from "../data/done";
import { colors } from "../theme";
import { ItemRow } from "./ItemRow";

export interface TaskTimelineItemProps {
  item: WorkItem;
  index: number;
  isLast: boolean;
  onPress: (item: WorkItem) => void;
  onToggleDone: (item: WorkItem) => void;
  busy?: boolean;
}

export function TaskTimelineItem({
  item,
  index,
  isLast,
  onPress,
  onToggleDone,
  busy,
}: TaskTimelineItemProps) {
  const done = isDone(item);
  const current = !done && index === 0;
  const warmPriority = item.priority === "urgent" || item.priority === "high";

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View
          style={[
            styles.marker,
            done
              ? styles.markerDone
              : current
                ? styles.markerCurrent
                : warmPriority
                  ? styles.markerWarm
                  : null,
          ]}
        >
          {done ? <Text style={styles.check}>✓</Text> : null}
        </View>
        {!isLast ? <View style={styles.dottedRail} /> : null}
      </View>
      <View style={styles.cardWrap}>
        <ItemRow
          item={item}
          onPress={onPress}
          onToggleDone={onToggleDone}
          busy={busy}
          current={current}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  rail: {
    width: 34,
    alignItems: "center",
  },
  marker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.faint,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 34,
    zIndex: 2,
  },
  markerCurrent: {
    borderColor: colors.orange,
    backgroundColor: colors.orange,
  },
  markerWarm: {
    borderColor: colors.orange,
    backgroundColor: colors.cardPeach,
  },
  markerDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: colors.green,
    marginTop: 31,
  },
  check: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "900",
  },
  dottedRail: {
    flex: 1,
    minHeight: 96,
    borderLeftWidth: 2,
    borderStyle: "dotted",
    borderColor: colors.faint,
    marginTop: 6,
  },
  cardWrap: {
    flex: 1,
    paddingBottom: 18,
    minWidth: 0,
  },
});
