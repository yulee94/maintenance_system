import {
  EquipmentType,
  PriorityLevel,
  RoleCode,
  WorkOrderStatus,
  WorkResultType
} from "@prisma/client";

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

const globalForDemo = globalThis as unknown as { demoStore?: DemoStore };

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

function makeStore(): DemoStore {
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

  const [superAdmin, executive, admin, receptionist, jegal, jung, kimYh, kimJb, leeSj] = users;
  const workOrders: DemoWorkOrder[] = [
    {
      id: "demo-work-order-001",
      requestNo: "20260608-001",
      customer: { id: "demo-customer-taesung", name: "태성이엔지" },
      site: { id: "demo-site-taesung-cyl", name: "CYL 도장물류" },
      equipment: makeEquipment("290", "태성이엔지", "CYL 도장물류", "GTS25DE", "GTS232D15859820KF"),
      equipmentInput: "290호기",
      equipmentNoNormalized: "290",
      requestDate: day(0, 8),
      requestedAt: day(0, 8),
      contactPhone: "010-2625-0987",
      faultDescription: "시동은 걸리지만 지게차 사용 중 간헐적으로 출력이 떨어짐",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.P1,
      status: WorkOrderStatus.ASSIGNED,
      targetDueDate: day(0, 18),
      assignedMechanic: userRef(jegal),
      resultType: WorkResultType.UNKNOWN,
      memo: "오전 중 현장 진입 가능",
      comments: [{ id: "demo-comment-001", body: "현장 담당자와 10시에 통화 완료", createdAt: day(0, 9), author: userRef(receptionist) }],
      reports: [],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-002",
      requestNo: "20260608-002",
      customer: { id: "demo-customer-mir", name: "미르푸드" },
      site: { id: "demo-site-mir-cold", name: "냉동창고 B동" },
      equipment: makeEquipment("118", "미르푸드", "냉동창고 B동", "D25S-9", "DS9B11877341", "3.0T"),
      equipmentInput: "118",
      equipmentNoNormalized: "118",
      requestDate: day(0, 9),
      requestedAt: day(0, 9),
      contactPhone: "010-4511-1039",
      faultDescription: "유압 라인 누유, 팔레트 상차 중 오일 자국 발생",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.P1,
      status: WorkOrderStatus.IN_PROGRESS,
      targetDueDate: day(0, 17),
      assignedMechanic: userRef(jung),
      resultType: WorkResultType.UNKNOWN,
      memo: "냉동창고 작업으로 안전장비 지참",
      comments: [{ id: "demo-comment-002", body: "부품차량 동행 필요", createdAt: day(0, 10), author: userRef(admin) }],
      reports: [],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-003",
      requestNo: "20260607-004",
      customer: { id: "demo-customer-samwon", name: "삼원테크" },
      site: { id: "demo-site-samwon-a", name: "A동 출하장" },
      equipment: makeEquipment("041", "삼원테크", "A동 출하장", "CPCD30", "CP30A0419921", "3.0T"),
      equipmentInput: "041호",
      equipmentNoNormalized: "041",
      requestDate: day(-1, 13),
      requestedAt: day(-1, 13),
      contactPhone: "010-7781-2204",
      faultDescription: "브레이크 밀림 증상, 경사로 정차 시 위험",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.P2,
      status: WorkOrderStatus.REPORT_SUBMITTED,
      targetDueDate: day(0, 12),
      assignedMechanic: userRef(kimYh),
      resultType: WorkResultType.COMPLETED,
      diagnosisResult: "브레이크 오일 부족 및 라이닝 편마모 확인",
      actionTaken: "브레이크 오일 보충, 라이닝 조정, 시운전 완료",
      mechanicReportedAt: day(0, 11),
      memo: "관리자 최종 승인 대기",
      comments: [],
      reports: [
        {
          id: "demo-report-003",
          resultType: WorkResultType.COMPLETED,
          diagnosisResult: "브레이크 오일 부족 및 라이닝 편마모 확인",
          actionTaken: "브레이크 오일 보충, 라이닝 조정, 시운전 완료",
          submittedAt: day(0, 11)
        }
      ],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-004",
      requestNo: "20260607-003",
      customer: { id: "demo-customer-donghae", name: "동해물류" },
      site: { id: "demo-site-donghae-main", name: "1창고 상차장" },
      equipment: makeEquipment("503", "동해물류", "1창고 상차장", "HDF25", "HDF5037712"),
      equipmentInput: "503",
      equipmentNoNormalized: "503",
      requestDate: day(-1, 10),
      requestedAt: day(-1, 10),
      contactPhone: "010-9033-1288",
      faultDescription: "배터리 단자 접촉 불량으로 시동 지연",
      equipmentType: EquipmentType.CUSTOMER_OWNED,
      priorityLevel: PriorityLevel.P2,
      status: WorkOrderStatus.FINAL_COMPLETED,
      targetDueDate: day(-1, 18),
      assignedMechanic: userRef(jegal),
      resultType: WorkResultType.COMPLETED,
      diagnosisResult: "배터리 단자 산화 및 고정 불량",
      actionTaken: "단자 세척, 터미널 교체, 충전 전압 확인",
      mechanicReportedAt: day(-1, 15),
      adminApprovedAt: day(-1, 16),
      finalCompletedAt: day(-1, 16),
      memo: "고객 확인 서명 완료",
      comments: [],
      reports: [
        {
          id: "demo-report-004",
          resultType: WorkResultType.COMPLETED,
          diagnosisResult: "배터리 단자 산화 및 고정 불량",
          actionTaken: "단자 세척, 터미널 교체, 충전 전압 확인",
          submittedAt: day(-1, 15)
        }
      ],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-005",
      requestNo: "20260606-006",
      customer: { id: "demo-customer-daehan", name: "대한제지" },
      site: { id: "demo-site-daehan-2", name: "2공장 원지창고" },
      equipment: makeEquipment("075", "대한제지", "2공장 원지창고", "FD25T", "FD25T0755580"),
      equipmentInput: "075호기",
      equipmentNoNormalized: "075",
      requestDate: day(-2, 14),
      requestedAt: day(-2, 14),
      contactPhone: "010-5779-2200",
      faultDescription: "월간 예방점검, 마스트 체인 장력 확인 요청",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.P3,
      status: WorkOrderStatus.ASSIGNED,
      targetDueDate: day(2, 16),
      assignedMechanic: userRef(kimJb),
      resultType: WorkResultType.UNKNOWN,
      memo: "정기점검 대상",
      comments: [],
      reports: [],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-006",
      requestNo: "20260606-005",
      customer: { id: "demo-customer-seojin", name: "서진케미칼" },
      site: { id: "demo-site-seojin", name: "혼합동" },
      equipment: makeEquipment("620", "서진케미칼", "혼합동", "E30H", "E30H6205570", "3.0T"),
      equipmentInput: "620 전동",
      equipmentNoNormalized: "620",
      requestDate: day(-2, 11),
      requestedAt: day(-2, 11),
      contactPhone: "010-6772-3301",
      faultDescription: "인버터 경고등 점등, 제조사 점검 필요",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.OUTSOURCE,
      status: WorkOrderStatus.ON_HOLD,
      targetDueDate: day(3, 12),
      assignedMechanic: userRef(leeSj),
      resultType: WorkResultType.UNKNOWN,
      memo: "외주 업체 일정 조율 중",
      comments: [{ id: "demo-comment-006", body: "현대서비스 6월 11일 방문 예정", createdAt: day(-1, 17), author: userRef(admin) }],
      reports: [],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-007",
      requestNo: "20260605-007",
      customer: { id: "demo-customer-haesol", name: "해솔화학" },
      site: { id: "demo-site-haesol", name: "원료창고" },
      equipment: makeEquipment("311", "해솔화학", "원료창고", "GTS30D", "GTS3119918", "3.0T"),
      equipmentInput: "311",
      equipmentNoNormalized: "311",
      requestDate: day(-3, 16),
      requestedAt: day(-3, 16),
      contactPhone: "010-4491-8872",
      faultDescription: "냉각수 누수 재발, 야간작업 전 조치 필요",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.P1,
      status: WorkOrderStatus.DELAYED,
      targetDueDate: day(-1, 18),
      assignedMechanic: userRef(kimYh),
      resultType: WorkResultType.UNKNOWN,
      isDelayed: true,
      memo: "고객 생산 일정으로 작업 지연",
      comments: [{ id: "demo-comment-007", body: "부품 입고 확인 후 재방문", createdAt: day(-1, 10), author: userRef(kimYh) }],
      reports: [],
      workOrderAttachments: [],
      targetChangeRequests: [
        {
          id: "demo-target-007",
          currentDate: day(-1, 18),
          requestedDate: day(1, 14),
          reason: "부품 입고 지연",
          status: "REQUESTED",
          createdAt: day(0, 9)
        }
      ],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-008",
      requestNo: "20260605-003",
      customer: { id: "demo-customer-woorim", name: "우림패키지" },
      site: { id: "demo-site-woorim", name: "완제품 창고" },
      equipment: makeEquipment("222", "우림패키지", "완제품 창고", "CPCD25", "CP25A2223310"),
      equipmentInput: "222호",
      equipmentNoNormalized: "222",
      requestDate: day(-3, 9),
      requestedAt: day(-3, 9),
      contactPhone: "010-8802-5520",
      faultDescription: "경음기 미작동 및 후방등 교체",
      equipmentType: EquipmentType.CUSTOMER_OWNED,
      priorityLevel: PriorityLevel.P3,
      status: WorkOrderStatus.FINAL_COMPLETED,
      targetDueDate: day(-2, 18),
      assignedMechanic: userRef(jung),
      resultType: WorkResultType.COMPLETED,
      diagnosisResult: "후방등 배선 단선, 경음기 릴레이 접점 불량",
      actionTaken: "배선 보수, 릴레이 교체, 작동 확인",
      mechanicReportedAt: day(-2, 11),
      adminApprovedAt: day(-2, 13),
      finalCompletedAt: day(-2, 13),
      comments: [],
      reports: [
        {
          id: "demo-report-008",
          resultType: WorkResultType.COMPLETED,
          diagnosisResult: "후방등 배선 단선, 경음기 릴레이 접점 불량",
          actionTaken: "배선 보수, 릴레이 교체, 작동 확인",
          submittedAt: day(-2, 11)
        }
      ],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-009",
      requestNo: "20260604-008",
      customer: { id: "demo-customer-ace", name: "에이스전자" },
      site: { id: "demo-site-ace", name: "SMT 라인" },
      equipment: makeEquipment("087", "에이스전자", "SMT 라인", "BR20S", "BR20S0871300", "2.0T"),
      equipmentInput: "087 리치",
      equipmentNoNormalized: "087",
      requestDate: day(-4, 15),
      requestedAt: day(-4, 15),
      contactPhone: "010-5532-4490",
      faultDescription: "조향 센서 오류, 부품 재고 확인 필요",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.P2,
      status: WorkOrderStatus.PART_WAITING,
      targetDueDate: day(1, 18),
      assignedMechanic: userRef(leeSj),
      resultType: WorkResultType.UNKNOWN,
      memo: "센서 입고 대기",
      comments: [],
      reports: [],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-010",
      requestNo: "20260608-003",
      customer: { id: "demo-customer-saebit", name: "새빛산업" },
      site: { id: "demo-site-saebit", name: "신규 임대 현장" },
      equipment: makeEquipment("144", "새빛산업", "신규 임대 현장", "GTS25D", "GTS1447720"),
      equipmentInput: "144",
      equipmentNoNormalized: "144",
      requestDate: day(0, 11),
      requestedAt: day(0, 11),
      contactPhone: "010-6013-1144",
      faultDescription: "신규 접수: 시동 직후 경고등 점등, 배정 대기",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.P2,
      status: WorkOrderStatus.UNASSIGNED,
      targetDueDate: day(1, 18),
      assignedMechanic: null,
      resultType: WorkResultType.UNKNOWN,
      memo: "관리자 배정 필요",
      comments: [],
      reports: [],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-011",
      requestNo: "20260607-009",
      customer: { id: "demo-customer-kumkang", name: "금강철강" },
      site: { id: "demo-site-kumkang", name: "절단라인" },
      equipment: makeEquipment("019", "금강철강", "절단라인", "FD30T", "FD30T0191290", "3.0T"),
      equipmentInput: "019",
      equipmentNoNormalized: "019",
      requestDate: day(-1, 16),
      requestedAt: day(-1, 16),
      contactPhone: "010-7366-2002",
      faultDescription: "마스트 상승 불량, 임시 조치 후 재방문 필요",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.P1,
      status: WorkOrderStatus.REPORT_SUBMITTED,
      targetDueDate: day(0, 18),
      assignedMechanic: userRef(jegal),
      resultType: WorkResultType.TEMPORARY_ACTION,
      diagnosisResult: "리프트 실린더 씰 마모 의심",
      actionTaken: "누유 부위 세척 및 임시 보강, 씰 키트 교체 필요",
      mechanicReportedAt: day(0, 14),
      memo: "관리자 승인 시 임시 조치 KPI로 분류",
      comments: [],
      reports: [
        {
          id: "demo-report-011",
          resultType: WorkResultType.TEMPORARY_ACTION,
          diagnosisResult: "리프트 실린더 씰 마모 의심",
          actionTaken: "누유 부위 세척 및 임시 보강, 씰 키트 교체 필요",
          submittedAt: day(0, 14)
        }
      ],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    },
    {
      id: "demo-work-order-012",
      requestNo: "20260606-010",
      customer: { id: "demo-customer-koreacold", name: "한국냉장" },
      site: { id: "demo-site-koreacold", name: "제2냉동동" },
      equipment: makeEquipment("655", "한국냉장", "제2냉동동", "E20R", "E20R6557712", "2.0T"),
      equipmentInput: "655",
      equipmentNoNormalized: "655",
      requestDate: day(-2, 17),
      requestedAt: day(-2, 17),
      contactPhone: "010-3189-6500",
      faultDescription: "주행 중 소음 발생, 베어링 점검 요청",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.P3,
      status: WorkOrderStatus.ASSIGNED,
      targetDueDate: day(4, 12),
      assignedMechanic: userRef(leeSj),
      resultType: WorkResultType.UNKNOWN,
      comments: [],
      reports: [],
      workOrderAttachments: [],
      targetChangeRequests: [],
      statusHistories: [],
      assignmentHistories: []
    }
  ];

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

export function demoAuditLogs() {
  return demoStore().auditLogs;
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
  audit(store, "admin.user.create", "user", user.id, publicUser(user));
  return publicUser(user);
}

export function demoDashboardSummary() {
  const rows = demoStore().workOrders;
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

export function demoWorkOrders() {
  const store = demoStore();
  for (const row of store.workOrders) {
    row.approvalLine ??= makeDemoApprovalLine(row, store);
  }
  return store.workOrders;
}

export function demoCreateWorkOrder(input: {
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
  const store = demoStore();
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

export function demoEquipmentLookup(keyword: string) {
  const normalized = normalizeEquipmentKeyword(keyword);
  const rows = demoStore().workOrders.filter(
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

export function demoAssignWorkOrder(id: string, assignedMechanicId: string) {
  const store = demoStore();
  const row = findWorkOrder(id);
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

export function demoStartWorkOrder(id: string) {
  const store = demoStore();
  const row = findWorkOrder(id);
  row.status = WorkOrderStatus.IN_PROGRESS;
  row.statusHistories.unshift({ id: `demo-status-${Date.now()}`, toStatus: row.status, reason: "작업 시작", createdAt: new Date().toISOString() });
  audit(store, "work_order.start", "workOrder", row.id, row);
  return row;
}

export function demoSubmitReport(
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
  const store = demoStore();
  const row = findWorkOrder(id);
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

export function demoSetApprovalLine(id: string, input: { adminApproverId?: string; executiveApproverId?: string }) {
  const store = demoStore();
  const row = findWorkOrder(id);
  const admin = store.users.find((user) => user.id === input.adminApproverId) ?? store.users.find((user) => user.loginId === "ko.ms");
  const executive = store.users.find((user) => user.id === input.executiveApproverId) ?? store.users.find((user) => user.loginId === "kim.ms");
  row.approvalLine = makeDemoApprovalLine(row, store, admin, executive);
  audit(store, "work_order.approval_line", "workOrder", row.id, row.approvalLine);
  return row;
}

export function demoApproveWorkOrder(
  id: string,
  input?: { memo?: string; kpiExcluded?: boolean; kpiExclusionReason?: string },
  actor?: { id: string; name: string; roles: RoleCode[] }
) {
  const store = demoStore();
  const row = findWorkOrder(id);
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

export function demoRejectWorkOrder(id: string, reason: string) {
  const store = demoStore();
  const row = findWorkOrder(id);
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

export function demoUpdateTarget(id: string, targetDueDate: string, reason?: string) {
  const store = demoStore();
  const row = findWorkOrder(id);
  const oldDate = row.targetDueDate;
  row.targetDueDate = new Date(targetDueDate).toISOString();
  row.targetChangeRequests.unshift({
    id: `demo-target-history-${Date.now()}`,
    oldDate,
    newDate: row.targetDueDate,
    reason: reason ?? "관리자 target 지정",
    status: "APPROVED",
    createdAt: new Date().toISOString()
  });
  audit(store, "work_order.target", "workOrder", row.id, row);
  return row;
}

export function demoTargetChangeRequest(id: string, requestedDate: string, reason: string) {
  const store = demoStore();
  const row = findWorkOrder(id);
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

export function demoMechanicKpi() {
  const rows = demoStore().workOrders;
  return demoStore().users
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

export function demoPriorityKpi() {
  return [PriorityLevel.P1, PriorityLevel.P2, PriorityLevel.P3, PriorityLevel.OUTSOURCE, PriorityLevel.UNSET].map((priority) => {
    const rows = demoStore().workOrders.filter((row) => row.priorityLevel === priority);
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

function findWorkOrder(id: string) {
  const row = demoStore().workOrders.find((workOrder) => workOrder.id === id);
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
