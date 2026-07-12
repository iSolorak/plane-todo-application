import type { Priority } from "@plane-todo/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PRIORITIES, PRIORITY_COLOR, priorityLabel } from "../lib/priority";
import { colors, radii, spacing, typography } from "../theme";

export interface PriorityPickerProps {
  value: Priority;
  onChange: (next: Priority) => void;
  disabled?: boolean;
}

export function PriorityPicker({ value, onChange, disabled }: PriorityPickerProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {PRIORITIES.map((p) => {
        const selected = p === value;
        return (
          <Pressable
            key={p}
            disabled={disabled}
            onPress={() => onChange(p)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`Priority ${priorityLabel(p)}`}
            style={[
              styles.chip,
              selected && {
                borderColor: PRIORITY_COLOR[p],
                backgroundColor: colors.surfaceWarm,
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[p] }]} />
            <Text style={[styles.text, selected && styles.textSelected]}>
              {priorityLabel(p)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { ...typography.caption, color: colors.text, fontWeight: "700" },
  textSelected: { color: colors.ink, fontWeight: "900" },
});
