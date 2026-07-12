import type { Project, WorkItem } from "@plane-todo/core";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DailyTaskList } from "../../src/components/DailyTaskList";
import { Fab } from "../../src/components/Fab";
import { ErrorState, Loading, Screen } from "../../src/components/ui";
import { toUserFacingError } from "../../src/data/errors";
import { useToggleDone } from "../../src/data/useItemMutations";
import { useProjects } from "../../src/data/useProjects";
import { useAllItems } from "../../src/data/useWorkItems";
import { countDone, filterItems } from "../../src/lib/filterItems";
import { useUnauthorizedRedirect } from "../../src/native/useUnauthorizedRedirect";
import { colors, radii, shadows, spacing, typography } from "../../src/theme";

export default function AllScreen() {
  const router = useRouter();
  const [showDone, setShowDone] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [draftProjectIds, setDraftProjectIds] = useState<string[]>([]);

  // useProjects guarantees `projects` is always a Project[].
  const projectsQuery = useProjects();
  const allProjectIds = useMemo(
    () => projectsQuery.projects.map((project) => project.id),
    [projectsQuery.projects],
  );

  const query = useAllItems(allProjectIds);
  const toggle = useToggleDone();
  useUnauthorizedRedirect(query.error ?? projectsQuery.error);

  const items = query.data ?? [];
  const projectFilteredItems = useMemo(() => {
    if (selectedProjectIds.length === 0) return items;
    const selected = new Set(selectedProjectIds);
    return items.filter((item) => selected.has(item.project_id));
  }, [items, selectedProjectIds]);
  const visible = useMemo(
    () => filterItems(projectFilteredItems, { showDone }),
    [projectFilteredItems, showDone],
  );
  const hiddenDone = countDone(projectFilteredItems);
  const activeFilterCount = selectedProjectIds.length;

  const openItem = (item: WorkItem) =>
    router.push({
      pathname: "/item/[id]",
      params: { id: item.id, projectId: item.project_id },
    });

  const openFilter = () => {
    setDraftProjectIds(selectedProjectIds);
    setFilterOpen(true);
  };
  const applyFilter = () => {
    setSelectedProjectIds(draftProjectIds);
    setFilterOpen(false);
  };
  const clearFilter = () => {
    setDraftProjectIds([]);
    setSelectedProjectIds([]);
    setFilterOpen(false);
  };
  const cancelFilter = () => {
    setDraftProjectIds(selectedProjectIds);
    setFilterOpen(false);
  };

  if (projectsQuery.isPending || query.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (projectsQuery.isError) {
    return (
      <Screen>
        <ErrorState
          message={toUserFacingError(projectsQuery.error).message}
          onRetry={() => projectsQuery.refetch()}
        />
      </Screen>
    );
  }
  if (query.isError) {
    return (
      <Screen>
        <ErrorState
          message={toUserFacingError(query.error).message}
          onRetry={() => query.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <DailyTaskList
        title="Plane Tasks"
        items={visible}
        totalCount={projectFilteredItems.length}
        hiddenDone={hiddenDone}
        showDone={showDone}
        onShowDoneChange={setShowDone}
        refreshing={query.isRefetching}
        onRefresh={() => query.refetch()}
        onPressItem={openItem}
        onToggleDone={(i) => toggle.mutate(i)}
        isItemBusy={(item) => toggle.isPending && toggle.variables?.id === item.id}
        headerAccessory={
          <FilterButton activeCount={activeFilterCount} onPress={openFilter} />
        }
        emptyMessage={
          activeFilterCount
            ? "No tasks match the selected projects."
            : showDone
              ? "No items."
              : "No active items."
        }
        emptyActionLabel={activeFilterCount ? "Clear filters" : undefined}
        onEmptyAction={activeFilterCount ? clearFilter : undefined}
      />
      <Fab onPress={() => router.push("/item/new")} />
      <ProjectFilterModal
        visible={filterOpen}
        projects={projectsQuery.projects}
        draftProjectIds={draftProjectIds}
        onToggleProject={(projectId) =>
          setDraftProjectIds((prev) =>
            prev.includes(projectId)
              ? prev.filter((id) => id !== projectId)
              : [...prev, projectId],
          )
        }
        onApply={applyFilter}
        onClear={clearFilter}
        onCancel={cancelFilter}
      />
    </Screen>
  );
}

function FilterButton({
  activeCount,
  onPress,
}: {
  activeCount: number;
  onPress: () => void;
}) {
  return (
    <View style={styles.filterButtonWrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Filter projects"
        style={({ pressed }) => [
          styles.filterButton,
          activeCount > 0 && styles.filterButtonActive,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.filterButtonText,
            activeCount > 0 && styles.filterButtonTextActive,
          ]}
        >
          {activeCount > 0 ? `Filter · ${activeCount}` : "Filter"}
        </Text>
      </Pressable>
    </View>
  );
}

function ProjectFilterModal({
  visible,
  projects,
  draftProjectIds,
  onToggleProject,
  onApply,
  onClear,
  onCancel,
}: {
  visible: boolean;
  projects: Project[];
  draftProjectIds: string[];
  onToggleProject: (projectId: string) => void;
  onApply: () => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <SafeAreaView style={styles.modalSafeArea} edges={["left", "right", "bottom"]}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>Projects</Text>
                <Text style={styles.modalTitle}>Filter tasks</Text>
              </View>
              <Pressable
                onPress={onCancel}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.projectChips}>
              {projects.map((project) => {
                const selected = draftProjectIds.includes(project.id);
                return (
                  <ProjectChip
                    key={project.id}
                    label={project.name}
                    selected={selected}
                    onPress={() => onToggleProject(project.id)}
                  />
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={onClear}
                accessibilityRole="button"
                accessibilityLabel="Clear project filters"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel project filters"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onApply}
                accessibilityRole="button"
                accessibilityLabel="Apply project filters"
                style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function ProjectChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.projectChip,
        selected && styles.projectChipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.projectChipText, selected && styles.projectChipTextSelected]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterButtonWrap: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  filterButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  filterButtonActive: {
    backgroundColor: colors.cardBlue,
    borderColor: colors.blue,
  },
  filterButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "900",
  },
  filterButtonTextActive: {
    color: colors.blueDark,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(37, 34, 31, 0.28)",
  },
  modalSafeArea: {
    width: "100%",
  },
  modalCard: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.float,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  modalKicker: {
    ...typography.caption,
    color: colors.orangeDark,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  modalTitle: {
    ...typography.heading,
    color: colors.ink,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
  },
  projectChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  projectChip: {
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectChipSelected: {
    backgroundColor: colors.cardBlue,
    borderColor: colors.blue,
  },
  projectChipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "800",
  },
  projectChipTextSelected: {
    color: colors.blueDark,
    fontWeight: "900",
  },
  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  secondaryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "900",
  },
  applyButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.orange,
  },
  applyButtonText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
