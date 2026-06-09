import { NextRequest } from "next/server";
import { PriorityLevel, RoleCode, WorkOrderStatus, EquipmentType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, created, handleApiError, ok, parseDateInput, readJson, startOfLocalDate } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoCreateWorkOrder, demoWorkOrders } from "@/lib/demo";
import {
  findDuplicateCandidates,
  findEquipmentByKeyword,
  generateRequestNo,
  nextStatusAfterCreate,
  normalizeEquipmentKeyword,
  targetDateForPriority,
  workOrderInclude
} from "@/lib/work-orders";

const createSchema = z.object({
  customerName: z.string().min(1),
  siteName: z.string().min(1).optional(),
  equipmentInput: z.string().min(1),
  requestDate: z.string().min(1),
  contactPhone: z.string().optional(),
  faultCategoryId: z.string().optional(),
  faultCategoryName: z.string().optional(),
  faultDescription: z.string().min(1),
  equipmentType: z.nativeEnum(EquipmentType).default(EquipmentType.RENTAL),
  priorityLevel: z.nativeEnum(PriorityLevel).default(PriorityLevel.UNSET),
  assignedMechanicId: z.string().optional(),
  targetDueDate: z.string().optional(),
  memo: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    if (appEnv.demoMode) return ok(await demoWorkOrders());
    const params = request.nextUrl.searchParams;
    const status = params.get("status") as WorkOrderStatus | null;
    const priority = params.get("priority") as PriorityLevel | null;
    const mechanicId = params.get("mechanicId");
    const search = params.get("search");
    const delayed = params.get("delayed");

    const where = {
      archivedAt: null,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(priority ? { priorityLevel: priority } : {}),
      ...(mechanicId ? { assignedMechanicId: mechanicId } : {}),
      ...(delayed === "true" ? { OR: [{ isDelayed: true }, { status: WorkOrderStatus.DELAYED }] } : {}),
      ...(search
        ? {
            OR: [
              { requestNo: { contains: search, mode: "insensitive" as const } },
              { equipmentInput: { contains: search, mode: "insensitive" as const } },
              { equipmentNoNormalized: { contains: search, mode: "insensitive" as const } },
              { faultDescription: { contains: search, mode: "insensitive" as const } },
              { customer: { name: { contains: search, mode: "insensitive" as const } } },
              { site: { name: { contains: search, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };

    const rows = await prisma.workOrder.findMany({
      where,
      include: workOrderInclude,
      orderBy: [{ priorityLevel: "asc" }, { requestDate: "desc" }, { createdAt: "desc" }],
      take: 200
    });
    return ok(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN, RoleCode.RECEPTIONIST]);
    const input = await readJson(request, createSchema);
    if (appEnv.demoMode) {
      const row = await demoCreateWorkOrder(input);
      return created({ workOrder: row, duplicateCandidates: [] });
    }
    const requestDate = startOfLocalDate(input.requestDate);
    const equipment = await findEquipmentByKeyword(input.equipmentInput);
    const normalized = equipment?.normalizedNo ?? normalizeEquipmentKeyword(input.equipmentInput);

    const customer = await prisma.customer.upsert({
      where: { name: input.customerName },
      update: {},
      create: { name: input.customerName }
    });

    const siteName = input.siteName ?? equipment?.site?.name ?? input.customerName;
    const site = await prisma.site.upsert({
      where: { customerId_name: { customerId: customer.id, name: siteName } },
      update: {},
      create: { customerId: customer.id, name: siteName }
    });

    const faultCategory = input.faultCategoryId
      ? await prisma.faultCategory.findUnique({ where: { id: input.faultCategoryId } })
      : input.faultCategoryName
        ? await prisma.faultCategory.upsert({
            where: { name: input.faultCategoryName },
            update: {},
            create: { name: input.faultCategoryName, sortOrder: 999 }
          })
        : null;

    const assignedMechanicId = input.assignedMechanicId ?? site.defaultMechanicId ?? undefined;
    const status = nextStatusAfterCreate(Boolean(assignedMechanicId));
    const targetDueDate =
      parseDateInput(input.targetDueDate) ?? targetDateForPriority(input.priorityLevel, requestDate);

    const row = await prisma.workOrder.create({
      data: {
        requestNo: await generateRequestNo(requestDate),
        customerId: customer.id,
        siteId: site.id,
        equipmentId: equipment?.id,
        equipmentNoNormalized: normalized,
        equipmentInput: input.equipmentInput,
        requestDate,
        contactPhone: input.contactPhone,
        faultCategoryId: faultCategory?.id,
        faultDescription: input.faultDescription,
        equipmentType: input.equipmentType,
        priorityLevel: input.priorityLevel,
        status,
        assignedMechanicId,
        targetDueDate,
        createdById: user.id,
        updatedById: user.id,
        memo: input.memo,
        statusHistories: {
          create: { toStatus: status, reason: "접수 등록", changedById: user.id }
        },
        assignmentHistories: assignedMechanicId
          ? { create: { assignedMechanicId, changedById: user.id, reason: "자동 추천/초기 배정" } }
          : undefined
      },
      include: workOrderInclude
    });

    if (input.priorityLevel === PriorityLevel.P1) {
      const recipients = await prisma.user.findMany({
        where: { isActive: true, roles: { some: { role: { code: { in: [RoleCode.ADMIN, RoleCode.MECHANIC] } } } } },
        select: { id: true }
      });
      await prisma.notification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.id,
          workOrderId: row.id,
          type: "PRIORITY_URGENT",
          title: "우선순위 #1 긴급 접수",
          body: `${row.requestNo} ${input.customerName} ${input.equipmentInput}`
        }))
      });
    }

    const duplicates = await findDuplicateCandidates(normalized, input.faultDescription);
    await auditLog({ user, request, action: "work_order.create", targetType: "workOrder", targetId: row.id, after: row });
    return created({ workOrder: row, duplicateCandidates: duplicates.filter((candidate) => candidate.id !== row.id) });
  } catch (error) {
    return handleApiError(error);
  }
}
