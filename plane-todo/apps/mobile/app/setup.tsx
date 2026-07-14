import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { TextField } from "../src/components/TextField";
import { createPlaneClient } from "../src/data/client";
import {
  configFieldErrors,
  normalizeConfig,
  useConfig,
  type AppConfig,
  type ConfigDraft,
} from "../src/data/config";
import { toUserFacingError } from "../src/data/errors";

type FieldErrors = Partial<Record<keyof AppConfig, string>>;

export default function SetupScreen() {
  const { config, save } = useConfig();
  const params = useLocalSearchParams<{ error?: string; edit?: string }>();
  const router = useRouter();

  // Distinguish initial setup from editing an existing config. The header text,
  // CTA label, and Cancel affordance all key off this. Settings routes here
  // with `?edit=1`; _layout.tsx lets us stay on /setup while it's set.
  const editMode = params.edit === "1" && !!config;

  const [draft, setDraft] = useState<ConfigDraft>(() => config ?? {});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    params.error ?? null,
  );

  const set = (key: keyof AppConfig) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const onSubmit = async () => {
    // In edit mode, an empty API-key field means "keep the existing key" so the
    // user doesn't have to re-type it every time. Merge before validation.
    const merged: ConfigDraft =
      editMode && config
        ? {
            ...draft,
            planeApiKey: draft.planeApiKey?.trim()
              ? draft.planeApiKey
              : config.planeApiKey,
          }
        : draft;

    const fieldErrors = configFieldErrors(merged);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const cfg = normalizeConfig(merged);
    setSubmitting(true);
    setFormError(null);
    try {
      // Validate credentials with a single real call.
      const client = createPlaneClient({
        baseUrl: cfg.planeBaseUrl,
        workspaceSlug: cfg.workspaceSlug,
        auth: { type: "apiKey", apiKey: cfg.planeApiKey },
      });
      await client.listProjects();
      await save(cfg);
      router.replace(editMode ? "/(tabs)/settings" : "/(tabs)/today");
    } catch (err) {
      setFormError(toUserFacingError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          {editMode ? "Edit configuration" : "Connect to Plane"}
        </Text>
        <Text style={styles.subtitle}>
          {editMode
            ? "Change only the fields you need — leave the API key blank to keep the current one."
            : "Self-hosted, single user. Your API key is stored securely on-device."}
        </Text>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <TextField
          label="Plane base URL"
          value={draft.planeBaseUrl ?? ""}
          onChangeText={set("planeBaseUrl")}
          placeholder="https://plane.example.com"
          keyboardType="url"
          error={errors.planeBaseUrl}
          autoFocus
        />
        <TextField
          label="Workspace slug"
          value={draft.workspaceSlug ?? ""}
          onChangeText={set("workspaceSlug")}
          placeholder="my-workspace"
          error={errors.workspaceSlug}
        />
        <TextField
          label="API key"
          value={draft.planeApiKey ?? ""}
          onChangeText={set("planeApiKey")}
          placeholder={editMode ? "Leave blank to keep current" : "plane_api_…"}
          secureTextEntry
          error={errors.planeApiKey}
        />
        <TextField
          label="Notifier base URL (optional)"
          value={draft.notifierBaseUrl ?? ""}
          onChangeText={set("notifierBaseUrl")}
          placeholder="https://notifier.example.com"
          keyboardType="url"
          error={errors.notifierBaseUrl}
        />
        <TextField
          label="Default project id (optional)"
          value={draft.defaultProjectId ?? ""}
          onChangeText={set("defaultProjectId")}
          placeholder="Leave blank to span all projects"
        />

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={editMode ? "Save configuration" : "Validate and save"}
        >
          <Text style={styles.buttonText}>
            {submitting
              ? "Validating…"
              : editMode
                ? "Save changes"
                : "Validate & continue"}
          </Text>
        </Pressable>

        {editMode ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace("/(tabs)/settings")}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Cancel and go back"
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "white" },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
  formError: {
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryButtonText: { color: "#6b7280", fontWeight: "700", fontSize: 15 },
});
