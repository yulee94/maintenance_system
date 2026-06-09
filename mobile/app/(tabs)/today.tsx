import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMemo, useState } from "react";
import type { WorkOrder } from "../../src/api/types";
import { useAuth } from "../../src/api/AuthContext";
import { Screen } from "../../src/components/Screen";
import { SummaryCard } from "../../src/components/SummaryCard";
import { WorkOrderCard } from "../../src/components/WorkOrderCard";
import { WorkOrderDetail } from "../../src/components/WorkOrderDetail";
import { useWorkOrders } from "../../src/hooks/useWorkOrders";
import { colors } from "../../src/theme/theme";
import { equipmentName, isClosed } from "../../src/utils";

export default function TodayScreen() {
  const { user, logout } = useAuth();
  const { summary, workOrders, todayRows, loading, refreshing, error, refresh } = useWorkOrders();
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const alerts = useMemo(() => buildAlerts(workOrders), [workOrders]);

  async function handleLogout() {
    await logout();
  }

  return (
    <Screen
      title="오늘"
      subtitle={`${user?.name ?? "사용자"} · ${user?.roles.join(", ") ?? ""}`}
      loading={loading}
      refreshing={refreshing}
      onRefresh={refresh}
      right={
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.summaryGrid}>
        <SummaryCard label="미결" value={summary?.pending ?? 0} tone="amber" />
        <SummaryCard label="완료" value={summary?.completed ?? 0} tone="green" />
      </View>
      <View style={styles.summaryGrid}>
        <SummaryCard label="내 작업" value={todayRows.length} tone="blue" />
        <SummaryCard label="긴급" value={summary?.urgent ?? 0} tone="red" />
      </View>

      {alerts.length ? (
        <View style={styles.alertBox}>
          <Text style={styles.sectionTitle}>AI 장비 경고</Text>
          {alerts.map((alert) => (
            <Text key={alert} style={styles.alertText}>{alert}</Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>오늘 진행할 작업</Text>
      {todayRows.length ? (
        todayRows.map((row) => <WorkOrderCard key={row.id} workOrder={row} onPress={() => setSelected(row)} />)
      ) : (
        <Text style={styles.empty}>오늘 표시할 정비건이 없습니다.</Text>
      )}
      <WorkOrderDetail visible={Boolean(selected)} workOrder={selected} onClose={() => setSelected(null)} onChanged={refresh} />
    </Screen>
  );
}

function buildAlerts(rows: WorkOrder[]) {
  const groups = new Map<string, WorkOrder[]>();
  for (const row of rows.filter((item) => !isClosed(item))) {
    const key = equipmentName(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups.entries())
    .filter(([, group]) => group.length >= 2 || group.some((row) => row.priorityLevel === "P1" || row.isDelayed))
    .slice(0, 3)
    .map(([name, group]) => `${name}: 미결 ${group.length}건이 있어 반복 고장 또는 우선 점검이 필요합니다.`);
}

const styles = StyleSheet.create({
  logoutButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  logoutText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 10
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4
  },
  alertBox: {
    backgroundColor: colors.redSoft,
    borderColor: "#ffc8c0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14
  },
  alertText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20
  },
  error: {
    backgroundColor: colors.redSoft,
    borderRadius: 8,
    color: colors.red,
    fontWeight: "800",
    padding: 12
  },
  empty: {
    color: colors.muted,
    padding: 16,
    textAlign: "center"
  }
});
