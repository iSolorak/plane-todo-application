import { StyleSheet, Switch, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme";

export interface ShowDoneToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  hiddenCount?: number;
}

export function ShowDoneToggle({
  value,
  onValueChange,
  hiddenCount,
}: ShowDoneToggleProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        Show done
        {!value && hiddenCount ? ` (${hiddenCount} hidden)` : ""}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel="Show done items"
        trackColor={{ false: colors.border, true: colors.cardGreen }}
        thumbColor={value ? colors.green : colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { ...typography.body, color: colors.text, fontWeight: "700" },
});
