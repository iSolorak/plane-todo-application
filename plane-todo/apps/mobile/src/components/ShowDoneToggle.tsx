import { StyleSheet, Switch, Text, View } from "react-native";

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
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: { fontSize: 15, color: "#374151" },
});
