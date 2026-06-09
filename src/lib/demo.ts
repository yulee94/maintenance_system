import {
  EquipmentType,
  PriorityLevel,
  RoleCode,
  WorkOrderStatus,
  WorkResultType
} from "@prisma/client";
import {
  type DailyStatusTemplateRow,
  numberFromEquipmentText,
  pick,
  readDailyStatusRows,
  readMasterListRows
} from "@/lib/excel";

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

type DemoEquipment = {
  id: string;
  normalizedNo: string;
  equipmentNo: string;
  placementNo: string;
  modelName: string;
  serialNo: string;
  tonnage: string;
  maker: string;
  vehicleRegistrationNo: string;
  customer: { name: string };
  site: { name: string };
};

export type DemoApprovalStep = {
  id: string;
  role: "MECHANIC" | "ADMIN" | "EXECUTIVE";
  label: string;
  approverId?: string | null;
  approverName?: string | null;
  approverTitle?: string | null;
  status: "NOT_STARTED" | "PENDING" | "APPROVED" | "REJECTED";
  requestedAt?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  approvedByName?: string | null;
  memo?: string | null;
};

type DemoWorkOrder = {
  id: string;
  requestNo: string;
  customer: { id: string; name: string };
  site: { id: string; name: string };
  equipment: DemoEquipment;
  equipmentInput: string;
  equipmentNoNormalized: string;
  requestDate: string;
  requestedAt: string;
  contactPhone: string;
  faultDescription: string;
  equipmentType: EquipmentType;
  priorityLevel: PriorityLevel;
  status: WorkOrderStatus;
  targetDueDate: string | null;
  assignedMechanic: { id: string; name: string; title?: string; phone?: string } | null;
  resultType: WorkResultType;
  diagnosisResult?: string | null;
  actionTaken?: string | null;
  memo?: string | null;
  mechanicReportedAt?: string | null;
  adminApprovedAt?: string | null;
  finalCompletedAt?: string | null;
  approvalLine?: DemoApprovalStep[] | null;
  isDelayed?: boolean;
  comments: { id: string; body: string; createdAt: string; author?: { name: string } | null }[];
  reports: {
    id: string;
    resultType: WorkResultType;
    diagnosisResult: string;
    actionTaken: string;
    submittedAt: string;
  }[];
  workOrderAttachments: unknown[];
  targetChangeRequests: unknown[];
  statusHistories: unknown[];
  assignmentHistories: unknown[];
};

type DemoStore = {
  users: DemoUser[];
  workOrders: DemoWorkOrder[];
  auditLogs: Record<string, unknown>[];
};

const globalForDemo = globalThis as unknown as { demoStore?: Promise<DemoStore> };

const roleName: Record<RoleCode, string> = {
  SUPER_ADMIN: "최고 관리자",
  ADMIN: "관리자",
  MECHANIC: "정비사",
  RECEPTIONIST: "접수자",
  EXECUTIVE: "임원/대표"
};

const baseDate = new Date("2026-06-08T00:00:00.000+09:00");

function day(offset: number, hour = 9) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

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
        name: roleName[code]
      }
    }))
  };
}

function userRef(user: DemoUser) {
  return {
    id: user.id,
    name: user.name,
    title: user.title,
    phone: user.phone
  };
}

function normalizeEquipmentKeyword(keyword: string) {
  return keyword.match(/\d+/)?.[0] ?? keyword.trim();
}

function makeEquipment(
  normalizedNo: string,
  customerName: string,
  siteName: string,
  modelName: string,
  serialNo: string,
  tonnage = "2.5T"
): DemoEquipment {
  return {
    id: `demo-equipment-${normalizedNo}`,
    normalizedNo,
    equipmentNo: `CFO25-${normalizedNo.padStart(4, "0")}`,
    placementNo: `${customerName.slice(0, 2)}-${normalizedNo}`,
    modelName,
    serialNo,
    tonnage,
    maker: normalizedNo.startsWith("5") ? "현대" : "클라크",
    vehicleRegistrationNo: `경남04고${normalizedNo.padStart(4, "0")}`,
    customer: { name: customerName },
    site: { name: siteName }
  };
}

function audit(store: DemoStore, action: string, targetType: string, targetId?: string, after?: unknown) {
  store.auditLogs.unshift({
    id: `demo-audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    action,
    targetType,
    targetId,
    after,
    createdAt: new Date().toISOString(),
    actor: { name: "데모 시스템", loginId: "demo" }
  });
}

async function buildTemplateWorkOrders(users: DemoUser[], dailyRows: DailyStatusTemplateRow[]): Promise<DemoWorkOrder[]> {
  const masterRows = await readMasterListRows().catch(() => []);
  const masterByNo = new Map<string, Record<string, string>>();
  const masterBySerial = new Map<string, Record<string, string>>();
  for (const row of masterRows) {
    const normalizedNo = numberFromEquipmentText(pick(row, ["K&L 등록", "No.", "배치No", "장비 No"]));
    if (normalizedNo) masterByNo.set(normalizedNo, row);
    const serialNo = pick(row, ["차대번호"]);
    if (serialNo) masterBySerial.set(normalizeLookup(serialNo), row);
  }

  return dailyRows.map((row, index) => {
    const equipmentCode = normalizeTemplateEquipment(row.equipmentInput);
    const equipmentDigits = numberFromEquipmentText(row.equipmentInput);
    const master = masterByNo.get(equipmentCode) ?? masterByNo.get(equipmentDigits) ?? masterBySerial.get(normalizeLookup(row.serialNo));
    const priorityLevel = priorityFromTemplate(row.priorityText);
    const status = statusFromTemplate(row, priorityLevel);
    const requestDate = toTemplateDateTime(row.requestDate, 9) ?? day(-4, 9);
    const targetDueDate = toTemplateDateTime(row.targetDueDate, 18);
    const completedAt = toTemplateDateTime(row.completedAt, 17);
    const mechanic = row.mechanicName ? users.find((user) => user.name === row.mechanicName) : undefined;
    const assignedMechanic = mechanic ? userRef(mechanic) : null;
    const actionTaken = row.actionTaken || (status === WorkOrderStatus.FINAL_COMPLETED ? "템플릿 완료 처리" : "");
    const diagnosisResult = row.memo || row.actionTaken || "";
    const isCompleted = status === WorkOrderStatus.FINAL_COMPLETED;
    const isTemplateDelayed = status === WorkOrderStatus.DELAYED || Boolean(targetDueDate && new Date(targetDueDate).getTime() < baseDate.getTime() && !completedAt);

    return {
      id: `template-work-order-${row.sourceRow}`,
      requestNo: `${compactDate(row.requestDate)}-${String(row.sourceRow).padStart(3, "0")}`,
      customer: { id: stableId("template-customer", row.customerName), name: row.customerName },
      site: { id: stableId("template-site", `${row.customerName}-${pick(master ?? {}, ["배치장소"]) || row.customerName}`), name: pick(master ?? {}, ["배치장소"]) || row.customerName },
      equipment: {
        id: `template-equipment-${equipmentCode || row.sourceRow}`,
        normalizedNo: equipmentCode || equipmentDigits || row.equipmentInput,
        equipmentNo: pick(master ?? {}, ["장비 No"]) || row.equipmentInput,
        placementNo: pick(master ?? {}, ["배치No"]) || row.equipmentInput,
        modelName: pick(master ?? {}, ["모델명"]) || row.modelName,
        serialNo: pick(master ?? {}, ["차대번호"]) || row.serialNo,
        tonnage: pick(master ?? {}, ["톤수"]),
        maker: pick(master ?? {}, ["제작처"]),
        vehicleRegistrationNo: pick(master ?? {}, ["차량등록 No."]),
        customer: { name: pick(master ?? {}, ["사업장", "계약처"]) || row.customerName },
        site: { name: pick(master ?? {}, ["배치장소"]) || row.customerName }
      },
      equipmentInput: row.equipmentInput,
      equipmentNoNormalized: equipmentCode || equipmentDigits || row.equipmentInput,
      requestDate,
      requestedAt: requestDate,
      contactPhone: "",
      faultDescription: row.faultDescription,
      equipmentType: EquipmentType.RENTAL,
      priorityLevel,
      status,
      targetDueDate,
      assignedMechanic,
      resultType: isCompleted ? WorkResultType.COMPLETED : WorkResultType.UNKNOWN,
      diagnosisResult,
      actionTaken,
      memo: row.memo || templateSourceMemo(row),
      mechanicReportedAt: isCompleted ? completedAt : null,
      adminApprovedAt: isCompleted ? completedAt : null,
      finalCompletedAt: isCompleted ? completedAt : null,
      isDelayed: isTemplateDelayed,
      comments: row.memo
        ? [{ id: `template-comment-${row.sourceRow}`, body: row.memo, createdAt: requestDate, author: { name: "템플릿" } }]
        : [],
      reports: isCompleted
        ? [
            {
              id: `template-report-${row.sourceRow}`,
              resultType: WorkResultType.COMPLETED,
              diagnosisResult: diagnosisResult || row.faultDescription,
              actionTaken,
              submittedAt: completedAt ?? requestDate
            }
          ]
        : [],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    };
  });
}

function addTemplateMechanicUsers(users: DemoUser[], rows: DailyStatusTemplateRow[]) {
  const existing = new Set(users.map((user) => user.name));
  const names = Array.from(new Set(rows.map((row) => row.mechanicName.trim()).filter(Boolean)));
  names.forEach((name, index) => {
    if (existing.has(name)) return;
    users.push({
      id: stableId("template-mechanic", name),
      loginId: `template.mech.${String(index + 1).padStart(2, "0")}`,
      name,
      title: "정비사",
      team: "템플릿 정비팀",
      password: "Mech!2026Test",
      roles: [RoleCode.MECHANIC],
      mustChangePassword: false,
      isActive: true
    });
    existing.add(name);
  });
}

function normalizeTemplateEquipment(value: string) {
  const cleaned = value.replace(/^#+/, "").replace(/호기?|관리/g, "").trim();
  return cleaned || numberFromEquipmentText(value);
}

function normalizeLookup(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function compactDate(value: string) {
  return value.replace(/\D/g, "").slice(0, 8) || "20260605";
}

function stableId(prefix: string, value: string) {
  const hex = Buffer.from(value || prefix, "utf8").toString("hex").slice(0, 24);
  return `${prefix}-${hex || "unknown"}`;
}

function toTemplateDateTime(value: string, hour: number) {
  const date = parseTemplateDate(value);
  if (!date) return null;
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function parseTemplateDate(value: string) {
  const match = value.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function priorityFromTemplate(value: string) {
  if (/외주/.test(value)) return PriorityLevel.OUTSOURCE;
  if (/#?\s*1/.test(value)) return PriorityLevel.P1;
  if (/#?\s*2/.test(value)) return PriorityLevel.P2;
  if (/#?\s*3/.test(value)) return PriorityLevel.P3;
  return PriorityLevel.UNSET;
}

function statusFromTemplate(row: DailyStatusTemplateRow, priorityLevel: PriorityLevel) {
  if (row.completedAt) return WorkOrderStatus.FINAL_COMPLETED;
  if (priorityLevel === PriorityLevel.OUTSOURCE || /외주|창원중기|삼성중기|현승정비/.test(row.memo)) return WorkOrderStatus.ON_HOLD;
  if (!row.mechanicName) return WorkOrderStatus.UNASSIGNED;
  if (/부품|배터리|수리\s*대기|대기중|입고/.test(row.memo)) return WorkOrderStatus.PART_WAITING;
  const targetDate = parseTemplateDate(row.targetDueDate);
  if (targetDate && targetDate.getTime() < baseDate.getTime()) return WorkOrderStatus.DELAYED;
  return WorkOrderStatus.ASSIGNED;
}

function templateSourceMemo(row: DailyStatusTemplateRow) {
  return `${row.section === "pending" ? "미결 목록" : "일일 진행업무"} · 구분 ${row.category} · 템플릿 행 ${row.sourceRow}`;
}

async function makeStore(): Promise<DemoStore> {
  const users: DemoUser[] = [
    {
      id: "demo-super-admin",
      loginId: "ko.ms",
      name: "고민서",
      title: "책임",
      team: "관리자",
      phone: "010-9360-7590",
      email: "ko.ms@example.com",
      password: "Admin!2026Test",
      roles: [RoleCode.SUPER_ADMIN, RoleCode.ADMIN],
      mustChangePassword: false,
      isActive: true
    },
    {
      id: "demo-executive",
      loginId: "kim.ms",
      name: "김민식",
      title: "전무",
      team: "임원",
      phone: "010-8520-5984",
      email: "kim.ms@example.com",
      password: "Exec!2026Test",
      roles: [RoleCode.EXECUTIVE],
      mustChangePassword: false,
      isActive: true
    },
    {
      id: "demo-admin",
      loginId: "son.hn",
      name: "손화나",
      title: "선임",
      team: "접수/관리",
      phone: "010-8388-8356",
      email: "son.hn@example.com",
      password: "Admin2!2026Test",
      roles: [RoleCode.ADMIN, RoleCode.RECEPTIONIST],
      mustChangePassword: false,
      isActive: true
    },
    {
      id: "demo-receptionist",
      loginId: "park.jw",
      name: "박지우",
      title: "매니저",
      team: "접수",
      phone: "010-2244-8877",
      email: "park.jw@example.com",
      password: "Reception!2026",
      roles: [RoleCode.RECEPTIONIST],
      mustChangePassword: false,
      isActive: true
    },
    {
      id: "demo-mechanic-1",
      loginId: "jegal.ts",
      name: "제갈태수",
      title: "책임",
      team: "정비1팀",
      phone: "010-3871-5725",
      email: "jegal.ts@example.com",
      password: "Mech!2026Test",
      roles: [RoleCode.MECHANIC],
      mustChangePassword: false,
      isActive: true
    },
    {
      id: "demo-mechanic-2",
      loginId: "jung.mg",
      name: "정민규",
      title: "책임",
      team: "정비1팀",
      phone: "010-8694-9887",
      email: "jung.mg@example.com",
      password: "Mech!2026Test",
      roles: [RoleCode.MECHANIC],
      mustChangePassword: false,
      isActive: true
    },
    {
      id: "demo-mechanic-3",
      loginId: "kim.yh",
      name: "김용현",
      title: "선임",
      team: "정비2팀",
      phone: "010-3934-1429",
      email: "kim.yh@example.com",
      password: "Mech!2026Test",
      roles: [RoleCode.MECHANIC],
      mustChangePassword: false,
      isActive: true
    },
    {
      id: "demo-mechanic-4",
      loginId: "kim.jb",
      name: "김진봉",
      title: "매니저",
      team: "예방점검팀",
      phone: "010-3558-5593",
      email: "kim.jb@example.com",
      password: "Mech!2026Test",
      roles: [RoleCode.MECHANIC],
      mustChangePassword: false,
      isActive: true
    },
    {
      id: "demo-mechanic-5",
      loginId: "lee.sj",
      name: "이승준",
      title: "매니저",
      team: "예방점검팀",
      phone: "010-4029-4341",
      email: "lee.sj@example.com",
      password: "Mech!2026Test",
      roles: [RoleCode.MECHANIC],
      mustChangePassword: false,
      isActive: true
    }
  ];

  const templateRows = await readDailyStatusRows().catch(() => []);
  addTemplateMechanicUsers(users, templateRows);
  const [superAdmin, executive, admin, receptionist] = users;
  const templateWorkOrders = await buildTemplateWorkOrders(users, templateRows);
  const workOrders = templateWorkOrders;
  const store = {
    users,
    workOrders,
    auditLogs: [
      {
        id: "demo-audit-seed",
        action: "demo.seed",
        targetType: "system",
        createdAt: day(0, 7),
        actor: userRef(superAdmin),
        after: { users: users.length, workOrders: workOrders.length, executive: executive.loginId }
      }
    ]
  };
  audit(store, "admin.user.review", "user", admin.id, { receptionist: receptionist.loginId });
  return store;
}

export async function demoStore() {
  globalForDemo.demoStore ??= makeStore();
  return globalForDemo.demoStore;
}

export async function demoLogin(loginId: string, password: string) {
  const store = await demoStore();
  const user = store.users.find((row) => row.loginId === loginId && row.password === password && row.isActive);
  if (!user) return null;
  return {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    roles: user.roles,
    mustChangePassword: user.mustChangePassword
  };
}

export async function demoUsers() {
  const store = await demoStore();
  return store.users.map(publicUser);
}

export async function demoAuditLogs() {
  const store = await demoStore();
  return store.auditLogs;
}

export async function demoCreateUser(input: {
  loginId: string;
  name: string;
  title?: string;
  team?: string;
  phone?: string;
  email?: string;
  roleCodes: RoleCode[];
  temporaryPassword: string;
}) {
  const store = await demoStore();
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
  audit(store, "admin.user.create", "user", user.id, publicUser(user));
  return publicUser(user);
}

export async function demoDashboardSummary() {
  const store = await demoStore();
  const rows = store.workOrders;
  const closedStatuses: WorkOrderStatus[] = [WorkOrderStatus.ARCHIVED, WorkOrderStatus.CANCELLED];
  const plannedStatuses: WorkOrderStatus[] = [
    WorkOrderStatus.ASSIGNED,
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.PART_WAITING,
    WorkOrderStatus.ON_HOLD
  ];
  const activeRows = rows.filter((row) => !closedStatuses.includes(row.status));
  const completed = activeRows.filter((row) => row.status === WorkOrderStatus.FINAL_COMPLETED).length;
  const pending = activeRows.filter((row) => row.status !== WorkOrderStatus.FINAL_COMPLETED).length;
  const urgent = activeRows.filter((row) => row.priorityLevel === PriorityLevel.P1 && row.status !== WorkOrderStatus.FINAL_COMPLETED).length;
  const delayed = activeRows.filter(isDelayed).length;
  const planned = activeRows.filter((row) => plannedStatuses.includes(row.status)).length;
  return {
    total: activeRows.length,
    completed,
    pending,
    delayed,
    planned,
    urgent,
    completionRate: activeRows.length ? Math.round((completed / activeRows.length) * 100) : 0
  };
}

export async function demoWorkOrders() {
  const store = await demoStore();
  for (const row of store.workOrders) {
    row.approvalLine ??= makeDemoApprovalLine(row, store);
  }
  return store.workOrders;
}

export async function demoCreateWorkOrder(input: {
  customerName: string;
  siteName?: string;
  equipmentInput: string;
  requestDate: string;
  contactPhone?: string;
  faultDescription: string;
  equipmentType: EquipmentType;
  priorityLevel: PriorityLevel;
  targetDueDate?: string;
  memo?: string;
}) {
  const store = await demoStore();
  const normalized = normalizeEquipmentKeyword(input.equipmentInput);
  const existingEquipment = store.workOrders.find((row) => row.equipmentNoNormalized === normalized)?.equipment;
  const targetDueDate = input.targetDueDate
    ? new Date(input.targetDueDate).toISOString()
    : input.priorityLevel === PriorityLevel.P1
      ? day(0, 18)
      : input.priorityLevel === PriorityLevel.P2
        ? day(1, 18)
        : day(4, 18);
  const row: DemoWorkOrder = {
    id: `demo-work-order-${Date.now()}`,
    requestNo: `${input.requestDate.replaceAll("-", "")}-${String(store.workOrders.length + 1).padStart(3, "0")}`,
    customer: { id: `demo-customer-${Date.now()}`, name: input.customerName },
    site: { id: `demo-site-${Date.now()}`, name: input.siteName ?? input.customerName },
    equipment:
      existingEquipment ??
      makeEquipment(normalized, input.customerName, input.siteName ?? input.customerName, "GTS25D", `DEMO${normalized}${Date.now().toString().slice(-4)}`),
    equipmentInput: input.equipmentInput,
    equipmentNoNormalized: normalized,
    requestDate: new Date(input.requestDate).toISOString(),
    requestedAt: new Date().toISOString(),
    contactPhone: input.contactPhone ?? "",
    faultDescription: input.faultDescription,
    equipmentType: input.equipmentType,
    priorityLevel: input.priorityLevel,
    status: WorkOrderStatus.UNASSIGNED,
    targetDueDate,
    assignedMechanic: null,
    resultType: WorkResultType.UNKNOWN,
    memo: input.memo,
    comments: [],
    reports: [],
    workOrderAttachments: [],
    targetChangeRequests: [],
    statusHistories: [],
    assignmentHistories: []
  };
  store.workOrders.unshift(row);
  audit(store, "work_order.create", "workOrder", row.id, row);
  return row;
}

export async function demoEquipmentLookup(keyword: string) {
  const normalized = normalizeEquipmentKeyword(keyword);
  const store = await demoStore();
  const rows = store.workOrders.filter(
    (row) =>
      row.equipmentNoNormalized === normalized ||
      row.equipment.normalizedNo === normalized ||
      row.equipmentInput.includes(normalized)
  );
  return {
    keyword,
    normalized,
    equipment: rows[0]?.equipment ?? null,
    duplicateCandidates: rows
  };
}

export async function demoAssignWorkOrder(id: string, assignedMechanicId: string) {
  const store = await demoStore();
  const row = findWorkOrder(store, id);
  const mechanic = store.users.find((user) => user.id === assignedMechanicId);
  if (!mechanic) return null;
  row.assignedMechanic = userRef(mechanic);
  const assignableStatuses: WorkOrderStatus[] = [WorkOrderStatus.RECEIVED, WorkOrderStatus.UNASSIGNED];
  if (assignableStatuses.includes(row.status)) {
    row.status = WorkOrderStatus.ASSIGNED;
  }
  row.assignmentHistories.unshift({
    id: `demo-assignment-${Date.now()}`,
    assignedMechanic: row.assignedMechanic,
    createdAt: new Date().toISOString(),
    reason: "관리자 배정"
  });
  audit(store, "work_order.assign", "workOrder", row.id, row);
  return row;
}

export async function demoStartWorkOrder(id: string) {
  const store = await demoStore();
  const row = findWorkOrder(store, id);
  row.status = WorkOrderStatus.IN_PROGRESS;
  row.statusHistories.unshift({ id: `demo-status-${Date.now()}`, toStatus: row.status, reason: "작업 시작", createdAt: new Date().toISOString() });
  audit(store, "work_order.start", "workOrder", row.id, row);
  return row;
}

export async function demoSubmitReport(
  id: string,
  input: {
    resultType: WorkResultType;
    diagnosisResult: string;
    actionTaken: string;
    incompleteReason?: string;
    temporaryFollowupDueDate?: string;
    temporaryFollowupContent?: string;
  }
) {
  const store = await demoStore();
  const row = findWorkOrder(store, id);
  const report = {
    id: `demo-report-${Date.now()}`,
    resultType: input.resultType,
    diagnosisResult: input.diagnosisResult,
    actionTaken: input.actionTaken,
    submittedAt: new Date().toISOString()
  };
  row.status = WorkOrderStatus.REPORT_SUBMITTED;
  row.resultType = input.resultType;
  row.diagnosisResult = input.diagnosisResult;
  row.actionTaken = input.actionTaken;
  row.mechanicReportedAt = report.submittedAt;
  row.reports.unshift(report);
  row.approvalLine = makeDemoApprovalLine(row, store);
  row.statusHistories.unshift({ id: `demo-status-${Date.now()}`, toStatus: row.status, reason: "완료보고 제출", createdAt: report.submittedAt });
  audit(store, "work_order.report", "workReport", report.id, report);
  return { report, workOrder: row };
}

export async function demoSetApprovalLine(id: string, input: { adminApproverId?: string; executiveApproverId?: string }) {
  const store = await demoStore();
  const row = findWorkOrder(store, id);
  const admin = store.users.find((user) => user.id === input.adminApproverId) ?? store.users.find((user) => user.loginId === "ko.ms");
  const executive = store.users.find((user) => user.id === input.executiveApproverId) ?? store.users.find((user) => user.loginId === "kim.ms");
  row.approvalLine = makeDemoApprovalLine(row, store, admin, executive);
  audit(store, "work_order.approval_line", "workOrder", row.id, row.approvalLine);
  return row;
}

export async function demoApproveWorkOrder(
  id: string,
  input?: { memo?: string; kpiExcluded?: boolean; kpiExclusionReason?: string },
  actor?: { id: string; name: string; roles: RoleCode[] }
) {
  const store = await demoStore();
  const row = findWorkOrder(store, id);
  row.approvalLine ??= makeDemoApprovalLine(row, store);
  markMechanicStep(row);
  const step = row.approvalLine.find((item) => item.status === "PENDING" && item.role !== "MECHANIC");
  if (step) {
    const roles = actor?.roles ?? [];
    const isAssignedApprover = !step.approverId || step.approverId === actor?.id;
    const canApprove =
      roles.includes(RoleCode.SUPER_ADMIN) ||
      (step.role === "ADMIN" && roles.includes(RoleCode.ADMIN)) ||
      (step.role === "EXECUTIVE" && roles.includes(RoleCode.EXECUTIVE));
    if (!canApprove || (!roles.includes(RoleCode.SUPER_ADMIN) && !isAssignedApprover)) {
      throw new Error("해당 결재 순서를 승인할 권한이 없습니다.");
    }
    step.status = "APPROVED";
    step.approvedAt = new Date().toISOString();
    step.approvedById = actor?.id ?? step.approverId;
    step.approvedByName = actor?.name ?? step.approverName;
    step.memo = input?.memo ?? step.memo;
    if (step.role === "ADMIN") row.adminApprovedAt = step.approvedAt;
  }
  unlockNextStep(row);
  const allApproved = row.approvalLine.filter((item) => item.role !== "MECHANIC").every((item) => item.status === "APPROVED");
  if (!allApproved) {
    row.status = WorkOrderStatus.ADMIN_REVIEW;
    row.memo = input?.memo ?? row.memo;
    row.statusHistories.unshift({ id: `demo-status-${Date.now()}`, toStatus: row.status, reason: "결재 진행", createdAt: new Date().toISOString() });
    audit(store, "work_order.approve_step", "workOrder", row.id, row);
    return row;
  }
  const finalCompleted = row.resultType === WorkResultType.COMPLETED;
  row.status = finalCompleted ? WorkOrderStatus.FINAL_COMPLETED : WorkOrderStatus.TEMPORARY_ACTION;
  row.adminApprovedAt ??= new Date().toISOString();
  row.finalCompletedAt = finalCompleted ? row.adminApprovedAt : null;
  row.memo = input?.memo ?? row.memo;
  row.statusHistories.unshift({ id: `demo-status-${Date.now()}`, toStatus: row.status, reason: "관리자 승인", createdAt: row.adminApprovedAt });
  audit(store, "work_order.approve", "workOrder", row.id, row);
  return row;
}

export async function demoRejectWorkOrder(id: string, reason: string) {
  const store = await demoStore();
  const row = findWorkOrder(store, id);
  row.status = WorkOrderStatus.REJECTED;
  row.comments.unshift({
    id: `demo-comment-${Date.now()}`,
    body: `반려: ${reason}`,
    createdAt: new Date().toISOString(),
    author: { name: "관리자" }
  });
  row.statusHistories.unshift({ id: `demo-status-${Date.now()}`, toStatus: row.status, reason, createdAt: new Date().toISOString() });
  audit(store, "work_order.reject", "workOrder", row.id, row);
  return row;
}

export async function demoUpdateTarget(id: string, targetDueDate: string, reason?: string) {
  const store = await demoStore();
  const row = findWorkOrder(store, id);
  const oldDate = row.targetDueDate;
  row.targetDueDate = new Date(targetDueDate).toISOString();
  row.targetChangeRequests.unshift({
    id: `demo-target-history-${Date.now()}`,
    oldDate,
    newDate: row.targetDueDate,
    reason: reason ?? "관리자 목표일 지정",
    status: "APPROVED",
    createdAt: new Date().toISOString()
  });
  audit(store, "work_order.target", "workOrder", row.id, row);
  return row;
}

export async function demoTargetChangeRequest(id: string, requestedDate: string, reason: string) {
  const store = await demoStore();
  const row = findWorkOrder(store, id);
  const request = {
    id: `demo-target-request-${Date.now()}`,
    currentDate: row.targetDueDate,
    requestedDate: new Date(requestedDate).toISOString(),
    reason,
    status: "REQUESTED",
    createdAt: new Date().toISOString()
  };
  row.targetChangeRequests.unshift(request);
  audit(store, "work_order.target_change_request", "targetChangeRequest", request.id, request);
  return request;
}

export async function demoMechanicKpi() {
  const store = await demoStore();
  const rows = store.workOrders;
  return store.users
    .filter((user) => user.roles.includes(RoleCode.MECHANIC))
    .map((user) => {
      const assignedRows = rows.filter((row) => row.assignedMechanic?.id === user.id);
      const completedRows = assignedRows.filter((row) => row.status === WorkOrderStatus.FINAL_COMPLETED);
      const targetMetRows = completedRows.filter(isTargetMet);
      return {
        id: user.id,
        name: user.name,
        title: user.title ?? "",
        assigned: assignedRows.length,
        completed: completedRows.length,
        temporaryActions: assignedRows.filter((row) => row.resultType === WorkResultType.TEMPORARY_ACTION || row.status === WorkOrderStatus.TEMPORARY_ACTION).length,
        pending: assignedRows.filter((row) => row.status !== WorkOrderStatus.FINAL_COMPLETED).length,
        delayed: assignedRows.filter(isDelayed).length,
        p1Completed: completedRows.filter((row) => row.priorityLevel === PriorityLevel.P1).length,
        targetComplianceRate: completedRows.length ? Math.round((targetMetRows.length / completedRows.length) * 100) : 0
      };
    });
}

export async function demoPriorityKpi() {
  const store = await demoStore();
  return [PriorityLevel.P1, PriorityLevel.P2, PriorityLevel.P3, PriorityLevel.OUTSOURCE, PriorityLevel.UNSET].map((priority) => {
    const rows = store.workOrders.filter((row) => row.priorityLevel === priority);
    const completed = rows.filter((row) => row.status === WorkOrderStatus.FINAL_COMPLETED).length;
    const pending = rows.filter((row) => row.status !== WorkOrderStatus.FINAL_COMPLETED).length;
    const delayed = rows.filter(isDelayed).length;
    return {
      priority,
      received: rows.length,
      completed,
      pending,
      delayed,
      completionRate: rows.length ? Math.round((completed / rows.length) * 100) : 0
    };
  });
}

function findWorkOrder(store: DemoStore, id: string) {
  const row = store.workOrders.find((workOrder) => workOrder.id === id);
  if (!row) throw new Error("Demo work order not found.");
  return row;
}

function makeDemoApprovalLine(row: DemoWorkOrder, store: DemoStore, adminUser?: DemoUser, executiveUser?: DemoUser): DemoApprovalStep[] {
  const admin = adminUser ?? store.users.find((user) => user.loginId === "ko.ms");
  const executive = executiveUser ?? store.users.find((user) => user.loginId === "kim.ms");
  const mechanicDone = Boolean(row.mechanicReportedAt || row.reports.length);
  const adminDone = Boolean(row.adminApprovedAt || row.finalCompletedAt);
  const finalDone = Boolean(row.finalCompletedAt);
  return [
    {
      id: "mechanic-report",
      role: "MECHANIC",
      label: "정비사 완료보고",
      approverId: row.assignedMechanic?.id,
      approverName: row.assignedMechanic?.name ?? "미배정",
      approverTitle: row.assignedMechanic?.title,
      status: mechanicDone ? "APPROVED" : "PENDING",
      requestedAt: row.requestedAt,
      approvedAt: row.mechanicReportedAt ?? null,
      approvedById: row.assignedMechanic?.id,
      approvedByName: row.assignedMechanic?.name
    },
    {
      id: "admin-approval",
      role: "ADMIN",
      label: "관리자 승인",
      approverId: admin?.id,
      approverName: admin ? `${admin.name} ${admin.title ?? ""}`.trim() : "고민서 책임",
      approverTitle: admin?.title,
      status: adminDone ? "APPROVED" : mechanicDone ? "PENDING" : "NOT_STARTED",
      requestedAt: row.mechanicReportedAt ?? null,
      approvedAt: row.adminApprovedAt ?? null,
      approvedById: adminDone ? admin?.id : null,
      approvedByName: adminDone ? admin?.name : null
    },
    {
      id: "executive-approval",
      role: "EXECUTIVE",
      label: "임원 최종승인",
      approverId: executive?.id,
      approverName: executive ? `${executive.name} ${executive.title ?? ""}`.trim() : "김민식 전무",
      approverTitle: executive?.title,
      status: finalDone ? "APPROVED" : adminDone ? "PENDING" : "NOT_STARTED",
      requestedAt: row.adminApprovedAt ?? null,
      approvedAt: row.finalCompletedAt ?? null,
      approvedById: finalDone ? executive?.id : null,
      approvedByName: finalDone ? executive?.name : null
    }
  ];
}

function markMechanicStep(row: DemoWorkOrder) {
  const mechanic = row.approvalLine?.find((item) => item.role === "MECHANIC");
  if (mechanic && (row.mechanicReportedAt || row.reports.length)) {
    mechanic.status = "APPROVED";
    mechanic.approvedAt = row.mechanicReportedAt ?? mechanic.approvedAt ?? new Date().toISOString();
    mechanic.approvedById = row.assignedMechanic?.id;
    mechanic.approvedByName = row.assignedMechanic?.name;
  }
}

function unlockNextStep(row: DemoWorkOrder) {
  const mechanic = row.approvalLine?.find((item) => item.role === "MECHANIC");
  const admin = row.approvalLine?.find((item) => item.role === "ADMIN");
  const executive = row.approvalLine?.find((item) => item.role === "EXECUTIVE");
  if (admin?.status === "NOT_STARTED" && mechanic?.status === "APPROVED") {
    admin.status = "PENDING";
    admin.requestedAt = row.mechanicReportedAt ?? new Date().toISOString();
  }
  if (executive?.status === "NOT_STARTED" && admin?.status === "APPROVED") {
    executive.status = "PENDING";
    executive.requestedAt = admin.approvedAt ?? new Date().toISOString();
  }
}

function isDelayed(row: DemoWorkOrder) {
  if (row.isDelayed || row.status === WorkOrderStatus.DELAYED) return true;
  if (!row.targetDueDate || row.status === WorkOrderStatus.FINAL_COMPLETED) return false;
  return new Date(row.targetDueDate).getTime() < baseDate.getTime();
}

function isTargetMet(row: DemoWorkOrder) {
  if (!row.targetDueDate || !row.finalCompletedAt) return false;
  return new Date(row.finalCompletedAt).getTime() <= new Date(row.targetDueDate).getTime();
}
