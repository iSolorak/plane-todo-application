import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useConfig } from "../../src/data/config";
import { usePush } from "../../src/data/pushContext";
import type { PushStatus } from "../../src/data/pushTypes";
import { useNotifierConfig } from "../../src/data/useNotifierConfig";
import { colors, radii, shadows, spacing, typography } from "../../src/theme";

const PUSH_LABEL: Record<PushStatus, string> = {
  disabled: "No notifier configured",
  registering: "Registering…",
  registered: "Registered ✓",
  denied: "Notifications denied — enable in system settings",
  unsupported: "Unavailable in Expo Go — use a development build",
  error: "Registration failed",
};

export default function SettingsScreen() {
  const { config, clear } = useConfig();
  const push = usePush();
  const router = useRouter();
  const notifier = useNotifierConfig(config?.notifierBaseUrl);

  if (!config) return null;

  const onReset = async () => {
    await clear();
    router.replace("/setup");
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Connection">
        <Row label="Base URL" value={config.planeBaseUrl} />
        <Row label="Workspace" value={config.workspaceSlug} />
        <Row
          label="Default project"
          value={config.defaultProjectId ?? "All projects"}
        />
        <Row label="Notifier" value={config.notifierBaseUrl ?? "Not set"} />
        {/* API key is intentionally never displayed. */}
      </Section>

      <Section title="Push notifications">
        <Row label="Status" value={PUSH_LABEL[push.status]} />
      </Section>

      {config.notifierBaseUrl ? (
        <Section title="Reminder schedule (read-only)">
          {notifier.isLoading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : notifier.isError ? (
            <Text style={styles.error}>Couldn't reach the notifier.</Text>
          ) : notifier.data ? (
            <View style={styles.gap}>
              {notifier.data.offsets.map((o) => (
                <Row
                  key={o.key}
                  label={`Offset "${o.key}"`}
                  value={`${o.minutesBefore} min before`}
                />
              ))}
              <Row
                label="Digest"
                value={
                  notifier.data.digest.enabled
                    ? `${notifier.data.digest.time} (${notifier.data.digest.tz})`
                    : "Disabled"
                }
              />
            </View>
          ) : null}
        </Section>
      ) : null}

      <Pressable
        style={styles.reset}
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Reset configuration"
      >
        <Text style={styles.resetText}>Reset configuration</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  sectionTitle: {
    ...typography.caption,
    fontWeight: "900",
    color: colors.muted,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  gap: { gap: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  rowLabel: { ...typography.body, color: colors.text },
  rowValue: {
    ...typography.body,
    color: colors.ink,
    flexShrink: 1,
    textAlign: "right",
    fontWeight: "700",
  },
  muted: { ...typography.body, color: colors.muted },
  error: { ...typography.body, color: colors.red },
  reset: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radii.lg,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  resetText: { color: colors.red, fontWeight: "900" },
});
