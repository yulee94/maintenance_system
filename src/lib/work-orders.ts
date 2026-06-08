import { format } from "date-fns";
import { Prisma, PriorityLevel, WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export const workOrderInclude = {
  customer: true,
  site: true,
  equipment: true,
  faultCategory: true,
  assignedMechanic: {
    select: { id: true, name: true, title: true, phone: true, team: true }
  },
  outsourceVendor: true,
  reports: {
    orderBy: { submittedAt: "desc" as const },
    include: { attachments: true, mechanic: { select: { id: true, name: true } } }
  },
  comments: {
    orderBy: { createdAt: "desc" as const },
    include: { author: { select: { id: true, name: true, title: true } } }
  },
  workOrderAttachments: true,
  targetChangeRequests: {
    orderBy: { createdAt: "desc" as const },
    include: {
      requestedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } }
    }
  },
  statusHistories: { orderBy: { createdAt: "desc" as const } },
  assignmentHistories: { orderBy: { createdAt: "desc" as const } }
} satisfies Prisma.WorkOrderInclude;

export function normalizeEquipmentKeyword(input: string) {
  const trimmed = input.trim();
  const numeric = trimmed.match(/\d+/)?.[0];
  return numeric ?? trimmed.replace(/\s+/g, "").replace(/^#/, "");
}

export async function generateRequestNo(date = new Date()) {
  const prefix = format(date, "yyyyMMdd");
  const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const end = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + 1));
  const count = await prisma.workOrder.count({
    where: {
      requestDate: {
        gte: start,
        lt: end
      }
    }
  });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

export async function findEquipmentByKeyword(keyword: string) {
  const normalized = normalizeEquipmentKeyword(keyword);
  return prisma.equipment.findFirst({
    where: {
      OR: [
        { normalizedNo: normalized },
        { klRegistration: normalized },
        { equipmentNo: { contains: normalized, mode: "insensitive" } },
        { placementNo: { contains: normalized, mode: "insensitive" } },
        { vehicleRegistrationNo: { contains: normalized, mode: "insensitive" } },
        { serialNo: { contains: normalized, mode: "insensitive" } }
      ]
    },
    include: { customer: true, site: true }
  });
}

export async function findDuplicateCandidates(equipmentNoNormalized: string, faultDescription: string) {
  const significantWords = faultDescription
    .split(/[\s,./-]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .slice(0, 5);

  return prisma.workOrder.findMany({
    where: {
      equipmentNoNormalized,
      status: {
        notIn: [WorkOrderStatus.FINAL_COMPLETED, WorkOrderStatus.ARCHIVED, WorkOrderStatus.CANCELLED]
      },
      OR: significantWords.length
        ? significantWords.map((word) => ({ faultDescription: { contains: word, mode: "insensitive" as const } }))
        : undefined
    },
    include: workOrderInclude,
    orderBy: { createdAt: "desc" },
    take: 5
  });
}

export function targetDateForPriority(priority: PriorityLevel, requestDate: Date) {
  if (priority === PriorityLevel.P1) {
    return new Date(Date.UTC(requestDate.getFullYear(), requestDate.getMonth(), requestDate.getDate()));
  }
  return undefined;
}

export function nextStatusAfterCreate(hasAssignment: boolean) {
  return hasAssignment ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.UNASSIGNED;
}

export function mediaTypeForMime(mimeType: string) {
  if (mimeType.startsWith("image/")) return "IMAGE" as const;
  if (mimeType.startsWith("video/")) return "VIDEO" as const;
  return "FILE" as const;
}
