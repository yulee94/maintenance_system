import { Tabs } from "expo-router";
import { colors } from "../../src/theme/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "800" },
        tabBarStyle: {
          borderTopColor: colors.line,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8
        }
      }}
    >
      <Tabs.Screen name="today" options={{ title: "오늘" }} />
      <Tabs.Screen name="maintenance" options={{ title: "정비건" }} />
      <Tabs.Screen name="completed" options={{ title: "완료건" }} />
      <Tabs.Screen name="ai" options={{ title: "AI" }} />
    </Tabs>
  );
}
