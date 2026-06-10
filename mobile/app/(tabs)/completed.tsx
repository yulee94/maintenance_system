import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import type { WorkOrder } from "../../src/api/types";
import { PagedWorkOrderList } from "../../src/components/PagedWorkOrderList";
import { Screen } from "../../src/components/Screen";
import { WorkOrderDetail } from "../../src/components/WorkOrderDetail";
import { useWorkOrders } from "../../src/hooks/useWorkOrders";
import { colors } from "../../src/theme/theme";

export default function CompletedScreen() {
  const { completedRows, loading, refreshing, error, refresh } = useWorkOrders();
  const [selected, setSelected] = useState<WorkOrder | null>(null);

  return (
    <Screen title="완료건" subtitle="최종 완료 및 보고가 끝난 정비 이력을 확인합니다." loading={loading} refreshing={refreshing} onRefresh={refresh}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.count}>완료 {completedRows.length}건</Text>
      <PagedWorkOrderList rows={completedRows} onSelect={setSelected} emptyText="완료된 정비건이 없습니다." />
      <WorkOrderDetail visible={Boolean(selected)} workOrder={selected} onClose={() => setSelected(null)} onChanged={refresh} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  }
});
