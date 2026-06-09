import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { WorkOrder } from "../api/types";
import { colors, shadow } from "../theme/theme";
import { equipmentName, priorityLabel, shortDate, siteName, statusLabel } from "../utils";

type WorkOrderCardProps = {
  workOrder: WorkOrder;
  onPress?: () => void;
  compact?: boolean;
};

const priorityTone: Record<WorkOrder["priorityLevel"], string> = {
  P1: colors.red,
  P2: colors.amber,
  P3: colors.green,
  OUTSOURCE: colors.violet,
  UNSET: colors.muted
};

export function WorkOrderCard({ workOrder, onPress, compact }: WorkOrderCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.top}>
        <Text style={styles.requestNo}>{workOrder.requestNo}</Text>
        <View style={[styles.priority, { borderColor: priorityTone[workOrder.priorityLevel] }]}>
          <Text style={[styles.priorityText, { color: priorityTone[workOrder.priorityLevel] }]}>
            {priorityLabel[workOrder.priorityLevel]}
          </Text>
        </View>
      </View>
      <Text style={styles.site}>{siteName(workOrder)}</Text>
      <Text style={styles.equipment}>{equipmentName(workOrder)}</Text>
      <Text style={styles.description} numberOfLines={compact ? 2 : 3}>
        {workOrder.faultDescription}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{statusLabel[workOrder.status] ?? workOrder.status}</Text>
        <Text style={styles.meta}>접수 {shortDate(workOrder.requestDate)}</Text>
        <Text style={styles.meta}>목표 {shortDate(workOrder.targetDueDate)}</Text>
      </View>
      {workOrder.assignedMechanic?.name ? (
        <Text style={styles.assignee}>담당 {workOrder.assignedMechanic.name}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14,
    ...shadow
  },
  top: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  requestNo: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800"
  },
  priority: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "800"
  },
  site: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  equipment: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  description: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  meta: {
    backgroundColor: colors.bg,
    borderRadius: 999,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  assignee: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  }
});
