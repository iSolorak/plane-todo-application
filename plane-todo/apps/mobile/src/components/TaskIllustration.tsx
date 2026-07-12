import type { Priority, StateGroup } from "@plane-todo/core";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme";

export type TaskIllustrationSize = "small" | "large";
export type TaskIllustrationVariant = "stack" | "orbit" | "blocks";

export interface TaskIllustrationProps {
  status?: StateGroup | string | null;
  priority?: Priority | null;
  completed?: boolean;
  size?: TaskIllustrationSize;
  variant?: TaskIllustrationVariant;
}

const SIZE_PX: Record<TaskIllustrationSize, number> = {
  small: 76,
  large: 112,
};

export function TaskIllustration({
  status,
  priority = "none",
  completed,
  size = "small",
  variant = "stack",
}: TaskIllustrationProps) {
  const px = SIZE_PX[size];
  const scale = px / SIZE_PX.small;
  const done =
    completed ?? (status === "completed" || status === "cancelled");
  const palette = getPalette(status, priority, done);
  const orbit = variant === "orbit";
  const blocks = variant === "blocks";

  return (
    <View
      style={[
        styles.frame,
        {
          width: px,
          height: px,
          borderRadius: radii.lg * scale,
          backgroundColor: palette.backdrop,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.backBlob,
          {
            width: 42 * scale,
            height: 42 * scale,
            borderRadius: 21 * scale,
            right: -10 * scale,
            bottom: -8 * scale,
            borderWidth: 8 * scale,
            borderColor: palette.accent,
          },
        ]}
      />
      <View
        style={[
          styles.sun,
          {
            width: 22 * scale,
            height: 22 * scale,
            borderRadius: 11 * scale,
            right: 10 * scale,
            top: 9 * scale,
            backgroundColor: palette.accent,
          },
        ]}
      />
      <View
        style={[
          styles.sheet,
          {
            width: 45 * scale,
            height: 43 * scale,
            borderRadius: 14 * scale,
            left: blocks ? 18 * scale : 13 * scale,
            bottom: orbit ? 11 * scale : 14 * scale,
            padding: 9 * scale,
            gap: 6 * scale,
            transform: [{ rotate: done ? "4deg" : orbit ? "7deg" : "-6deg" }],
          },
        ]}
      >
        {done ? (
          <View
            style={[
              styles.checkCircle,
              {
                width: 24 * scale,
                height: 24 * scale,
                borderRadius: 12 * scale,
                backgroundColor: palette.accent,
              },
            ]}
          >
            <Text
              style={[
                styles.check,
                { fontSize: 14 * scale, lineHeight: 17 * scale },
              ]}
            >
              ✓
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.lineLong,
                {
                  width: blocks ? 18 * scale : 24 * scale,
                  height: 6 * scale,
                  borderRadius: 5 * scale,
                  backgroundColor: palette.accent,
                },
              ]}
            />
            <View
              style={[
                styles.lineShort,
                {
                  width: orbit ? 24 * scale : 17 * scale,
                  height: 5 * scale,
                  borderRadius: 5 * scale,
                },
              ]}
            />
            <View style={[styles.dots, { gap: 4 * scale }]}>
              <MiniDot scale={scale} color={palette.accent} />
              <MiniDot scale={scale} color={colors.border} />
              <MiniDot scale={scale} color={blocks ? palette.accentSoft : colors.border} />
            </View>
          </>
        )}
      </View>
      <View
        style={[
          styles.frontPill,
          {
            width: (blocks ? 25 : 30) * scale,
            height: 10 * scale,
            borderRadius: 6 * scale,
            left: (blocks ? 9 : 8) * scale,
            top: (orbit ? 17 : 22) * scale,
            backgroundColor: palette.accentSoft,
          },
        ]}
      />
    </View>
  );
}

function MiniDot({ scale, color }: { scale: number; color: string }) {
  return (
    <View
      style={{
        width: 6 * scale,
        height: 6 * scale,
        borderRadius: 3 * scale,
        backgroundColor: color,
      }}
    />
  );
}

function getPalette(
  status: TaskIllustrationProps["status"],
  priority: Priority | null,
  completed?: boolean,
) {
  if (completed) {
    return {
      backdrop: colors.cardGreen,
      accent: colors.green,
      accentSoft: "#bfe8c7",
    };
  }
  if (priority === "urgent" || priority === "high") {
    return {
      backdrop: colors.cardPeach,
      accent: colors.orange,
      accentSoft: "#ffd0aa",
    };
  }
  if (status === "backlog" || status === "unstarted" || status === "triage") {
    return {
      backdrop: colors.surfaceWarm,
      accent: colors.faint,
      accentSoft: colors.border,
    };
  }
  if (priority === "low") {
    return {
      backdrop: colors.cardBlue,
      accent: colors.blue,
      accentSoft: "#bfd8ff",
    };
  }
  if (priority === "medium") {
    return {
      backdrop: colors.cardYellow,
      accent: colors.yellow,
      accentSoft: "#ffe6a3",
    };
  }
  return {
    backdrop: colors.cardBlue,
    accent: colors.blue,
    accentSoft: colors.cardPeach,
  };
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    position: "relative",
  },
  backBlob: {
    position: "absolute",
    opacity: 0.28,
  },
  sun: {
    position: "absolute",
    opacity: 0.9,
  },
  sheet: {
    position: "absolute",
    backgroundColor: colors.white,
  },
  checkCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    color: colors.white,
    fontWeight: "900",
  },
  lineLong: {},
  lineShort: {
    backgroundColor: colors.border,
  },
  dots: {
    flexDirection: "row",
    marginTop: 1,
  },
  frontPill: {
    position: "absolute",
    opacity: 0.85,
  },
});
