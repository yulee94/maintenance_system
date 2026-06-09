import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { WorkOrder } from "../../src/api/types";
import { Screen } from "../../src/components/Screen";
import { WorkOrderCard } from "../../src/components/WorkOrderCard";
import { WorkOrderDetail } from "../../src/components/WorkOrderDetail";
import { useWorkOrders } from "../../src/hooks/useWorkOrders";
import { colors } from "../../src/theme/theme";

const priorityFilters = [
  { label: "전체", value: "ALL" },
  { label: "긴급", value: "P1" },
  { label: "중요", value: "P2" },
  { label: "일반", value: "P3" },
  { label: "외주", value: "OUTSOURCE" }
];

export default function MaintenanceScreen() {
  const { openRows, loading, refreshing, error, refresh } = useWorkOrders();
  const [priority, setPriority] = useState("ALL");
  const [selected, setSelected] = useState<WorkOrder | null>(null);

  const rows = useMemo(
    () => (priority === "ALL" ? openRows : openRows.filter((row) => row.priorityLevel === priority)),
    [openRows, priority]
  );

  return (
    <Screen title="정비건" subtitle="미결 정비건을 priority별로 확인합니다." loading={loading} refreshing={refreshing} onRefresh={refresh}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.filterRow}>
        {priorityFilters.map((filter) => (
          <Pressable
            key={filter.value}
            style={[styles.filter, priority === filter.value && styles.filterActive]}
            onPress={() => setPriority(filter.value)}
          >
            <Text style={[styles.filterText, priority === filter.value && styles.filterTextActive]}>{filter.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.count}>표시 {rows.length}건</Text>
      {rows.length ? (
        rows.map((row) => <WorkOrderCard key={row.id} workOrder={row} onPress={() => setSelected(row)} />)
      ) : (
        <Text style={styles.empty}>조건에 맞는 미결 정비건이 없습니다.</Text>
      )}
      <WorkOrderDetail visible={Boolean(selected)} workOrder={selected} onClose={() => setSelected(null)} onChanged={refresh} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filter: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  filterTextActive: {
    color: "#fff"
  },
  count: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
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
