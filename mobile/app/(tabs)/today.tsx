import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

type TodayFilter = "today" | "open" | "completed" | "urgent";

export default function TodayScreen() {
  const { user, logout } = useAuth();
  const { summary, workOrders, todayRows, loading, refreshing, error, refresh } = useWorkOrders();
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [filter, setFilter] = useState<TodayFilter>("today");
  const openRows = useMemo(() => workOrders.filter((row) => !isClosed(row)), [workOrders]);
  const completedRows = useMemo(() => workOrders.filter(isClosed), [workOrders]);
  const urgentRows = useMemo(() => openRows.filter((row) => row.priorityLevel === "P1"), [openRows]);
  const alerts = useMemo(() => buildAlerts(workOrders), [workOrders]);
  const visibleRows = useMemo(() => {
    if (filter === "open") return openRows;
    if (filter === "completed") return completedRows;
    if (filter === "urgent") return urgentRows;
    return todayRows;
  }, [completedRows, filter, openRows, todayRows, urgentRows]);
  const title = filter === "open" ? "미결 업무" : filter === "completed" ? "완료건" : filter === "urgent" ? "긴급 업무" : "오늘 진행 작업";

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
        <SummaryCard label="미결" value={summary?.pending ?? openRows.length} tone="amber" onPress={() => setFilter("open")} />
        <SummaryCard label="완료" value={summary?.completed ?? completedRows.length} tone="green" onPress={() => setFilter("completed")} />
      </View>
      <View style={styles.summaryGrid}>
        <SummaryCard label="오늘 작업" value={todayRows.length} tone="blue" onPress={() => setFilter("today")} />
        <SummaryCard label="긴급" value={summary?.urgent ?? urgentRows.length} tone="red" onPress={() => setFilter("urgent")} />
      </View>

      {alerts.length ? (
        <View style={styles.alertBox}>
          <Text style={styles.sectionTitle}>AI 장비 경고</Text>
          {alerts.map((alert) => (
            <TouchableOpacity key={alert.id} style={styles.alertRow} onPress={() => alert.workOrder && setSelected(alert.workOrder)}>
              <Text style={styles.alertText}>{alert.message}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.count}>{visibleRows.length}건</Text>
      </View>
      {visibleRows.length ? (
        visibleRows.map((row) => <WorkOrderCard key={row.id} workOrder={row} onPress={() => setSelected(row)} />)
      ) : (
        <Text style={styles.empty}>표시할 정비건이 없습니다.</Text>
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
    .map(([name, group]) => ({
      id: `${name}-${group[0]?.id ?? group.length}`,
      message: `${name}: 미결 ${group.length}건이 있어 반복 고장 또는 우선 점검이 필요합니다.`,
      workOrder: group[0] ?? null
    }));
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
  listHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  count: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
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
  alertRow: {
    borderRadius: 6,
    paddingVertical: 2
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
