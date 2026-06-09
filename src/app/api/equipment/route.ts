import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoWorkOrders } from "@/lib/demo";
import { numberFromEquipmentText, pick, readMasterListRows } from "@/lib/excel";

type AssetWorkOrder = {
  id: string;
  requestNo: string;
  requestDate: string | Date;
  faultDescription: string;
  priorityLevel: string;
  status: string;
  targetDueDate?: string | Date | null;
  isDelayed?: boolean | null;
  actionTaken?: string | null;
  diagnosisResult?: string | null;
  assignedMechanic?: { name?: string | null } | null;
};

type EquipmentAssetInput = {
  id: string;
  normalizedNo?: string | null;
  equipmentNo?: string | null;
  placementNo?: string | null;
  customer?: { name?: string | null } | null;
  site?: { name?: string | null } | null;
  manufacturer?: string | null;
  powerType?: string | null;
  kind?: string | null;
  status?: string | null;
  managerName?: string | null;
  location?: string | null;
  operationType?: string | null;
  spec?: string | null;
  tonnage?: string | null;
  maker?: string | null;
  modelName?: string | null;
  serialNo?: string | null;
  year?: string | null;
  operatingHours?: string | null;
  vehicleRegistrationNo?: string | null;
  workOrders: AssetWorkOrder[];
};

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    if (appEnv.demoMode) return ok(await demoEquipmentAssets());
    const rows = await prisma.equipment.findMany({
      include: {
        customer: true,
        site: true,
        workOrders: {
          where: { deletedAt: null },
          include: { assignedMechanic: { select: { name: true } } },
          orderBy: { requestDate: "desc" }
        }
      },
      orderBy: [{ customer: { name: "asc" } }, { normalizedNo: "asc" }]
    });
    return ok(rows.map((row) => buildEquipmentAsset(row)));
  } catch (error) {
    return handleApiError(error);
  }
}

async function demoEquipmentAssets() {
  const orders = await demoWorkOrders();
  const rows = await readMasterListRows().catch(() => []);
  const assets = new Map<string, EquipmentAssetInput>();

  rows.forEach((row, index) => {
    const normalizedNo = numberFromEquipmentText(pick(row, ["K&L 등록", "No.", "배치No", "장비 No"])) || `template-${index + 1}`;
    assets.set(normalizedNo, {
      id: `template-equipment-${normalizedNo}`,
      normalizedNo,
      equipmentNo: pick(row, ["장비 No"]),
      placementNo: pick(row, ["배치No"]),
      customer: { name: pick(row, ["사업장", "계약처"]) || "미지정" },
      site: { name: pick(row, ["배치장소", "사업장"]) || "미지정" },
      manufacturer: pick(row, ["제조"]),
      powerType: pick(row, ["동력"]),
      kind: pick(row, ["종류"]),
      status: pick(row, ["상태"]),
      managerName: pick(row, ["담당자"]),
      location: pick(row, ["배치장소"]),
      operationType: pick(row, ["운영"]),
      spec: pick(row, ["규격"]),
      tonnage: pick(row, ["톤수"]),
      maker: pick(row, ["제작처"]),
      modelName: pick(row, ["모델명"]),
      serialNo: pick(row, ["차대번호"]),
      year: pick(row, ["년식"]),
      operatingHours: pick(row, ["가동시간"]),
      vehicleRegistrationNo: pick(row, ["차량등록 No."]),
      workOrders: []
    });
  });

  for (const order of orders) {
    const normalizedNo = order.equipmentNoNormalized || order.equipment?.normalizedNo || order.equipmentInput || order.id;
    const existing = assets.get(normalizedNo);
    if (existing) {
      existing.workOrders.push(order);
      continue;
    }
    assets.set(normalizedNo, {
      ...order.equipment,
      customer: order.equipment.customer ?? order.customer,
      site: order.equipment.site ?? order.site,
      workOrders: [order]
    });
  }

  return Array.from(assets.values()).map((asset) => buildEquipmentAsset(asset));
}

function buildEquipmentAsset(input: EquipmentAssetInput) {
  const workOrders = [...input.workOrders].sort((a, b) => dateValue(b.requestDate) - dateValue(a.requestDate));
  const openWorkOrderCount = workOrders.filter((row) => !isClosedStatus(row.status)).length;
  const completedWorkOrderCount = workOrders.filter((row) => isClosedStatus(row.status)).length;
  const urgentWorkOrderCount = workOrders.filter((row) => row.priorityLevel === "P1").length;
  const delayedWorkOrderCount = workOrders.filter((row) => row.isDelayed || row.status === "DELAYED").length;
  const repeatSignalCount = workOrders.filter((row) => /재발|반복|재방문|다시|또\s*/.test(row.faultDescription)).length;
  const riskLevel =
    workOrders.length >= 3 || repeatSignalCount >= 2 || (urgentWorkOrderCount > 0 && delayedWorkOrderCount > 0)
      ? "CRITICAL"
      : workOrders.length >= 2 || repeatSignalCount > 0 || urgentWorkOrderCount > 0 || delayedWorkOrderCount > 0 || openWorkOrderCount > 0
        ? "WATCH"
        : "NORMAL";
  return {
    id: input.id,
    normalizedNo: input.normalizedNo ?? "",
    equipmentNo: input.equipmentNo ?? "",
    placementNo: input.placementNo ?? "",
    customerName: input.customer?.name ?? "미지정",
    siteName: input.site?.name ?? input.location ?? "미지정",
    manufacturer: input.manufacturer ?? "",
    powerType: input.powerType ?? "",
    kind: input.kind ?? "",
    status: input.status ?? "",
    managerName: input.managerName ?? "",
    location: input.location ?? input.site?.name ?? "",
    operationType: input.operationType ?? "",
    spec: input.spec ?? "",
    tonnage: input.tonnage ?? "",
    maker: input.maker ?? "",
    modelName: input.modelName ?? "",
    serialNo: input.serialNo ?? "",
    year: input.year ?? "",
    operatingHours: input.operatingHours ?? "",
    vehicleRegistrationNo: input.vehicleRegistrationNo ?? "",
    workOrderCount: workOrders.length,
    openWorkOrderCount,
    completedWorkOrderCount,
    urgentWorkOrderCount,
    delayedWorkOrderCount,
    repeatSignalCount,
    riskLevel,
    recommendation: recommendationFor(riskLevel),
    lastWorkOrderAt: workOrders[0]?.requestDate ? new Date(workOrders[0].requestDate).toISOString() : null,
    lastFaultDescription: workOrders[0]?.faultDescription ?? "",
    lastActionTaken: workOrders[0]?.actionTaken ?? workOrders[0]?.diagnosisResult ?? "",
    recentWorkOrders: workOrders.slice(0, 5).map((row) => ({
      id: row.id,
      requestNo: row.requestNo,
      requestDate: new Date(row.requestDate).toISOString(),
      faultDescription: row.faultDescription,
      priorityLevel: row.priorityLevel,
      status: row.status,
      assignedMechanicName: row.assignedMechanic?.name ?? ""
    }))
  };
}

function recommendationFor(riskLevel: string) {
  if (riskLevel === "CRITICAL") return "교체/폐각 또는 대수선 검토";
  if (riskLevel === "WATCH") return "정밀점검 및 예방정비 강화";
  return "일반 관리";
}

function isClosedStatus(status: string) {
  return ["FINAL_COMPLETED", "ARCHIVED", "CANCELLED"].includes(status);
}

function dateValue(value: string | Date) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}
