import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme";

export interface DateFieldProps {
  label: string;
  /** YYYY-MM-DD or null. */
  value: string | null;
  onChange: (next: string | null) => void;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromYmd(value: string | null): Date {
  return value ? new Date(`${value}T00:00:00`) : new Date();
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== "ios") setShow(false);
    if (event.type === "set" && date) onChange(toYmd(date));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => setShow(true)}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ?? "no date"}`}
        >
          <Text style={styles.value}>{value ?? "No date"}</Text>
        </Pressable>
        {value ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear date"
          >
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {show ? (
        <DateTimePicker value={fromYmd(value)} mode="date" onChange={handleChange} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.caption, color: colors.text, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  value: { ...typography.body, color: colors.ink, fontWeight: "700" },
  clear: { ...typography.caption, color: colors.orangeDark, fontWeight: "800" },
});
