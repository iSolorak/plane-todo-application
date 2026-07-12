import { Platform } from "react-native";

export const colors = {
  background: "#fff8ed",
  surface: "#fffdf8",
  surfaceWarm: "#fff3df",
  card: "#ffffff",
  cardPeach: "#fff1df",
  cardBlue: "#eaf4ff",
  cardGreen: "#edf9ed",
  cardYellow: "#fff7cf",
  ink: "#25221f",
  text: "#423b35",
  muted: "#81776b",
  faint: "#d8ccbd",
  border: "#eadfce",
  orange: "#f47b3f",
  orangeDark: "#c94f21",
  blue: "#3f7edb",
  blueDark: "#2759a2",
  green: "#49a85f",
  greenDark: "#28733a",
  yellow: "#f2be3e",
  red: "#c94a3a",
  white: "#ffffff",
  shadow: "#9f7f55",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

/**
 * Base height of the bottom tab bar (see app/(tabs)/_layout.tsx `minHeight`).
 * The bar is absolutely positioned, so the real occupied space is
 * TAB_BAR_HEIGHT + the bottom safe-area inset. Anything floating above the tab
 * bar (e.g. the FAB) or any scroll content must clear this plus that inset.
 */
export const TAB_BAR_HEIGHT = 72;

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 30,
  pill: 999,
};

export const typography = {
  title: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "800" as const,
    color: colors.ink,
  },
  heading: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800" as const,
    color: colors.ink,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.13,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
  soft: Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.09,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: 2,
    },
    default: {},
  }),
  float: Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
};
