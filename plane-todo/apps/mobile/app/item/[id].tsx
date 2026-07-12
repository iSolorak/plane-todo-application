import type { Assignee, Label, Priority, WorkItem } from "@plane-todo/core";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateField } from "../../src/components/DateField";
import { PriorityPicker } from "../../src/components/PriorityPicker";
import { TaskIllustration } from "../../src/components/TaskIllustration";
import { TextField } from "../../src/components/TextField";
import { ErrorState, Loading, Screen } from "../../src/components/ui";
import { isSetupComplete, useConfig } from "../../src/data/config";
import { getExpandedState, isDone } from "../../src/data/done";
import { toUserFacingError } from "../../src/data/errors";
import {
  useToggleDone,
  useUpdateWorkItemFields,
} from "../../src/data/useItemMutations";
import { useWorkItem } from "../../src/data/useWorkItem";
import { priorityLabel } from "../../src/lib/priority";
import {
  plainTextToDescriptionHtml,
  sanitizeHtml,
} from "../../src/lib/sanitizeHtml";
import { useUnauthorizedRedirect } from "../../src/native/useUnauthorizedRedirect";
import { colors, radii, shadows, spacing, typography } from "../../src/theme";

export default function ItemRoute() {
  const { id, projectId } = useLocalSearchParams<{
    id: string;
    projectId: string;
  }>();
  const { config, ready } = useConfig();

  if (!ready) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!isSetupComplete(config)) return <Redirect href="/setup" />;
  // Guard only the genuinely-missing cases; a valid id with data still loading
  // is handled by ItemDetail's Loading state, never by this guard.
  if (!id) {
    return (
      <Screen>
        <ErrorState message="Missing item reference." />
      </Screen>
    );
  }
  if (!projectId) {
    return (
      <Screen>
        <ErrorState message="Missing project reference for this item." />
      </Screen>
    );
  }
  return <ItemDetail id={id} projectId={projectId} />;
}

function ItemDetail({ id, projectId }: { id: string; projectId: string }) {
  const { width } = useWindowDimensions();
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const query = useWorkItem(projectId, id);
  const updateFields = useUpdateWorkItemFields(projectId);
  const toggle = useToggleDone();
  useUnauthorizedRedirect(query.error);
  const loadedDescription = sanitizeHtml(query.data?.description_html);

  useEffect(() => {
    if (query.data) setDescriptionDraft(loadedDescription);
  }, [query.data?.id]);

  if (query.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen>
        <ErrorState
          message={toUserFacingError(query.error).message}
          onRetry={() => query.refetch()}
        />
      </Screen>
    );
  }

  const item = query.data;
  const state = getExpandedState(item);
  const done = isDone(item);
  const title = item.name?.trim() || "Untitled task";
  const description = loadedDescription;
  const stateLabel = state?.name?.trim() || (done ? "Done" : "Task");
  const dueLabel = item.target_date ? formatDate(item.target_date) : null;
  const startLabel = item.start_date ? formatDate(item.start_date) : null;
  const assignees = assigneeNames(item);
  const labels = labelNames(item);

  const setPriority = (p: Priority) =>
    updateFields.mutate({ id, patch: { priority: p } });
  const setDate = (d: string | null) =>
    updateFields.mutate({ id, patch: { target_date: d } });
  const saveDescription = () =>
    updateFields.mutate({
      id,
      patch: { description_html: plainTextToDescriptionHtml(descriptionDraft) },
    }, {
      onSuccess: () => setEditingDescription(false),
    });
  const descriptionChanged = descriptionDraft.trim() !== description.trim();
  const startEditingDescription = () => {
    setDescriptionDraft(description);
    setEditingDescription(true);
  };
  const cancelDescriptionEdit = () => {
    setDescriptionDraft(description);
    setEditingDescription(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          title: `#${item.sequence_id}`,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.orangeDark,
          headerBackTitle: "Tasks",
          headerTitleStyle: { color: colors.ink, fontWeight: "900" },
        }}
      />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={[styles.heroTop, width < 380 && styles.heroTopCompact]}>
            <View style={styles.heroText}>
              <Text style={styles.eyebrow}>Task #{item.sequence_id || "new"}</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            {width >= 340 ? (
              <TaskIllustration
                status={state?.group ?? stateLabel}
                priority={item.priority}
                completed={done}
                size="large"
                variant={done ? "blocks" : "orbit"}
              />
            ) : null}
          </View>

          <View style={styles.pills}>
            <Pill
              label={stateLabel}
              tone={done ? "green" : state?.group === "started" ? "orange" : "neutral"}
            />
            {item.priority !== "none" ? (
              <Pill
                label={priorityLabel(item.priority)}
                tone={
                  item.priority === "urgent" || item.priority === "high"
                    ? "orange"
                    : item.priority === "low"
                      ? "blue"
                      : "yellow"
                }
              />
            ) : null}
            {dueLabel ? <Pill label={dueLabel} tone="blue" /> : null}
            <Pill label={`Project ${shortId(item.project_id)}`} tone="neutral" />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.toggle,
            done ? styles.reopen : styles.complete,
            pressed && styles.pressed,
          ]}
          onPress={() => toggle.mutate(item)}
          disabled={toggle.isPending}
          accessibilityRole="button"
          accessibilityLabel={done ? "Reopen item" : "Mark done"}
        >
          <Text style={[styles.toggleText, done && styles.reopenText]}>
            {done ? "Reopen task" : "Mark complete"}
          </Text>
        </Pressable>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionLabel}>Description</Text>
            {!editingDescription ? (
              <Pressable
                onPress={startEditingDescription}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={description ? "Edit description" : "Add description"}
                style={({ pressed }) => [
                  styles.iconAction,
                  pressed && styles.iconActionPressed,
                ]}
              >
                <Text style={styles.iconActionText}>✎</Text>
              </Pressable>
            ) : null}
          </View>

          {editingDescription ? (
            <>
              <TextField
                label="Description"
                value={descriptionDraft}
                onChangeText={setDescriptionDraft}
                placeholder="Add a description…"
                autoCapitalize="sentences"
                autoCorrect
                multiline
                numberOfLines={6}
                minHeight={132}
              />
              <View style={styles.descriptionActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    updateFields.isPending && styles.buttonDisabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={cancelDescriptionEdit}
                  disabled={updateFields.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel description edit"
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    (!descriptionChanged || updateFields.isPending) &&
                      styles.buttonDisabled,
                    pressed && descriptionChanged && styles.pressed,
                  ]}
                  onPress={saveDescription}
                  disabled={!descriptionChanged || updateFields.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Save description"
                >
                  <Text style={styles.saveButtonText}>
                    {updateFields.isPending ? "Saving…" : "Save"}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable
              onPress={startEditingDescription}
              accessibilityRole="button"
              accessibilityLabel={description ? "Edit description" : "Add description"}
              style={({ pressed }) => [
                styles.descriptionDisplay,
                pressed && styles.descriptionDisplayPressed,
              ]}
            >
              <Text style={description ? styles.body : styles.bodyEmpty}>
                {description || "No description yet"}
              </Text>
              {!description ? (
                <Text style={styles.addDescriptionText}>Add description</Text>
              ) : null}
            </Pressable>
          )}
        </View>

        <Panel title="Status and timing">
          <View style={styles.fieldStack}>
            <InfoRow label="State" value={stateLabel} />
            <InfoRow label="Priority" value={priorityLabel(item.priority)} />
            <InfoRow label="Due" value={dueLabel ?? "No due date"} />
            {startLabel ? <InfoRow label="Start" value={startLabel} /> : null}
          </View>
          <View style={styles.editorBlock}>
            <Text style={styles.editorLabel}>Update priority</Text>
            <PriorityPicker
              value={item.priority}
              onChange={setPriority}
              disabled={updateFields.isPending}
            />
          </View>
          <DateField
            label="Target date"
            value={item.target_date ? item.target_date.slice(0, 10) : null}
            onChange={setDate}
          />
        </Panel>

        <Panel title="Details">
          <View style={styles.fieldStack}>
            <InfoRow label="Project" value={item.project_id} mono />
            <InfoRow label="Created" value={formatDateTime(item.created_at)} />
            <InfoRow label="Updated" value={formatDateTime(item.updated_at)} />
          </View>
        </Panel>

        {assignees.length ? (
          <Panel title="Assignees">
            <View style={styles.chipWrap}>
              {assignees.map((name) => (
                <SoftChip key={name} label={name} />
              ))}
            </View>
          </Panel>
        ) : null}

        {labels.length ? (
          <Panel title="Labels">
            <View style={styles.chipWrap}>
              {labels.map((label) => (
                <SoftChip key={label} label={label} />
              ))}
            </View>
          </Panel>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: "orange" | "green" | "blue" | "yellow" | "neutral";
}) {
  const toneStyle = pillTone[tone];
  return (
    <View style={[styles.pill, toneStyle.container]}>
      <View style={[styles.pillDot, toneStyle.dot]} />
      <Text style={[styles.pillText, toneStyle.text]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.monoValue]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SoftChip({ label }: { label: string }) {
  return (
    <View style={styles.softChip}>
      <Text style={styles.softChipText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function assigneeNames(item: WorkItem): string[] {
  return item.assignees
    .map((assignee) => {
      if (typeof assignee === "string") return shortId(assignee);
      return displayAssignee(assignee);
    })
    .filter((name): name is string => !!name);
}

function displayAssignee(assignee: Assignee): string | null {
  const fullName = [assignee.first_name, assignee.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    assignee.display_name?.trim() ||
    fullName ||
    assignee.email?.trim() ||
    shortId(assignee.id)
  );
}

function labelNames(item: WorkItem): string[] {
  return item.labels
    .map((label) => (typeof label === "string" ? shortId(label) : displayLabel(label)))
    .filter((label): label is string => !!label);
}

function displayLabel(label: Label): string | null {
  return label.name?.trim() || shortId(label.id);
}

function shortId(value?: string): string {
  return value ? value.slice(0, 8) : "Unknown";
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const pillTone = {
  orange: {
    container: { backgroundColor: colors.cardPeach },
    dot: { backgroundColor: colors.orange },
    text: { color: colors.orangeDark },
  },
  green: {
    container: { backgroundColor: colors.cardGreen },
    dot: { backgroundColor: colors.green },
    text: { color: colors.greenDark },
  },
  blue: {
    container: { backgroundColor: colors.cardBlue },
    dot: { backgroundColor: colors.blue },
    text: { color: colors.blueDark },
  },
  yellow: {
    container: { backgroundColor: colors.cardYellow },
    dot: { backgroundColor: colors.yellow },
    text: { color: colors.text },
  },
  neutral: {
    container: { backgroundColor: colors.surfaceWarm },
    dot: { backgroundColor: colors.faint },
    text: { color: colors.text },
  },
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 56,
    gap: spacing.lg,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  heroCard: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  heroTopCompact: {
    alignItems: "flex-start",
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.orangeDark,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    ...typography.title,
    fontSize: 30,
    lineHeight: 36,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  pillDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  pillText: {
    ...typography.caption,
    fontWeight: "900",
  },
  toggle: {
    paddingVertical: 16,
    borderRadius: radii.lg,
    alignItems: "center",
    ...shadows.card,
  },
  complete: {
    backgroundColor: colors.green,
  },
  reopen: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  toggleText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 16,
  },
  reopenText: {
    color: colors.ink,
  },
  panel: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  bodyEmpty: {
    ...typography.body,
    color: colors.muted,
    fontStyle: "italic",
  },
  descriptionDisplay: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  descriptionDisplayPressed: {
    opacity: 0.75,
  },
  addDescriptionText: {
    ...typography.caption,
    color: colors.orangeDark,
    fontWeight: "900",
  },
  iconAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconActionPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  iconActionText: {
    color: colors.orangeDark,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  fieldStack: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: "800",
    minWidth: 76,
  },
  infoValue: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
    textAlign: "right",
    fontWeight: "700",
  },
  monoValue: {
    fontSize: 12,
    lineHeight: 17,
  },
  editorBlock: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  editorLabel: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: "900",
  },
  descriptionActions: {
    flexDirection: "row",
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
  saveButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.orange,
  },
  saveButtonText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  softChip: {
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  softChipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "800",
  },
});
