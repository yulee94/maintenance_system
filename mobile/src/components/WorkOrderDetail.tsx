import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useState } from "react";
import { submitWorkReport, uploadWorkReportAttachment } from "../api/client";
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

type AttachmentStage = "BEFORE" | "DURING" | "AFTER" | "REPORT";

type ReportMedia = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  stage: AttachmentStage;
  mediaKind: "image" | "video";
  size?: number;
};

const mediaTypes: ImagePicker.MediaType[] = ["images", "videos"];
const attachmentStageOptions: { value: AttachmentStage; label: string }[] = [
  { value: "BEFORE", label: "정비 전" },
  { value: "DURING", label: "정비 중" },
  { value: "AFTER", label: "정비 후" },
  { value: "REPORT", label: "일반 보고" }
];

export function WorkOrderDetail({ workOrder, visible, onClose, onChanged }: WorkOrderDetailProps) {
  const [submitting, setSubmitting] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [attachments, setAttachments] = useState<ReportMedia[]>([]);

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
          ? `인터넷 연결이 없어 로컬 DB에 저장했습니다. 복구 시 자동 동기화됩니다.\nrequest_id: ${result.requestId}`
          : "작업 상태가 업데이트되었습니다."
      );
    } catch (error) {
      Alert.alert("처리 실패", error instanceof Error ? error.message : "작업 시작에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function addMedia(source: "camera" | "library") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("권한 필요", source === "camera" ? "사진/영상 촬영을 위해 카메라 권한이 필요합니다." : "사진/영상 첨부를 위해 사진 보관함 권한이 필요합니다.");
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes,
            quality: 0.72,
            videoMaxDuration: 90
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: true,
            mediaTypes,
            quality: 0.72,
            selectionLimit: 8
          });

    if (result.canceled) return;
    setAttachments((current) => [...current, ...result.assets.map(toReportMedia)]);
  }

  async function handleReport() {
    if (!workOrder) return;
    if (!canReport) {
      Alert.alert("제출 불가", "현재 상태에서는 완료보고를 제출할 수 없습니다.");
      return;
    }
    if (!diagnosisResult.trim() || !actionTaken.trim()) {
      Alert.alert("입력 필요", "진단 결과와 조치 내용을 입력하세요.");
      return;
    }

    const input = {
      resultType: "COMPLETED" as const,
      diagnosisResult: diagnosisResult.trim(),
      actionTaken: actionTaken.trim()
    };

    setSubmitting(true);
    try {
      if (attachments.length) {
        const response = await submitWorkReport(workOrder.id, input);
        for (const attachment of attachments) {
          await uploadWorkReportAttachment(response.report.id, attachment);
        }
        setDiagnosisResult("");
        setActionTaken("");
        setAttachments([]);
        onChanged();
        Alert.alert("완료보고 제출", `완료보고와 사진/영상 ${attachments.length}개가 관리자 승인 대기로 전환되었습니다.`);
        return;
      }

      const result = await submitWorkReportWithOffline(workOrder.id, input, workOrder.branchId);
      setDiagnosisResult("");
      setActionTaken("");
      if (!result.queued) onChanged();
      Alert.alert(
        "완료보고 제출",
        result.queued
          ? `인터넷 연결이 없어 로컬 DB에 저장했습니다. 복구 시 자동 동기화됩니다.\nrequest_id: ${result.requestId}`
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
        <ScrollView style={styles.content} contentContainerStyle={styles.contentBody}>
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

          <View style={styles.mediaHeader}>
            <View>
              <Text style={styles.sectionTitle}>정비 전/후 사진·영상</Text>
              <Text style={styles.helper}>사진/영상 포함 보고는 온라인 상태에서 서버로 바로 업로드됩니다.</Text>
            </View>
          </View>
          <View style={styles.mediaActions}>
            <TouchableOpacity disabled={submitting} style={styles.mediaButton} onPress={() => addMedia("camera")}>
              <Text style={styles.mediaButtonText}>촬영</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={submitting} style={styles.mediaButton} onPress={() => addMedia("library")}>
              <Text style={styles.mediaButtonText}>앨범 선택</Text>
            </TouchableOpacity>
          </View>

          {attachments.length ? (
            <View style={styles.mediaList}>
              {attachments.map((attachment) => (
                <View style={styles.mediaCard} key={attachment.id}>
                  {attachment.mediaKind === "image" ? (
                    <Image source={{ uri: attachment.uri }} style={styles.mediaThumb} />
                  ) : (
                    <View style={styles.videoThumb}>
                      <Text style={styles.videoThumbText}>영상</Text>
                    </View>
                  )}
                  <View style={styles.mediaInfo}>
                    <Text style={styles.mediaName} numberOfLines={1}>{attachment.name}</Text>
                    <Text style={styles.mediaMeta}>{attachment.mediaKind === "video" ? "영상" : "사진"} · {formatFileSize(attachment.size)}</Text>
                    <View style={styles.stageRow}>
                      {attachmentStageOptions.map((option) => (
                        <Pressable
                          key={option.value}
                          style={[styles.stageChip, attachment.stage === option.value && styles.stageChipActive]}
                          onPress={() =>
                            setAttachments((current) =>
                              current.map((item) => item.id === attachment.id ? { ...item, stage: option.value } : item)
                            )
                          }
                        >
                          <Text style={[styles.stageChipText, attachment.stage === option.value && styles.stageChipTextActive]}>{option.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeMediaButton}
                    onPress={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  >
                    <Text style={styles.removeMediaText}>삭제</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity disabled={!canReport || submitting} style={[styles.reportButton, !canReport && styles.disabled]} onPress={handleReport}>
            <Text style={styles.reportButtonText}>{submitting ? "제출 중" : "완료보고 제출"}</Text>
          </TouchableOpacity>
          <Text style={styles.helper}>
            텍스트 보고만 작성하면 오프라인 저장 후 자동 동기화가 가능하고, 사진/영상 첨부 보고는 파일 업로드를 위해 온라인 상태에서 제출됩니다.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function toReportMedia(asset: ImagePicker.ImagePickerAsset, index: number): ReportMedia {
  const isVideo = asset.type === "video" || asset.mimeType?.startsWith("video/");
  const fallbackExt = isVideo ? "mp4" : "jpg";
  return {
    id: `${asset.assetId ?? asset.uri}-${Date.now()}-${index}`,
    uri: asset.uri,
    name: asset.fileName ?? `maintenance-report-${Date.now()}-${index}.${fallbackExt}`,
    mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
    stage: "AFTER",
    mediaKind: isVideo ? "video" : "image",
    size: asset.fileSize
  };
}

function formatFileSize(size?: number) {
  if (!size) return "크기 미확인";
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
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
    left: 0,
    maxHeight: "90%",
    padding: 18,
    position: "absolute",
    right: 0
  },
  content: {
    marginTop: 10
  },
  contentBody: {
    gap: 10,
    paddingBottom: 16
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
    justifyContent: "space-between",
    marginTop: 12
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
  mediaHeader: {
    marginTop: 4
  },
  mediaActions: {
    flexDirection: "row",
    gap: 8
  },
  mediaButton: {
    backgroundColor: colors.blueSoft,
    borderColor: "#bcd2ff",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  mediaButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900"
  },
  mediaList: {
    gap: 8
  },
  mediaCard: {
    alignItems: "flex-start",
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10
  },
  mediaThumb: {
    backgroundColor: colors.line,
    borderRadius: 7,
    height: 58,
    width: 58
  },
  videoThumb: {
    alignItems: "center",
    backgroundColor: "#172033",
    borderRadius: 7,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  videoThumbText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900"
  },
  mediaInfo: {
    flex: 1,
    gap: 5,
    minWidth: 0
  },
  mediaName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  mediaMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  stageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5
  },
  stageChip: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  stageChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  stageChipText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900"
  },
  stageChipTextActive: {
    color: "#fff"
  },
  removeMediaButton: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  removeMediaText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: "900"
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
