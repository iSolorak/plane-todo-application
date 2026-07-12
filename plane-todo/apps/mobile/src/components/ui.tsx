import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radii, shadows, spacing, typography } from "../theme";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.orange} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyBadge}>
        <View style={styles.emptyDot} />
      </View>
      <Text style={styles.emptyTitle}>All clear</Text>
      <Text style={styles.muted}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.emptyAction, pressed && styles.retryPressed]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>Something needs attention</Text>
        <Text style={styles.error}>{message}</Text>
      </View>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.md,
  },
  muted: {
    ...typography.body,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  emptyBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.cardPeach,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  emptyDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.orange,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.ink,
    textAlign: "center",
  },
  emptyAction: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyActionText: {
    ...typography.caption,
    color: colors.orangeDark,
    fontWeight: "900",
  },
  errorCard: {
    width: "100%",
    maxWidth: 340,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  errorTitle: {
    ...typography.heading,
    color: colors.ink,
    textAlign: "center",
  },
  error: { ...typography.body, color: colors.red, textAlign: "center" },
  retry: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.orange,
    borderRadius: radii.pill,
    ...shadows.card,
  },
  retryText: { color: colors.white, fontWeight: "800" },
  retryPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  divider: { height: 12 },
});
