import { EquipmentType, PriorityLevel, RoleCode, WorkOrderStatus } from "@prisma/client";

type DemoUser = {
  id: string;
  loginId: string;
  name: string;
  title?: string;
  team?: string;
  phone?: string;
  email?: string;
  password: string;
  roles: RoleCode[];
  mustChangePassword: boolean;
  isActive: boolean;
};

type DemoStore = {
  users: DemoUser[];
  workOrders: any[];
  auditLogs: any[];
};

const globalForDemo = globalThis as unknown as { demoStore?: DemoStore };

function publicUser(user: DemoUser) {
  return {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    title: user.title,
    team: user.team,
    phone: user.phone,
    email: user.email,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    roles: user.roles.map((code) => ({
      role: {
        code,
        name:
          code === RoleCode.SUPER_ADMIN
            ? "최고 관리자"
            : code === RoleCode.ADMIN
              ? "관리자"
              : code === RoleCode.MECHANIC
                ? "정비사"
                : code === RoleCode.RECEPTIONIST
                  ? "접수자"
                  : "임원/대표"
      }
    }))
  };
}

function makeStore(): DemoStore {
  const mechanic = {
    id: "demo-mechanic-1",
    loginId: "jegal.ts",
    name: "제갈태수",
    title: "책임",
    team: "정비팀",
    phone: "010-3871-5725",
    password: "ChangeMe!2026",
    roles: [RoleCode.MECHANIC],
    mustChangePassword: true,
    isActive: true
  };
  return {
    users: [
      {
        id: "demo-super-admin",
        loginId: "ko.ms",
        name: "고민서",
        title: "책임",
        team: "관리자",
        phone: "010-9360-7590",
        password: "Admin!2026Test",
        roles: [RoleCode.SUPER_ADMIN, RoleCode.ADMIN],
        mustChangePassword: false,
        isActive: true
      },
      mechanic
    ],
    workOrders: [
      {
        id: "demo-work-order-1",
        requestNo: "20260608-001",
        customer: { id: "demo-customer-1", name: "태성이엔지" },
        site: { id: "demo-site-1", name: "CYL 도장물류" },
        equipment: {
          id: "demo-equipment-290",
          normalizedNo: "290",
          equipmentNo: "CFO25-0290",
          placementNo: "태성-290",
          modelName: "GTS25DE",
          serialNo: "GTS232D15859820KF",
          tonnage: "2.5T",
          maker: "클라크",
          vehicleRegistrationNo: "경남04노6321",
          customer: { name: "태성이엔지" },
          site: { name: "CYL 도장물류" }
        },
        equipmentInput: "290호기",
        equipmentNoNormalized: "290",
        requestDate: "2026-06-08T00:00:00.000Z",
        requestedAt: "2026-06-08T01:00:00.000Z",
        contactPhone: "010-2625-0987",
        faultDescription: "시동안걸림-지금은 점프해서 사용중(와서 점검은 해달라고 합니다)",
        equipmentType: EquipmentType.RENTAL,
        priorityLevel: PriorityLevel.P1,
        status: WorkOrderStatus.ASSIGNED,
        targetDueDate: "2026-06-08T00:00:00.000Z",
        assignedMechanic: { id: mechanic.id, name: mechanic.name, title: mechanic.title, phone: mechanic.phone },
        comments: [],
        reports: [],
        workOrderAttachments: [],
        targetChangeRequests: [],
        statusHistories: [],
        assignmentHistories: []
      }
    ],
    auditLogs: []
  };
}

export function demoStore() {
  globalForDemo.demoStore ??= makeStore();
  return globalForDemo.demoStore;
}

export function demoLogin(loginId: string, password: string) {
  const user = demoStore().users.find((row) => row.loginId === loginId && row.password === password && row.isActive);
  if (!user) return null;
  return {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    roles: user.roles,
    mustChangePassword: user.mustChangePassword
  };
}

export function demoUsers() {
  return demoStore().users.map(publicUser);
}

export function demoCreateUser(input: {
  loginId: string;
  name: string;
  title?: string;
  team?: string;
  phone?: string;
  email?: string;
  roleCodes: RoleCode[];
  temporaryPassword: string;
}) {
  const store = demoStore();
  const user: DemoUser = {
    id: `demo-user-${Date.now()}`,
    loginId: input.loginId,
    name: input.name,
    title: input.title,
    team: input.team,
    phone: input.phone,
    email: input.email,
    password: input.temporaryPassword,
    roles: input.roleCodes,
    mustChangePassword: true,
    isActive: true
  };
  store.users.push(user);
  store.auditLogs.unshift({ id: `demo-audit-${Date.now()}`, action: "admin.user.create", targetType: "user", targetId: user.id, createdAt: new Date().toISOString() });
  return publicUser(user);
}

export function demoDashboardSummary() {
  const rows = demoStore().workOrders;
  const completed = rows.filter((row) => row.status === WorkOrderStatus.FINAL_COMPLETED).length;
  const pending = rows.filter((row) => row.status !== WorkOrderStatus.FINAL_COMPLETED).length;
  const urgent = rows.filter((row) => row.priorityLevel === PriorityLevel.P1 && row.status !== WorkOrderStatus.FINAL_COMPLETED).length;
  return {
    total: rows.length,
    completed,
    pending,
    delayed: 0,
    planned: 0,
    urgent,
    completionRate: rows.length ? Math.round((completed / rows.length) * 100) : 0
  };
}

export function demoWorkOrders() {
  return demoStore().workOrders;
}

export function demoEquipmentLookup(keyword: string) {
  const normalized = keyword.match(/\d+/)?.[0] ?? keyword;
  const equipment = demoStore().workOrders[0]?.equipment;
  return {
    keyword,
    normalized,
    equipment: normalized === "290" ? equipment : null,
    duplicateCandidates: normalized === "290" ? demoStore().workOrders : []
  };
}

export function demoMechanicKpi() {
  return demoStore().users
    .filter((user) => user.roles.includes(RoleCode.MECHANIC))
    .map((user) => ({
      id: user.id,
      name: user.name,
      title: user.title ?? "",
      assigned: demoStore().workOrders.filter((row) => row.assignedMechanic?.id === user.id).length,
      completed: 0,
      temporaryActions: 0,
      pending: demoStore().workOrders.filter((row) => row.assignedMechanic?.id === user.id).length,
      delayed: 0,
      p1Completed: 0,
      targetComplianceRate: 0
    }));
}

export function demoPriorityKpi() {
  return [PriorityLevel.P1, PriorityLevel.P2, PriorityLevel.P3, PriorityLevel.OUTSOURCE, PriorityLevel.UNSET].map((priority) => {
    const rows = demoStore().workOrders.filter((row) => row.priorityLevel === priority);
    return { priority, received: rows.length, completed: 0, pending: rows.length, delayed: 0 };
  });
}
