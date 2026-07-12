import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadows, TAB_BAR_HEIGHT } from "../theme";

/** Gap between the top of the tab bar and the bottom of the FAB. */
const FAB_GAP = 16;

export function Fab({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  // The tab bar is absolutely positioned, so it occupies TAB_BAR_HEIGHT plus
  // the bottom safe-area inset. Sit the FAB fully above both.
  const bottom = TAB_BAR_HEIGHT + insets.bottom + FAB_GAP;

  return (
    <Pressable
      style={[styles.fab, { bottom }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="New item"
    >
      <Text style={styles.plus}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
    // Sit above list content and the (absolute) tab bar.
    zIndex: 20,
    elevation: 12,
    ...shadows.float,
  },
  plus: { color: colors.white, fontSize: 34, lineHeight: 38, fontWeight: "500" },
});
