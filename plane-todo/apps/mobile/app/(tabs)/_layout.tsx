import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";
import { Loading, Screen } from "../../src/components/ui";
import { isSetupComplete, useConfig } from "../../src/data/config";
import { colors, radii, TAB_BAR_HEIGHT } from "../../src/theme";

export default function TabsLayout() {
  const { config, ready } = useConfig();

  if (!ready) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  // Child tab screens use the PlaneClient — only mount them once setup is done.
  if (!isSetupComplete(config)) {
    return <Redirect href="/setup" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.ink, fontWeight: "800" },
        tabBarActiveTintColor: colors.orangeDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "900", marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          minHeight: TAB_BAR_HEIGHT,
          paddingTop: 8,
          paddingBottom: 12,
          borderTopLeftRadius: radii.lg,
          borderTopRightRadius: radii.lg,
          position: "absolute",
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color }) => <TabDot color={color} label="Today" />,
        }}
      />
      <Tabs.Screen
        name="all"
        options={{
          title: "All",
          tabBarIcon: ({ color }) => <TabDot color={color} label="All" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabDot color={color} label="Settings" />,
        }}
      />
    </Tabs>
  );
}

function TabDot({ color, label }: { color: string; label: string }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ color, fontSize: label === "Settings" ? 17 : 18, lineHeight: 20 }}
    >
      {label === "Today" ? "●" : label === "All" ? "◆" : "○"}
    </Text>
  );
}
