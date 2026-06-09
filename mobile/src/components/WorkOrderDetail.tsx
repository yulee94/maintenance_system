import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useState } from "react";
import type { WorkOrder } from "../api/types";
import { startWorkOrderWithOffline, submitWorkReportWithOffline } from "../offline/workOrders";
import { colors } from "../theme/theme";
import { equipmentName, shortDate, siteName, statusLabel } from "../utils";

type WorkOrderDetailProps = {
  workOrder: WorkOrder | null;
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
};

export function WorkOrderDetail({ workOrder, visible, onClose, onChanged }: WorkOrderDetailProps) {
  const [submitting, setSubmitting] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState("");
  const [actionTaken, setActionTaken] = useState("");

  if (!workOrder) return null;

  const canStart = ["RECEIVED", "UNASSIGNED", "ASSIGNED"].includes(workOrder.status);
  const canReport = ["IN_PROGRESS", "ASSIGNED", "TEMPORARY_ACTION", "REVISIT_REQUIRED"].includes(workOrder.status);

  async function handleStart() {
    if (!workOrder) return;
    setSubmitting(true);
    try {
      const result = await startWorkOrderWithOffline(workOrder.id, workOrder.branchId);
      if (!result.queued) onChanged();
      Alert.alert(
        "작업 시작",
        result.queued
          ? `인터넷 연결이 없어 로컬 DB에 저장했습니다. 복구 후 자동 동기화됩니다.\nrequest_id: ${result.requestId}`
          : "작업 상태가 업데이트되었습니다."
      );
    } catch (error) {
      Alert.alert("처리 실패", error instanceof Error ? error.message : "작업 시작에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReport() {
    if (!workOrder) return;
    if (!diagnosisResult.trim() || !actionTaken.trim()) {
      Alert.alert("입력 필요", "진단 결과와 조치 내용을 입력하세요.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitWorkReportWithOffline(
        workOrder.id,
        {
          resultType: "COMPLETED",
          diagnosisResult: diagnosisResult.trim(),
          actionTaken: actionTaken.trim()
        },
        workOrder.branchId
      );
      setDiagnosisResult("");
      setActionTaken("");
      if (!result.queued) onChanged();
      Alert.alert(
        "완료보고 제출",
        result.queued
          ? `인터넷 연결이 없어 로컬 DB에 저장했습니다. 복구 후 자동 동기화됩니다.\nrequest_id: ${result.requestId}`
          : "관리자 승인 대기로 전환되었습니다."
      );
    } catch (error) {
      Alert.alert("제출 실패", error instanceof Error ? error.message : "완료보고 제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.requestNo}>{workOrder.requestNo}</Text>
            <Text style={styles.title}>{siteName(workOrder)}</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>닫기</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.meta}>
          {equipmentName(workOrder)} · {statusLabel[workOrder.status] ?? workOrder.status}
        </Text>
        <Text style={styles.body}>{workOrder.faultDescription}</Text>
        <Text style={styles.meta}>
          접수 {shortDate(workOrder.requestDate)} · 목표 {shortDate(workOrder.targetDueDate)}
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity disabled={!canStart || submitting} style={[styles.button, !canStart && styles.disabled]} onPress={handleStart}>
            <Text style={styles.buttonText}>작업 시작</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>완료보고</Text>
        <TextInput
          multiline
          placeholder="진단 결과"
          style={styles.input}
          value={diagnosisResult}
          onChangeText={setDiagnosisResult}
        />
        <TextInput
          multiline
          placeholder="조치 내용"
          style={[styles.input, styles.inputLarge]}
          value={actionTaken}
          onChangeText={setActionTaken}
        />
        <TouchableOpacity disabled={!canReport || submitting} style={[styles.reportButton, !canReport && styles.disabled]} onPress={handleReport}>
          <Text style={styles.reportButtonText}>완료보고 제출</Text>
        </TouchableOpacity>
        <Text style={styles.helper}>
          오프라인 상태에서는 로컬 DB에 먼저 저장되고, 인터넷이 복구되면 중앙 서버와 자동 동기화됩니다.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    flex: 1
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    bottom: 0,
    gap: 10,
    left: 0,
    maxHeight: "88%",
    padding: 18,
    position: "absolute",
    right: 0
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.line,
    borderRadius: 999,
    height: 4,
    width: 48
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  requestNo: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3
  },
  closeButton: {
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  closeText: {
    color: colors.muted,
    fontWeight: "800"
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22
  },
  actionRow: {
    flexDirection: "row"
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  buttonText: {
    color: "#fff",
    fontWeight: "900"
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 6
  },
  input: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 74,
    padding: 12,
    textAlignVertical: "top"
  },
  inputLarge: {
    minHeight: 94
  },
  reportButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 8,
    paddingVertical: 13
  },
  reportButtonText: {
    color: "#fff",
    fontWeight: "900"
  },
  disabled: {
    opacity: 0.42
  },
  helper: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18
  }
});
