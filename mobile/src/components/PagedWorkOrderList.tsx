import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { WorkOrder } from "../api/types";
import { colors } from "../theme/theme";
import { WorkOrderCard } from "./WorkOrderCard";

type ViewMode = "simple" | "card" | "grid";

type PagedWorkOrderListProps = {
  rows: WorkOrder[];
  onSelect: (row: WorkOrder) => void;
  emptyText?: string;
};

const pageSizes = [6, 12, 24];
const viewModes: { value: ViewMode; label: string }[] = [
  { value: "simple", label: "간단" },
  { value: "card", label: "카드" },
  { value: "grid", label: "바둑판" }
];

export function PagedWorkOrderList({ rows, onSelect, emptyText = "표시할 정비건이 없습니다." }: PagedWorkOrderListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [pageSize, setPageSize] = useState(6);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const firstIndex = (safePage - 1) * pageSize;
  const visibleRows = rows.slice(firstIndex, firstIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize, viewMode]);

  if (!rows.length) return <Text style={styles.empty}>{emptyText}</Text>;

  return (
    <View style={styles.shell}>
      <View style={styles.controls}>
        <View style={styles.segment}>
          {viewModes.map((mode, index) => (
            <TouchableOpacity
              key={mode.value}
              style={[
                styles.segmentButton,
                index === viewModes.length - 1 && styles.segmentButtonLast,
                viewMode === mode.value && styles.segmentButtonActive
              ]}
              onPress={() => setViewMode(mode.value)}
              activeOpacity={0.84}
            >
              <Text style={[styles.segmentText, viewMode === mode.value && styles.segmentTextActive]}>{mode.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.pageSizeRow}>
          {pageSizes.map((size) => (
            <TouchableOpacity
              key={size}
              style={[styles.pageSizeButton, pageSize === size && styles.pageSizeButtonActive]}
              onPress={() => setPageSize(size)}
            >
              <Text style={[styles.pageSizeText, pageSize === size && styles.pageSizeTextActive]}>{size}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.range}>
        {firstIndex + 1}-{Math.min(firstIndex + visibleRows.length, rows.length)} / {rows.length}건
      </Text>

      <View style={viewMode === "grid" ? styles.grid : styles.list}>
        {visibleRows.map((row) => (
          <View key={row.id} style={viewMode === "grid" ? styles.gridItem : undefined}>
            <WorkOrderCard compact={viewMode === "simple"} workOrder={row} onPress={() => onSelect(row)} />
          </View>
        ))}
      </View>

      {pageCount > 1 ? (
        <View style={styles.pager}>
          <TouchableOpacity
            disabled={safePage <= 1}
            style={[styles.pagerButton, safePage <= 1 && styles.disabled]}
            onPress={() => setPage((current) => Math.max(1, current - 1))}
          >
            <Text style={styles.pagerText}>이전</Text>
          </TouchableOpacity>
          <Text style={styles.pageText}>
            {safePage} / {pageCount}
          </Text>
          <TouchableOpacity
            disabled={safePage >= pageCount}
            style={[styles.pagerButton, safePage >= pageCount && styles.disabled]}
            onPress={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            <Text style={styles.pagerText}>다음</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 10
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between"
  },
  segment: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden"
  },
  segmentButton: {
    backgroundColor: colors.surface,
    borderRightColor: colors.line,
    borderRightWidth: 1,
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  segmentButtonLast: {
    borderRightWidth: 0
  },
  segmentButtonActive: {
    backgroundColor: colors.primary
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  segmentTextActive: {
    color: "#fff"
  },
  pageSizeRow: {
    flexDirection: "row",
    gap: 5
  },
  pageSizeButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 7,
    borderWidth: 1,
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  pageSizeButtonActive: {
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  pageSizeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  pageSizeTextActive: {
    color: "#fff"
  },
  range: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  list: {
    gap: 10
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  gridItem: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 150
  },
  pager: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center"
  },
  pagerButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  pagerText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900"
  },
  pageText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    minWidth: 56,
    textAlign: "center"
  },
  disabled: {
    opacity: 0.42
  },
  empty: {
    color: colors.muted,
    padding: 16,
    textAlign: "center"
  }
});
