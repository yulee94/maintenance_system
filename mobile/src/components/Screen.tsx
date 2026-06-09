import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/theme";

type ScreenProps = ScrollViewProps & {
  title: string;
  subtitle?: string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  right?: React.ReactNode;
};

export function Screen({ title, subtitle, loading, refreshing, onRefresh, right, children, ...props }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>불러오는 중</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
          {...props}
        >
          {children}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg
  },
  header: {
    alignItems: "flex-start",
    backgroundColor: colors.bg,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12
  },
  heading: {
    flex: 1
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4
  },
  content: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 28
  },
  loading: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center"
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13
  }
});
