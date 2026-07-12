import type { Priority, Project } from "@plane-todo/core";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateField } from "../../src/components/DateField";
import { PriorityPicker } from "../../src/components/PriorityPicker";
import { TextField } from "../../src/components/TextField";
import { EmptyState, ErrorState, Loading, Screen } from "../../src/components/ui";
import { isSetupComplete, useConfig } from "../../src/data/config";
import { toUserFacingError } from "../../src/data/errors";
import { selectActiveProjectId } from "../../src/data/projects";
import { useCreateItem } from "../../src/data/useItemMutations";
import { useProjects } from "../../src/data/useProjects";
import { plainTextToDescriptionHtml } from "../../src/lib/sanitizeHtml";
import { useUnauthorizedRedirect } from "../../src/native/useUnauthorizedRedirect";
import { colors, radii, shadows, spacing, typography } from "../../src/theme";

export default function NewItemRoute() {
  const { config, ready } = useConfig();
  if (!ready) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!isSetupComplete(config)) return <Redirect href="/setup" />;
  return <NewItem defaultProjectId={config.defaultProjectId} />;
}

function NewItem({ defaultProjectId }: { defaultProjectId?: string }) {
  const router = useRouter();
  const projectsQuery = useProjects();
  useUnauthorizedRedirect(projectsQuery.error);

  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // useProjects guarantees `projects` is always a Project[] — never undefined,
  // never the paginated wrapper.
  const projects: Project[] = projectsQuery.projects;

  // Default the project selection once the list loads.
  useEffect(() => {
    if (!projectId) {
      const initial = selectActiveProjectId(projects, defaultProjectId);
      if (initial) setProjectId(initial);
    }
  }, [projects, defaultProjectId, projectId]);

  const create = useCreateItem(projectId);
  // Submit stays disabled while projects are pending (no projectId yet).
  const canSubmit =
    name.trim().length > 0 &&
    !!projectId &&
    !create.isPending &&
    !projectsQuery.isPending;

  const onSubmit = () => {
    setError(null);
    create.mutate(
      {
        name: name.trim(),
        description_html: plainTextToDescriptionHtml(description),
        priority,
        target_date: targetDate,
      },
      {
        onSuccess: () => router.back(),
        onError: (err) => setError(toUserFacingError(err).message),
      },
    );
  };

  // Loading state while the projects query is pending — never map before data.
  if (projectsQuery.isPending) {
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
  if (projects.length === 0) {
    return (
      <Screen>
        <EmptyState message="No projects available to create items in." />
      </Screen>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentInsetAdjustmentBehavior="always"
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <View style={styles.card}>
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="What needs doing?"
              autoCapitalize="sentences"
              autoFocus
            />
            <TextField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description…"
              autoCapitalize="sentences"
              autoCorrect
              multiline
              numberOfLines={5}
              minHeight={118}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Project</Text>
            <View style={styles.chips}>
              {projects.map((p) => {
                const selected = p.id === projectId;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setProjectId(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Project ${p.name}`}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text
                      style={[styles.chipText, selected && styles.chipTextSelected]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Priority</Text>
            <PriorityPicker value={priority} onChange={setPriority} />
          </View>

          <View style={styles.card}>
            <DateField label="Target date" value={targetDate} onChange={setTargetDate} />
          </View>

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Create item"
          >
            <Text style={styles.buttonText}>
              {create.isPending ? "Creating…" : "Create"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  keyboardAvoiding: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 180,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  label: {
    ...typography.caption,
    fontWeight: "900",
    color: colors.muted,
    textTransform: "uppercase",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.blue, backgroundColor: colors.cardBlue },
  chipText: { ...typography.caption, color: colors.text, fontWeight: "700" },
  chipTextSelected: { color: colors.blueDark, fontWeight: "900" },
  formError: {
    backgroundColor: "#fff0ed",
    color: colors.red,
    padding: spacing.md,
    borderRadius: radii.md,
    fontWeight: "700",
  },
  button: {
    backgroundColor: colors.orange,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadows.card,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontWeight: "900", fontSize: 16 },
});
