import type { ReactElement } from "react";
import type { WorkItem } from "@plane-todo/core";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { isDone } from "../data/done";
import { targetYmd, todayLocalYmd } from "../lib/date";
import { colors, radii, shadows, spacing, TAB_BAR_HEIGHT, typography } from "../theme";

/** Extra room below the tab bar so the last row clears the floating FAB (62px + gaps). */
const FAB_CLEARANCE = 96;
import { ShowDoneToggle } from "./ShowDoneToggle";
import { TaskTimelineItem } from "./TaskTimelineItem";
import { EmptyState } from "./ui";

type ListEntry =
  | { type: "section"; id: string; title: string; count: number }
  | { type: "item"; id: string; item: WorkItem; index: number; isLast: boolean };

interface DailyTaskListProps {
  title: string;
  items: WorkItem[];
  totalCount: number;
  hiddenDone: number;
  showDone: boolean;
  onShowDoneChange: (next: boolean) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onPressItem: (item: WorkItem) => void;
  onToggleDone: (item: WorkItem) => void;
  isItemBusy: (item: WorkItem) => boolean;
  emptyMessage: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  headerAccessory?: ReactElement | null;
  footer?: ReactElement | null;
  onEndReached?: () => void;
}

export function DailyTaskList({
  title,
  items,
  totalCount,
  hiddenDone,
  showDone,
  onShowDoneChange,
  refreshing,
  onRefresh,
  onPressItem,
  onToggleDone,
  isItemBusy,
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
  headerAccessory,
  footer,
  onEndReached,
}: DailyTaskListProps) {
  const activeCount = Math.max(totalCount - hiddenDone, 0);
  const progress =
    totalCount > 0 ? Math.round((hiddenDone / totalCount) * 100) : 0;
  const entries = buildEntries(items);
  const insets = useSafeAreaInsets();
  // Clear the absolute tab bar (+ its safe-area inset) AND the floating FAB
  // that sits above it, so the last row is never hidden behind either.
  const listPaddingBottom = TAB_BAR_HEIGHT + insets.bottom + FAB_CLEARANCE;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: listPaddingBottom },
          entries.length === 0 && styles.emptyList,
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.kicker}>Plane Todo</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {activeCount} active · {hiddenDone} complete · {progress}% done
              </Text>
            </View>
            <View style={styles.progressCard}>
              <View style={styles.progressCopy}>
                <Text style={styles.progressTitle}>Start your day</Text>
                <Text style={styles.progressText} numberOfLines={2}>
                  {items.length
                    ? `${items.length} task${items.length === 1 ? "" : "s"} in this flow`
                    : "A clear list for the next thing that matters"}
                </Text>
              </View>
              <View style={styles.progressRing}>
                <Text style={styles.progressNumber}>{progress}%</Text>
              </View>
            </View>
            {headerAccessory}
            <ShowDoneToggle
              value={showDone}
              onValueChange={onShowDoneChange}
              hiddenCount={hiddenDone}
            />
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.orange}
            colors={[colors.orange]}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
        renderItem={({ item }) =>
          item.type === "section" ? (
            <SectionHeader title={item.title} count={item.count} />
          ) : (
            <TaskTimelineItem
              item={item.item}
              index={item.index}
              isLast={item.isLast}
              onPress={onPressItem}
              onToggleDone={onToggleDone}
              busy={isItemBusy(item.item)}
            />
          )
        }
        ListFooterComponent={footer ?? null}
        ListEmptyComponent={
          <EmptyState
            message={emptyMessage}
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

function buildEntries(items: WorkItem[]): ListEntry[] {
  const today = todayLocalYmd();
  const hasDates = items.some((item) => targetYmd(item));
  const groups = hasDates
    ? [
        {
          id: "today",
          title: "Today",
          items: items.filter((item) => !isDone(item) && dateBucket(item, today) === "today"),
        },
        {
          id: "upcoming",
          title: "Upcoming",
          items: items.filter(
            (item) => !isDone(item) && dateBucket(item, today) === "upcoming",
          ),
        },
        {
          id: "focus-now",
          title: "Focus now",
          items: items.filter((item) => !isDone(item) && dateBucket(item, today) === "none"),
        },
        {
          id: "completed",
          title: "Completed",
          items: items.filter((item) => isDone(item)),
        },
      ]
    : [
        {
          id: "focus-now",
          title: "Focus now",
          items: items.filter((item) => !isDone(item)).slice(0, 1),
        },
        {
          id: "next",
          title: "Next",
          items: items.filter((item) => !isDone(item)).slice(1),
        },
        {
          id: "done",
          title: "Done",
          items: items.filter((item) => isDone(item)),
        },
      ];

  const visibleGroups = groups.filter((group) => group.items.length > 0);
  const taskCount = visibleGroups.reduce((count, group) => count + group.items.length, 0);
  let taskIndex = 0;

  return visibleGroups.flatMap((group) => {
    const section: ListEntry = {
      type: "section",
      id: `section-${group.id}`,
      title: group.title,
      count: group.items.length,
    };
    const taskEntries = group.items.map((item) => {
      const entry: ListEntry = {
        type: "item",
        id: item.id,
        item,
        index: taskIndex,
        isLast: taskIndex === taskCount - 1,
      };
      taskIndex += 1;
      return entry;
    });
    return [section, ...taskEntries];
  });
}

function dateBucket(item: WorkItem, today: string): "today" | "upcoming" | "none" {
  const target = targetYmd(item);
  if (!target) return "none";
  return target <= today ? "today" : "upcoming";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    // paddingBottom is applied dynamically (TAB_BAR_HEIGHT + safe-area inset +
    // FAB clearance) in the component.
  },
  emptyList: {
    flexGrow: 1,
  },
  header: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  kicker: {
    ...typography.caption,
    color: colors.orangeDark,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    ...typography.title,
    fontSize: 34,
    lineHeight: 39,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    fontWeight: "700",
  },
  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
    width: "auto",
    maxWidth: 688,
    alignSelf: "stretch",
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.cardPeach,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  progressCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  progressTitle: {
    ...typography.heading,
    color: colors.ink,
  },
  progressText: {
    ...typography.body,
    color: colors.muted,
  },
  progressRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 8,
    borderColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  progressNumber: {
    color: colors.orangeDark,
    fontSize: 14,
    fontWeight: "900",
  },
  sectionHeader: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 18,
  },
  sectionCount: {
    ...typography.caption,
    color: colors.orangeDark,
    fontWeight: "900",
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
});
