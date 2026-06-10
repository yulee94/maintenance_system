"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Gauge,
  KeyRound,
  Languages,
  Lock,
  LogOut,
  Monitor,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Shield,
  Smartphone,
  Upload,
  UserCog,
  Users,
  Wrench,
  XCircle
} from "lucide-react";
import { api, patchJson, postJson } from "@/lib/client-api";
import {
  DEFAULT_LOCALE,
  LOCALE_OPTIONS,
  LOCALE_STORAGE_KEY,
  htmlLangFor,
  normalizeLocale,
  translate,
  type LocaleCode
} from "@/lib/i18n";

type AuthUser = {
  id: string;
  loginId: string;
  name: string;
  roles: string[];
  mustChangePassword: boolean;
};

type Summary = {
  total: number;
  completed: number;
  pending: number;
  delayed: number;
  planned: number;
  urgent: number;
  completionRate: number;
};

type WorkOrder = {
  id: string;
  requestNo: string;
  requestDate: string;
  equipmentInput?: string | null;
  equipmentNoNormalized?: string | null;
  faultDescription: string;
  priorityLevel: "P1" | "P2" | "P3" | "OUTSOURCE" | "UNSET";
  status: string;
  targetDueDate?: string | null;
  contactPhone?: string | null;
  actionTaken?: string | null;
  diagnosisResult?: string | null;
  memo?: string | null;
  resultType?: string | null;
  mechanicReportedAt?: string | null;
  adminApprovedAt?: string | null;
  finalCompletedAt?: string | null;
  approvalLine?: ApprovalStep[] | null;
  isDelayed?: boolean;
  customer?: { id: string; name: string } | null;
  site?: { id: string; name: string } | null;
  equipment?: {
    modelName?: string | null;
    serialNo?: string | null;
    tonnage?: string | null;
    maker?: string | null;
    vehicleRegistrationNo?: string | null;
    equipmentNo?: string | null;
    placementNo?: string | null;
    customer?: { name: string } | null;
    site?: { name: string } | null;
  } | null;
  assignedMechanic?: { id: string; name: string; title?: string | null; phone?: string | null } | null;
  comments?: { id: string; body: string; createdAt: string; author?: { name: string } | null }[];
  reports?: {
    id: string;
    resultType: string;
    diagnosisResult: string;
    actionTaken: string;
    submittedAt: string;
    attachments?: WorkReportAttachment[];
  }[];
  targetChangeRequests?: Record<string, unknown>[];
};

type WorkReportAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  mediaType: "IMAGE" | "VIDEO" | "FILE";
  stage?: AttachmentStage;
  sizeBytes: number;
  publicPath?: string | null;
  createdAt: string;
};

type AttachmentStage = "BEFORE" | "DURING" | "AFTER" | "REPORT";

type ReportUploadFile = {
  id: string;
  file: File;
  stage: AttachmentStage;
};

type ReportSubmitResponse = {
  report: {
    id: string;
  };
  workOrder: WorkOrder;
};

type DailyPlanStatus = "DRAFT" | "REQUESTED" | "APPROVED" | "REJECTED" | "FINAL_CONFIRMED";

type DailyWorkPlanItem = {
  id: string;
  planId: string;
  workOrderId: string;
  mechanicId?: string | null;
  orderIndex: number;
  adminMemo?: string | null;
  mechanicMemo?: string | null;
  createdAt: string;
  workOrder: WorkOrder;
  mechanic?: { id: string; name: string; title?: string | null } | null;
};

type DailyWorkPlan = {
  id: string;
  planDate: string;
  status: DailyPlanStatus;
  requestedById?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewMemo?: string | null;
  createdAt: string;
  updatedAt: string;
  requestedBy?: { id: string; name: string; title?: string | null } | null;
  reviewedBy?: { id: string; name: string; title?: string | null } | null;
  items: DailyWorkPlanItem[];
};

type EquipmentAsset = {
  id: string;
  normalizedNo?: string | null;
  equipmentNo?: string | null;
  placementNo?: string | null;
  customerName: string;
  siteName: string;
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
  workOrderCount: number;
  openWorkOrderCount: number;
  completedWorkOrderCount: number;
  urgentWorkOrderCount: number;
  delayedWorkOrderCount: number;
  repeatSignalCount: number;
  riskLevel: "CRITICAL" | "WATCH" | "NORMAL";
  recommendation: string;
  lastWorkOrderAt?: string | null;
  lastFaultDescription?: string | null;
  lastActionTaken?: string | null;
  recentWorkOrders: {
    id: string;
    requestNo: string;
    requestDate: string;
    faultDescription: string;
    priorityLevel: string;
    status: string;
    assignedMechanicName?: string | null;
  }[];
};

type ApprovalStep = {
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

type UserRow = {
  id: string;
  loginId: string;
  name: string;
  title?: string | null;
  team?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  roles: { role: { code: string; name: string } }[];
};

type LookupResult = {
  normalized: string;
  equipment?: WorkOrder["equipment"] | null;
  duplicateCandidates: WorkOrder[];
};

type SelectOption = {
  value: string;
  label: string;
};

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "최고 관리자",
  ADMIN: "관리자",
  EXECUTIVE: "임원",
  MECHANIC: "정비사",
  RECEPTIONIST: "접수자"
};

const statusLabel: Record<string, string> = {
  RECEIVED: "접수",
  UNASSIGNED: "미배정",
  ASSIGNED: "배정",
  IN_PROGRESS: "작업중",
  REPORT_SUBMITTED: "보고 대기",
  ADMIN_REVIEW: "관리자 검토",
  FINAL_COMPLETED: "최종 완료",
  REJECTED: "반려",
  ON_HOLD: "보류",
  DELAYED: "지연",
  TEMPORARY_ACTION: "임시 조치",
  PART_WAITING: "부품 대기",
  EQUIPMENT_IN_USE: "장비 사용중",
  REVISIT_REQUIRED: "재방문 필요",
  ARCHIVED: "보관",
  CANCELLED: "취소"
};

const priorityLabel: Record<WorkOrder["priorityLevel"], string> = {
  P1: "긴급",
  P2: "중요",
  P3: "일반",
  OUTSOURCE: "외주",
  UNSET: "미지정"
};

const resultLabel: Record<string, string> = {
  COMPLETED: "완료",
  TEMPORARY_ACTION: "임시 조치",
  INCOMPLETE: "미완료",
  REVISIT_REQUIRED: "재방문 필요",
  UNKNOWN: "미정"
};

const priorityClass: Record<WorkOrder["priorityLevel"], string> = {
  P1: "p1",
  P2: "p2",
  P3: "p3",
  OUTSOURCE: "outsource",
  UNSET: ""
};

const priorityChip: Record<WorkOrder["priorityLevel"], string> = {
  P1: "red",
  P2: "amber",
  P3: "green",
  OUTSOURCE: "blue",
  UNSET: ""
};

const resultOptions: SelectOption[] = [
  { value: "COMPLETED", label: "완료" },
  { value: "TEMPORARY_ACTION", label: "임시 조치" },
  { value: "INCOMPLETE", label: "미완료" },
  { value: "REVISIT_REQUIRED", label: "재방문 필요" }
];

const attachmentStageOptions: { value: AttachmentStage; label: string }[] = [
  { value: "BEFORE", label: "정비 전" },
  { value: "DURING", label: "정비 중" },
  { value: "AFTER", label: "정비 후" },
  { value: "REPORT", label: "일반 보고" }
];

const priorityOptions: SelectOption[] = [
  { value: "P1", label: "P1 긴급" },
  { value: "P2", label: "P2 중요" },
  { value: "P3", label: "P3 일반" },
  { value: "OUTSOURCE", label: "외주" },
  { value: "UNSET", label: "미지정" }
];

const demoAccounts = [
  {
    label: "최고관리자",
    name: "고민서 책임",
    loginId: "ko.ms",
    password: "Admin!2026Test",
    note: "계정 생성, 권한 부여, 승인까지 전체 관리"
  },
  {
    label: "임원",
    name: "김민식 전무",
    loginId: "kim.ms",
    password: "Exec!2026Test",
    note: "전체 현황, 지연, KPI 중심 보고"
  },
  {
    label: "관리자",
    name: "손화나 선임",
    loginId: "son.hn",
    password: "Admin2!2026Test",
    note: "접수, 배정, 승인, 감사로그"
  },
  {
    label: "정비사",
    name: "제갈태수 책임",
    loginId: "jegal.ts",
    password: "Mech!2026Test",
    note: "내 배정 업무와 완료보고"
  },
  {
    label: "접수자",
    name: "박지우 매니저",
    loginId: "park.jw",
    password: "Reception!2026",
    note: "신규 정비 접수와 중복 조회"
  }
];

const tabs = [
  { id: "planning", labelKey: "nav.planning", label: "계획업무", icon: CalendarDays, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "MECHANIC", "EXECUTIVE"]) },
  { id: "dashboard", labelKey: "nav.dashboard", label: "현황", icon: Gauge, allow: () => true },
  { id: "appwork", labelKey: "nav.appwork", label: "통합업무", icon: Smartphone, allow: () => true },
  { id: "daily", labelKey: "nav.daily", label: "일일현황", icon: ClipboardCheck, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"]) },
  { id: "approval", labelKey: "nav.approval", label: "승인", icon: CheckCircle2, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE"]) },
  { id: "reception", labelKey: "nav.reception", label: "접수", icon: Plus, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"]) },
  { id: "workorders", labelKey: "nav.workorders", label: "정비건", icon: ClipboardList, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE", "RECEPTIONIST"]) },
  { id: "mechanic", labelKey: "nav.mechanic", label: "내 작업", icon: Wrench, allow: (user: AuthUser) => hasAnyRole(user, ["MECHANIC"]) },
  { id: "equipment", labelKey: "nav.equipment", label: "장비관리", icon: Wrench, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE"]) },
  { id: "calendar", labelKey: "nav.calendar", label: "일정", icon: CalendarDays, allow: () => true },
  { id: "kpi", labelKey: "nav.kpi", label: "보고/KPI", icon: BarChart3, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE"]) },
  { id: "admin", labelKey: "nav.admin", label: "관리", icon: UserCog, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"]) },
  { id: "exports", labelKey: "nav.exports", label: "엑셀", icon: FileSpreadsheet, allow: () => true }
] as const;

type TabId = (typeof tabs)[number]["id"];
type MobilePreviewMode = "mechanic" | "admin" | "executive";
type MobilePreviewScreen = "today" | "workorders" | "completed" | "plans" | "ai";
type MobileMetricFilter = "open" | "completed" | "work" | "urgent" | null;
type MobileAiAlert = {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  message: string;
  equipment: string;
  count: number;
  primaryWorkOrderId: string;
};
type MobileAiResult = {
  source: "openai" | "demo" | "local" | "policy";
  answer: string;
  task?: string;
  denied?: boolean;
  allowedRoles?: string[];
  matches: {
    requestNo: string;
    customer: string;
    equipment: string;
    faultDescription: string;
    diagnosisResult: string;
    actionTaken: string;
    status: string;
    similarity: number;
  }[];
};

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key, fallback, params) => translate(DEFAULT_LOCALE, key, fallback, params)
});

function useI18n() {
  return useContext(I18nContext);
}

function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={`language-switch ${compact ? "compact" : ""}`}>
      <Languages size={15} aria-hidden="true" />
      <span>{t("i18n.language", "언어")}</span>
      <select
        aria-label={t("i18n.select", "표시 언어 선택")}
        value={locale}
        onChange={(event) => setLocale(normalizeLocale(event.target.value))}
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AppShell() {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<TabId>("dashboard");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyWorkPlan[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const visibleTabs = useMemo(() => (user ? tabs.filter((item) => item.allow(user)) : []), [user]);
  const selected = useMemo(
    () => workOrders.find((workOrder) => workOrder.id === selectedId) ?? workOrders[0] ?? null,
    [selectedId, workOrders]
  );
  const setLocale = (nextLocale: LocaleCode) => {
    const normalized = normalizeLocale(nextLocale);
    setLocaleState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
    }
  };
  const i18n = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, fallback, params) => translate(locale, key, fallback, params)
    }),
    [locale]
  );

  async function refresh() {
    if (!user) return;
    setLoading(true);
    try {
      const [summaryData, workOrderData, dailyPlanData] = await Promise.all([
        api<Summary>("/api/dashboard/summary"),
        api<WorkOrder[]>("/api/work-orders"),
        api<DailyWorkPlan[]>("/api/daily-plans")
      ]);
      setSummary(summaryData);
      setWorkOrders(workOrderData);
      setDailyPlans(dailyPlanData);
      setSelectedId((current) => current ?? workOrderData[0]?.id ?? null);
      if (hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"])) {
        setUsers(await api<UserRow[]>("/api/admin/users"));
      } else {
        setUsers([]);
      }
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLocaleState(normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    document.documentElement.lang = htmlLangFor(locale);
  }, [locale]);

  useEffect(() => {
    api<{ user: AuthUser | null }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || !visibleTabs.length) return;
    if (!visibleTabs.some((item) => item.id === tab)) setTab(visibleTabs[0].id);
  }, [tab, user, visibleTabs]);

  if (!user) {
    return (
      <I18nContext.Provider value={i18n}>
        <LoginScreen onLogin={setUser} loading={loading} />
      </I18nContext.Provider>
    );
  }

  const canAdmin = hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"]);
  const canKpi = hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE"]);
  const { t } = i18n;

  return (
    <I18nContext.Provider value={i18n}>
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">MS</div>
            <div>
              <h1>{t("app.title", "정비 렌탈 운영 시스템")}</h1>
              <p>{user.name} · {formatRoles(user.roles)}</p>
            </div>
          </div>
          <nav className="tabs" aria-label={t("nav.aria", "업무 메뉴")}>
            {visibleTabs.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} type="button">
                  <Icon size={17} />
                  {t(item.labelKey, item.label)}
                </button>
              );
            })}
          </nav>
          <div className="user-box">
            <LanguageSwitch compact />
            <button className="icon-button" title={t("actions.refresh", "새로고침")} onClick={refresh} disabled={loading} type="button">
              <RefreshCcw size={16} />
            </button>
            <button
              className="icon-button"
              title={t("actions.logout", "로그아웃")}
              type="button"
              onClick={async () => {
                await postJson("/api/auth/logout", {});
                setUser(null);
                setTab("dashboard");
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="app-workspace">
        <main className="main desktop-workspace" aria-label={t("layout.desktopAria", "데스크톱 업무 화면")}>
          {message ? <p className="notice">{message}</p> : null}
          {tab === "dashboard" ? (
            <Dashboard
              summary={summary}
              workOrders={workOrders}
              user={user}
              select={(id) => {
                setSelectedId(id);
                setTab(canAdmin || hasAnyRole(user, ["EXECUTIVE", "RECEPTIONIST"]) ? "workorders" : "mechanic");
              }}
              switchTab={setTab}
            />
          ) : null}
          {tab === "appwork" ? (
            <UnifiedWorkAppPanel
              user={user}
              workOrders={workOrders}
              dailyPlans={dailyPlans}
              users={users}
              onChanged={refresh}
              onOpenWorkOrder={(id) => {
                setSelectedId(id);
                setTab(canAdmin || hasAnyRole(user, ["EXECUTIVE", "RECEPTIONIST"]) ? "workorders" : "mechanic");
              }}
            />
          ) : null}
          {tab === "planning" ? (
            <PlanningPanel
              currentUser={user}
              workOrders={workOrders}
              dailyPlans={dailyPlans}
              users={users}
              onChanged={refresh}
              onOpenWorkOrder={(id) => {
                setSelectedId(id);
                setTab(canAdmin || hasAnyRole(user, ["EXECUTIVE", "RECEPTIONIST"]) ? "workorders" : "mechanic");
              }}
            />
          ) : null}
          {tab === "daily" ? <DailyStatusPanel workOrders={workOrders} users={users} onOpen={(id) => { setSelectedId(id); setTab("workorders"); }} /> : null}
          {tab === "approval" ? (
            <ApprovalPanel
              currentUser={user}
              workOrders={workOrders}
              users={users}
              onOpen={(id) => {
                setSelectedId(id);
                setTab("workorders");
              }}
              onChanged={refresh}
            />
          ) : null}
          {tab === "reception" ? <ReceptionPanel onCreated={refresh} /> : null}
          {tab === "workorders" ? (
            <WorkOrdersPanel workOrders={workOrders} selected={selected} users={users} currentUser={user} canAdmin={canAdmin} onSelect={setSelectedId} onChanged={refresh} />
          ) : null}
          {tab === "mechanic" ? <MechanicPanel user={user} workOrders={workOrders} selected={selected} onSelect={setSelectedId} onChanged={refresh} /> : null}
          {tab === "equipment" ? <EquipmentPanel canManage={canAdmin} onOpenWorkOrder={(id) => { setSelectedId(id); setTab("workorders"); }} /> : null}
          {tab === "calendar" ? <CalendarPanel onOpen={(id) => { setSelectedId(id); setTab(canAdmin || hasAnyRole(user, ["EXECUTIVE", "RECEPTIONIST"]) ? "workorders" : "mechanic"); }} /> : null}
          {tab === "kpi" ? <KpiPanel enabled={canKpi} workOrders={workOrders} onOpen={(id) => { setSelectedId(id); setTab("workorders"); }} /> : null}
          {tab === "admin" ? <AdminPanel currentUser={user} users={users} onChanged={refresh} /> : null}
          {tab === "exports" ? <ExportsPanel /> : null}
        </main>
        <MobileAppPreview
          user={user}
          workOrders={workOrders}
          dailyPlans={dailyPlans}
          users={users}
          onChanged={refresh}
          onOpenWorkOrder={(id) => {
            setSelectedId(id);
            setTab(canAdmin || hasAnyRole(user, ["EXECUTIVE", "RECEPTIONIST"]) ? "workorders" : "mechanic");
          }}
        />
      </div>
    </div>
    </I18nContext.Provider>
  );
}

function MobileAppPreview({
  user,
  workOrders,
  dailyPlans,
  users,
  onChanged,
  onOpenWorkOrder
}: {
  user: AuthUser;
  workOrders: WorkOrder[];
  dailyPlans: DailyWorkPlan[];
  users: UserRow[];
  onChanged: () => Promise<void>;
  onOpenWorkOrder: (id: string) => void;
}) {
  const availableModes = useMemo(() => {
    const modes: { id: MobilePreviewMode; label: string; allow: boolean }[] = [
      { id: "mechanic", label: "정비사", allow: true },
      { id: "admin", label: "관리자", allow: hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"]) },
      { id: "executive", label: "임원", allow: hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE"]) }
    ];
    return modes.filter((mode) => mode.allow);
  }, [user]);
  const [mode, setMode] = useState<MobilePreviewMode>(() => initialMobilePreviewMode(user));
  const [screen, setScreen] = useState<MobilePreviewScreen>("today");
  const [metricFilter, setMetricFilter] = useState<MobileMetricFilter>(null);
  const [aiQuestion, setAiQuestion] = useState("시동은 걸리지만 출력이 떨어지는 경우 과거에는 어떻게 조치했나요?");
  const [aiResult, setAiResult] = useState<MobileAiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    if (!availableModes.some((item) => item.id === mode)) {
      setMode(availableModes[0]?.id ?? "mechanic");
    }
  }, [availableModes, mode]);

  const openRows = useMemo(() => workOrders.filter((row) => !isClosed(row)), [workOrders]);
  const urgentRows = useMemo(() => openRows.filter((row) => row.priorityLevel === "P1"), [openRows]);
  const delayedRows = useMemo(() => workOrders.filter((row) => row.isDelayed || row.status === "DELAYED"), [workOrders]);
  const reportWaiting = useMemo(() => workOrders.filter((row) => row.status === "REPORT_SUBMITTED"), [workOrders]);
  const completedRows = useMemo(() => workOrders.filter(isClosed), [workOrders]);
  const todayRows = useMemo(() => workOrders.filter((row) => isDailyStatusTarget(row, toDateKey(new Date()))), [workOrders]);
  const aiAlerts = useMemo(() => buildMobileAiAlerts(workOrders), [workOrders]);
  const planRows = useMemo(() => visiblePlansForUser(dailyPlans, user, mode), [dailyPlans, mode, user]);
  const mechanicRows = useMemo(() => {
    const assignedToMe = openRows.filter((row) => row.assignedMechanic?.id === user.id);
    const assignedForPreview = openRows.filter((row) => row.assignedMechanic?.id);
    return assignedToMe.length ? assignedToMe : assignedForPreview;
  }, [openRows, user.id]);
  const adminRows = useMemo(
    () =>
      uniqueWorkOrders([
        ...openRows.filter((row) => !row.assignedMechanic?.id),
        ...reportWaiting,
        ...delayedRows,
        ...urgentRows
      ]),
    [delayedRows, openRows, reportWaiting, urgentRows]
  );
  const executiveRows = useMemo(() => noteworthyWorkOrders(workOrders), [workOrders]);
  const workOrderRows = mode === "mechanic" ? mechanicRows : mode === "admin" ? adminRows : executiveRows;
  const previewRows = metricFilter
    ? metricFilter === "open"
      ? openRows
      : metricFilter === "completed"
        ? completedRows
        : metricFilter === "urgent"
          ? urgentRows
          : workOrderRows
    : screen === "completed"
      ? completedRows
      : screen === "today"
        ? (mode === "mechanic" ? todayRows.filter((row) => row.assignedMechanic?.id === user.id) : todayRows)
        : workOrderRows;
  const visibleRows = sortWorkOrders(previewRows, screen === "completed" || metricFilter === "completed" ? "requestDate" : mode === "executive" ? "priority" : "target").slice(0, 5);
  const screenTitle = metricFilter
    ? metricFilter === "open"
      ? "미결 업무"
      : metricFilter === "completed"
        ? "완료건"
        : metricFilter === "urgent"
          ? "긴급 업무"
          : "내 작업"
    : screen === "today" ? "오늘 업무" : screen === "workorders" ? "정비건" : screen === "completed" ? "완료건" : "AI 문의";

  const effectiveScreenTitle = screen === "plans" ? "계획업무" : screenTitle;


  function showMetricRows(filter: Exclude<MobileMetricFilter, null>) {
    setMetricFilter(filter);
    setScreen(filter === "completed" ? "completed" : "workorders");
  }

  async function askAi(event?: React.FormEvent) {
    event?.preventDefault();
    const question = aiQuestion.trim();
    if (!question) return;
    setAiLoading(true);
    setAiError("");
    try {
      setAiResult(await postJson<MobileAiResult>("/api/mobile/ai", { question }));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI 답변을 불러오지 못했습니다.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <aside className="mobile-preview-panel" aria-label="휴대폰 앱 프리뷰">
      <div className="preview-panel-title">
        <div>
          <h2>휴대폰 앱 프리뷰</h2>
          <p>데스크톱 브라우저 옆에서 역할별 모바일 화면을 바로 확인합니다.</p>
        </div>
        <span className="chip blue"><Smartphone size={14} />모바일</span>
      </div>
      <div className="preview-mode-tabs" role="tablist" aria-label="모바일 역할 선택">
        {availableModes.map((item) => (
          <button
            key={item.id}
            className={mode === item.id ? "active" : ""}
            type="button"
            onClick={() => {
              setMode(item.id);
              setScreen("today");
              setMetricFilter(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="phone-shell">
        <div className="phone-screen">
          <div className="phone-status">
            <span>09:41</span>
            <span>5G 100%</span>
          </div>
          <header className="mobile-app-head">
            <div>
              <span>{mode === "mechanic" ? "정비사 앱" : mode === "admin" ? "관리자 앱" : "임원 앱"}</span>
              <strong>{mode === "mechanic" ? user.name : mode === "admin" ? "운영 관제" : "경영 보고"}</strong>
            </div>
            <button type="button" title="데스크톱 화면 연결" onClick={() => visibleRows[0] && onOpenWorkOrder(visibleRows[0].id)}>
              <Monitor size={16} />
            </button>
          </header>

          <section className="mobile-stats">
            <MobileStat label="미결" value={`${openRows.length}`} active={metricFilter === "open"} onClick={() => showMetricRows("open")} />
            <MobileStat label="완료" value={`${completedRows.length}`} active={metricFilter === "completed"} onClick={() => showMetricRows("completed")} />
            <MobileStat label="내 작업" value={`${workOrderRows.length}`} active={metricFilter === "work"} onClick={() => showMetricRows("work")} />
            <MobileStat label="긴급" value={`${urgentRows.length}`} active={metricFilter === "urgent"} onClick={() => showMetricRows("urgent")} />
          </section>

          <div className="mobile-screen-title">
            <div>
              <span>{formatDate(new Date().toISOString())}</span>
              <strong>{effectiveScreenTitle}</strong>
            </div>
            <span className={`chip ${screen === "ai" ? "blue" : mode === "executive" ? "amber" : "green"}`}>
              {screen === "ai" ? (aiResult?.source === "openai" ? "GPT" : "데이터") : `${previewRows.length}건`}
            </span>
          </div>

          <div className="mobile-content">
            {screen === "plans" ? (
              <MobilePlanPanel
                currentUser={user}
                workOrders={workOrders}
                dailyPlans={planRows}
                users={users}
                mode={mode}
                onChanged={onChanged}
                onOpenWorkOrder={onOpenWorkOrder}
              />
            ) : screen === "ai" ? (
              <MobileAiPanel
                user={user}
                alerts={aiAlerts}
                question={aiQuestion}
                result={aiResult}
                loading={aiLoading}
                error={aiError}
                onQuestion={setAiQuestion}
                onAsk={askAi}
                onOpenWorkOrder={onOpenWorkOrder}
              />
            ) : (
              <div className="mobile-work-list">
                {visibleRows.length ? visibleRows.map((row) => <MobileWorkRow key={row.id} row={row} onOpen={onOpenWorkOrder} />) : <p className="mobile-empty">표시할 업무가 없습니다.</p>}
              </div>
            )}
          </div>

          <nav className="mobile-bottom-nav" aria-label="모바일 화면 전환">
            <button className={screen === "today" && !metricFilter ? "active" : ""} type="button" onClick={() => { setScreen("today"); setMetricFilter(null); }}>
              <CalendarDays size={15} />
              오늘
            </button>
            <button className={screen === "workorders" && !metricFilter ? "active" : ""} type="button" onClick={() => { setScreen("workorders"); setMetricFilter(null); }}>
              <ClipboardList size={15} />
              정비건
            </button>
            <button className={screen === "completed" && !metricFilter ? "active" : ""} type="button" onClick={() => { setScreen("completed"); setMetricFilter(null); }}>
              <CheckCircle2 size={15} />
              완료건
            </button>
            <button className={screen === "plans" ? "active" : ""} type="button" onClick={() => { setScreen("plans"); setMetricFilter(null); }}>
              <CalendarDays size={15} />
              계획
            </button>
            <button className={screen === "ai" ? "active" : ""} type="button" onClick={() => { setScreen("ai"); setMetricFilter(null); }}>
              <Bot size={15} />
              AI
            </button>
          </nav>
        </div>
      </div>
    </aside>
  );
}

function UnifiedWorkAppPanel({
  user,
  workOrders,
  dailyPlans,
  users,
  onChanged,
  onOpenWorkOrder
}: {
  user: AuthUser;
  workOrders: WorkOrder[];
  dailyPlans: DailyWorkPlan[];
  users: UserRow[];
  onChanged: () => Promise<void>;
  onOpenWorkOrder: (id: string) => void;
}) {
  const [screen, setScreen] = useState<MobilePreviewScreen>("today");
  const [metricFilter, setMetricFilter] = useState<MobileMetricFilter>(null);
  const [aiQuestion, setAiQuestion] = useState("시동은 걸리지만 출력이 떨어지는 경우 과거에는 어떻게 조치했나요?");
  const [aiResult, setAiResult] = useState<MobileAiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const openRows = useMemo(() => workOrders.filter((row) => !isClosed(row)), [workOrders]);
  const completedRows = useMemo(() => workOrders.filter(isClosed), [workOrders]);
  const urgentRows = useMemo(() => openRows.filter((row) => row.priorityLevel === "P1"), [openRows]);
  const delayedRows = useMemo(() => workOrders.filter((row) => row.isDelayed || row.status === "DELAYED"), [workOrders]);
  const reportWaiting = useMemo(() => workOrders.filter((row) => row.status === "REPORT_SUBMITTED"), [workOrders]);
  const todayRows = useMemo(() => workOrders.filter((row) => isDailyStatusTarget(row, toDateKey(new Date()))), [workOrders]);
  const aiAlerts = useMemo(() => buildMobileAiAlerts(workOrders), [workOrders]);
  const planRows = useMemo(() => visiblePlansForUser(dailyPlans, user, hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"]) ? "admin" : hasAnyRole(user, ["EXECUTIVE"]) ? "executive" : "mechanic"), [dailyPlans, user]);
  const isMechanicOnly = hasAnyRole(user, ["MECHANIC"]) && !hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE", "RECEPTIONIST"]);
  const roleWorkRows = useMemo(() => {
    if (hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"])) {
      return uniqueWorkOrders([
        ...openRows.filter((row) => !row.assignedMechanic?.id),
        ...reportWaiting,
        ...delayedRows,
        ...urgentRows,
        ...openRows
      ]);
    }
    if (hasAnyRole(user, ["EXECUTIVE"])) return noteworthyWorkOrders(workOrders);
    if (hasAnyRole(user, ["MECHANIC"])) return openRows.filter((row) => row.assignedMechanic?.id === user.id);
    return openRows;
  }, [delayedRows, openRows, reportWaiting, urgentRows, user, workOrders]);
  const todayForRole = isMechanicOnly ? todayRows.filter((row) => row.assignedMechanic?.id === user.id) : todayRows;
  const rowsForView = metricFilter
    ? metricFilter === "open"
      ? openRows
      : metricFilter === "completed"
        ? completedRows
        : metricFilter === "urgent"
          ? urgentRows
          : roleWorkRows
    : screen === "completed"
      ? completedRows
      : screen === "today"
        ? todayForRole
        : roleWorkRows;
  const sortedRows = sortWorkOrders(rowsForView, screen === "completed" || metricFilter === "completed" ? "requestDate" : "priority");
  const screenTitle = metricFilter
    ? metricFilter === "open"
      ? "미결 업무"
      : metricFilter === "completed"
        ? "완료건"
        : metricFilter === "urgent"
          ? "긴급 업무"
          : "내 작업"
    : screen === "today" ? "오늘 업무" : screen === "workorders" ? "정비건" : screen === "completed" ? "완료건" : "AI 업무지원";

  const effectiveScreenTitle = screen === "plans" ? "계획업무" : screenTitle;

  function showMetricRows(filter: Exclude<MobileMetricFilter, null>) {
    setMetricFilter(filter);
    setScreen(filter === "completed" ? "completed" : "workorders");
  }

  async function askAi(event?: React.FormEvent) {
    event?.preventDefault();
    const question = aiQuestion.trim();
    if (!question) return;
    setAiLoading(true);
    setAiError("");
    try {
      setAiResult(await postJson<MobileAiResult>("/api/mobile/ai", { question }));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI 답변을 불러오지 못했습니다.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="section unified-work-panel">
      <div className="section-header">
        <div>
          <h2>데스크톱 통합업무</h2>
          <p>휴대폰 앱의 오늘, 정비건, 완료건, AI 기능을 데스크톱에서도 같은 기준으로 사용합니다.</p>
        </div>
        <span className="chip blue"><Monitor size={14} />데스크톱 적용</span>
      </div>
      <div className="app-tab-strip" role="tablist" aria-label="데스크톱 통합업무 화면 전환">
        <button className={screen === "today" && !metricFilter ? "active" : ""} type="button" onClick={() => { setScreen("today"); setMetricFilter(null); }}>
          <CalendarDays size={16} />오늘
        </button>
        <button className={screen === "workorders" && !metricFilter ? "active" : ""} type="button" onClick={() => { setScreen("workorders"); setMetricFilter(null); }}>
          <ClipboardList size={16} />정비건
        </button>
        <button className={screen === "completed" && !metricFilter ? "active" : ""} type="button" onClick={() => { setScreen("completed"); setMetricFilter(null); }}>
          <CheckCircle2 size={16} />완료건
        </button>
        <button className={screen === "plans" ? "active" : ""} type="button" onClick={() => { setScreen("plans"); setMetricFilter(null); }}>
          <CalendarDays size={16} />계획업무
        </button>
        <button className={screen === "ai" ? "active" : ""} type="button" onClick={() => { setScreen("ai"); setMetricFilter(null); }}>
          <Bot size={16} />AI
        </button>
      </div>
      <div className="app-filter-grid">
        <button className={metricFilter === "open" ? "active" : ""} type="button" onClick={() => showMetricRows("open")}>
          <span>미결</span>
          <strong>{openRows.length}</strong>
          <small>진행/대기 전체</small>
        </button>
        <button className={metricFilter === "completed" ? "active" : ""} type="button" onClick={() => showMetricRows("completed")}>
          <span>완료</span>
          <strong>{completedRows.length}</strong>
          <small>최종 완료/보관</small>
        </button>
        <button className={metricFilter === "work" ? "active" : ""} type="button" onClick={() => showMetricRows("work")}>
          <span>내 작업</span>
          <strong>{roleWorkRows.length}</strong>
          <small>역할 기준 업무</small>
        </button>
        <button className={metricFilter === "urgent" ? "active" : ""} type="button" onClick={() => showMetricRows("urgent")}>
          <span>긴급</span>
          <strong>{urgentRows.length}</strong>
          <small>P1 미완료</small>
        </button>
      </div>
      {screen === "plans" ? (
        <PlanningWorkflow
          currentUser={user}
          workOrders={workOrders}
          dailyPlans={planRows}
          users={users}
          compact={false}
          onChanged={onChanged}
          onOpenWorkOrder={onOpenWorkOrder}
        />
      ) : screen === "ai" ? (
        <DesktopAiPanel
          user={user}
          alerts={aiAlerts}
          question={aiQuestion}
          result={aiResult}
          loading={aiLoading}
          error={aiError}
          onQuestion={setAiQuestion}
          onAsk={askAi}
          onOpenWorkOrder={onOpenWorkOrder}
        />
      ) : (
        <div className="unified-work-layout">
          <section className="section unified-work-list">
            <div className="section-header">
              <div>
                <h2>{effectiveScreenTitle}</h2>
                <p>휴대폰 앱과 같은 기준으로 필터링된 정비건입니다. 항목을 선택하면 데스크톱 상세 화면에서 변경/승인/보고를 이어서 처리합니다.</p>
              </div>
              <span className="chip green">{sortedRows.length}건</span>
            </div>
            <WorkList workOrders={sortedRows.slice(0, 20)} onSelect={onOpenWorkOrder} />
          </section>
          <aside className="unified-work-side">
            <DesktopAiAlertList alerts={aiAlerts.slice(0, 5)} onOpenWorkOrder={onOpenWorkOrder} />
            <DesktopRolePolicy user={user} />
          </aside>
        </div>
      )}
    </div>
  );
}

function DesktopAiPanel({
  user,
  alerts,
  question,
  result,
  loading,
  error,
  onQuestion,
  onAsk,
  onOpenWorkOrder
}: {
  user: AuthUser;
  alerts: MobileAiAlert[];
  question: string;
  result: MobileAiResult | null;
  loading: boolean;
  error: string;
  onQuestion: (value: string) => void;
  onAsk: (event?: React.FormEvent) => void;
  onOpenWorkOrder: (id: string) => void;
}) {
  const examples = [
    "시동은 걸리는데 출력이 떨어질 때 과거 조치 추천",
    "완료보고 작성 도와줘",
    "일일 보고서 초안 만들어줘",
    "내 KPI가 어떻게 돼?"
  ];

  return (
    <div className="desktop-ai-grid">
      <DesktopAiAlertList alerts={alerts} onOpenWorkOrder={onOpenWorkOrder} />
      <section className="desktop-ai-card desktop-ai-main">
        <div className="section-header">
          <div>
            <h2>AI 업무지원</h2>
            <p>정비 문의, 유사 이력, 완료보고, 운영 보고서 작성을 역할 권한에 맞춰 처리합니다.</p>
          </div>
          <span className={`chip ${result?.denied ? "red" : "blue"}`}>{result?.source === "openai" ? "GPT" : "업무 데이터"}</span>
        </div>
        <form className="desktop-ai-form" onSubmit={onAsk}>
          <label htmlFor="desktop-ai-question">정비/보고/업무 문의</label>
          <textarea
            id="desktop-ai-question"
            value={question}
            onChange={(event) => onQuestion(event.target.value)}
            placeholder="예: 290호기 출력 저하 유사 이력과 조치 방법 알려줘"
          />
          <button className="primary" type="submit" disabled={loading}>
            <Send size={15} />
            {loading ? "분석 중" : "AI 추천"}
          </button>
        </form>
        <div className="desktop-ai-examples">
          {examples.map((example) => (
            <button type="button" key={example} onClick={() => onQuestion(example)}>
              {example}
            </button>
          ))}
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="desktop-ai-answer">
          {result ? (
            <>
              <div className={`mobile-ai-source ${result.denied ? "denied" : ""}`}>
                <span>{result.denied ? "권한 정책 차단" : result.source === "openai" ? "GPT 연결 답변" : "업무 AI 답변"}</span>
                <strong>{result.denied ? "조회 불가" : `${result.matches.length}개 유사 이력 참조`}</strong>
              </div>
              <pre>{result.answer}</pre>
              {result.matches.length ? (
                <div className="desktop-ai-matches">
                  {result.matches.slice(0, 4).map((match) => (
                    <div key={match.requestNo}>
                      <span>{match.requestNo} · {match.customer}</span>
                      <strong>{match.faultDescription}</strong>
                      <p>{match.actionTaken}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mobile-report-card">
              <span>데스크톱 적용 완료</span>
              <strong>모바일 AI 탭과 같은 API와 권한 정책을 사용합니다.</strong>
              <p>정비사는 KPI 요청이 차단되고, 관리자/임원/최고관리자만 운영 보고와 KPI 자료를 요청할 수 있습니다.</p>
            </div>
          )}
        </div>
      </section>
      <DesktopRolePolicy user={user} />
    </div>
  );
}

function DesktopAiAlertList({ alerts, onOpenWorkOrder }: { alerts: MobileAiAlert[]; onOpenWorkOrder: (id: string) => void }) {
  return (
    <section className="desktop-ai-card">
      <div className="mobile-ai-alert-head">
        <span><AlertTriangle size={14} />AI 자동 경고</span>
        <strong>{alerts.length ? `${alerts.length}건` : "정상"}</strong>
      </div>
      <div className="desktop-ai-alert-list">
        {alerts.length ? (
          alerts.map((alert) => (
            <button className={`desktop-ai-alert ${alert.level}`} key={alert.id} type="button" onClick={() => onOpenWorkOrder(alert.primaryWorkOrderId)}>
              <span>{alert.level === "critical" ? "점검 필요" : alert.level === "warning" ? "주의 필요" : "관찰"}</span>
              <strong>{alert.title}</strong>
              <p>{alert.message}</p>
            </button>
          ))
        ) : (
          <div className="desktop-ai-alert empty">
            <span>관찰</span>
            <strong>반복 고장 경고 없음</strong>
            <p>현재 데이터에서는 동일 장비 반복 고장이나 재발 신호가 뚜렷하지 않습니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function DesktopRolePolicy({ user }: { user: AuthUser }) {
  return (
    <section className="desktop-ai-card">
      <div className="mobile-ai-role-head">
        <span>현재 권한</span>
        <strong>{formatRoles(user.roles)}</strong>
      </div>
      <div className="desktop-role-grid">
        <div>
          <span>정비사</span>
          <strong>정비 문의, 내 작업 완료보고</strong>
          <p>KPI/성과 조회 불가</p>
        </div>
        <div>
          <span>관리자</span>
          <strong>운영 보고, KPI, 승인 자료</strong>
          <p>계정/감사 자료 제한</p>
        </div>
        <div>
          <span>임원</span>
          <strong>보고자료, KPI, 리스크 요약</strong>
          <p>계정 변경 불가</p>
        </div>
        <div>
          <span>최고관리자</span>
          <strong>전체 자료, 계정/권한/감사</strong>
          <p>민감 자료 포함</p>
        </div>
      </div>
    </section>
  );
}

function MobileAiPanel({
  user,
  alerts,
  question,
  result,
  loading,
  error,
  onQuestion,
  onAsk,
  onOpenWorkOrder
}: {
  user: AuthUser;
  alerts: MobileAiAlert[];
  question: string;
  result: MobileAiResult | null;
  loading: boolean;
  error: string;
  onQuestion: (value: string) => void;
  onAsk: (event?: React.FormEvent) => void;
  onOpenWorkOrder: (id: string) => void;
}) {
  const examples = [
    "시동은 걸리는데 출력이 떨어질 때 과거 조치 추천",
    "완료보고 작성 도와줘",
    "일일 보고서 초안 만들어줘",
    "내 KPI가 어떻게 돼?"
  ];
  const currentRoleText = formatRoles(user.roles);

  return (
    <div className="mobile-ai-panel">
      <section className="mobile-ai-alerts" aria-label="AI 자동 경고">
        <div className="mobile-ai-alert-head">
          <span><AlertTriangle size={13} />AI 자동 경고</span>
          <strong>{alerts.length ? `${alerts.length}건` : "정상"}</strong>
        </div>
        {alerts.length ? (
          alerts.slice(0, 4).map((alert) => (
            <button
              className={`mobile-ai-alert ${alert.level}`}
              key={alert.id}
              type="button"
              onClick={() => onOpenWorkOrder(alert.primaryWorkOrderId)}
            >
              <span>{alert.level === "critical" ? "점검 필요" : alert.level === "warning" ? "주의 필요" : "관찰"}</span>
              <strong>{alert.title}</strong>
              <p>{alert.message}</p>
            </button>
          ))
        ) : (
          <div className="mobile-ai-alert empty">
            <span>관찰</span>
            <strong>반복 고장 경고 없음</strong>
            <p>현재 데이터에서는 동일 장비 반복 고장이나 재발 신호가 뚜렷하지 않습니다.</p>
          </div>
        )}
      </section>
      <section className="mobile-ai-role-policy" aria-label="역할별 AI 자료 권한">
        <div className="mobile-ai-role-head">
          <span>현재 권한</span>
          <strong>{currentRoleText}</strong>
        </div>
        <div className="mobile-ai-role-grid">
          <div>
            <span>정비사</span>
            <strong>정비 문의, 내 작업 완료보고</strong>
            <p>KPI/성과 조회 불가</p>
          </div>
          <div>
            <span>관리자</span>
            <strong>운영 보고, KPI, 승인 자료</strong>
            <p>계정/감사 자료 제한</p>
          </div>
          <div>
            <span>임원</span>
            <strong>보고자료, KPI, 리스크 요약</strong>
            <p>계정 변경 불가</p>
          </div>
          <div>
            <span>최고관리자</span>
            <strong>전체 자료, 계정/권한/감사</strong>
            <p>민감 자료 포함</p>
          </div>
        </div>
      </section>
      <form className="mobile-ai-form" onSubmit={onAsk}>
        <label htmlFor="mobile-ai-question">정비/보고/업무 문의</label>
        <textarea
          id="mobile-ai-question"
          value={question}
          onChange={(event) => onQuestion(event.target.value)}
          placeholder="예: 290호기 출력 저하 유사 이력과 조치 방법 알려줘"
        />
        <button className="primary" type="submit" disabled={loading}>
          <Send size={14} />
          {loading ? "분석 중" : "AI 추천"}
        </button>
      </form>
      <div className="mobile-ai-examples">
        {examples.map((example) => (
          <button type="button" key={example} onClick={() => onQuestion(example)}>
            {example}
          </button>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="mobile-ai-answer">
        {result ? (
          <>
            <div className={`mobile-ai-source ${result.denied ? "denied" : ""}`}>
              <span>{result.denied ? "권한 정책 차단" : result.source === "openai" ? "GPT 연결 답변" : "업무 AI 답변"}</span>
              <strong>{result.denied ? "조회 불가" : `${result.matches.length}개 유사 이력 참조`}</strong>
            </div>
            <pre>{result.answer}</pre>
            {result.matches.length ? (
              <div className="mobile-ai-matches">
                {result.matches.slice(0, 3).map((match) => (
                  <div key={match.requestNo}>
                    <span>{match.requestNo} · {match.customer}</span>
                    <strong>{match.faultDescription}</strong>
                    <p>{match.actionTaken}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="mobile-report-card">
            <span>AI 추천</span>
            <strong>정비 문의와 과거 이력 검색을 같이 처리합니다.</strong>
            <p>OPENAI_API_KEY가 있으면 GPT로 답하고, 없으면 데모/과거 정비 데이터에서 유사 사례를 찾아 추천합니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MobileStat({
  label,
  value,
  active,
  onClick
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function MobileWorkRow({ row, onOpen }: { row: WorkOrder; onOpen: (id: string) => void }) {
  return (
    <button className={`mobile-work-row ${priorityClass[row.priorityLevel]}`} type="button" onClick={() => onOpen(row.id)}>
      <div>
        <strong>{row.requestNo}</strong>
        <span>{row.customer?.name ?? "미지정"} · {row.equipmentInput ?? row.equipmentNoNormalized}</span>
      </div>
      <p>{row.faultDescription}</p>
      <div className="mobile-row-meta">
        <span>{priorityLabel[row.priorityLevel]}</span>
        <span>{labelStatus(row.status)}</span>
        <span>{formatDate(row.targetDueDate)}</span>
      </div>
    </button>
  );
}

function LoginScreen({ onLogin, loading }: { onLogin: (user: AuthUser) => void; loading: boolean }) {
  const { t } = useI18n();
  const [loginId, setLoginId] = useState("ko.ms");
  const [password, setPassword] = useState("Admin!2026Test");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      onLogin(await postJson<AuthUser>("/api/auth/login", { loginId, password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    }
  }

  return (
    <div className="login-screen">
      <div className="login-layout">
        <form className="login-panel" onSubmit={submit}>
          <div className="login-tools">
            <span className="brand-mark">MS</span>
            <LanguageSwitch />
          </div>
          <h1>{t("app.title", "정비 렌탈 운영 시스템")}</h1>
          <p>{t("login.subtitle", "역할별 데모 계정으로 실제 운영 화면을 확인할 수 있습니다.")}</p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="loginId">{t("login.loginId", "아이디")}</label>
              <input id="loginId" value={loginId} onChange={(event) => setLoginId(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">{t("login.password", "비밀번호")}</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {error ? <div className="error">{error}</div> : null}
            <button className="primary" disabled={loading} type="submit">
              <KeyRound size={16} />
              {loading ? t("login.loading", "확인 중") : t("login.submit", "로그인")}
            </button>
          </div>
        </form>

        <div className="demo-panel">
          <div className="section-header">
            <div>
              <h2>{t("login.demoAccounts", "데모 계정")}</h2>
              <p>{t("login.demoSubtitle", "임원, 관리자, 정비사 화면을 즉시 전환해 볼 수 있습니다.")}</p>
            </div>
          </div>
          <div className="demo-account-grid">
            {demoAccounts.map((account) => (
              <button
                key={account.loginId}
                className={`demo-account ${loginId === account.loginId ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setLoginId(account.loginId);
                  setPassword(account.password);
                }}
              >
                <span>{account.label}</span>
                <strong>{account.name}</strong>
                <small>{account.loginId} · {account.note}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({
  summary,
  workOrders,
  user,
  select,
  switchTab
}: {
  summary: Summary | null;
  workOrders: WorkOrder[];
  user: AuthUser;
  select: (id: string) => void;
  switchTab: (tab: TabId) => void;
}) {
  const [activeMetric, setActiveMetric] = useState("pending");
  const urgent = workOrders.filter((row) => row.priorityLevel === "P1" && !isClosed(row));
  const delayed = workOrders.filter((row) => row.isDelayed || row.status === "DELAYED");
  const reviewWaiting = workOrders.filter((row) => row.status === "REPORT_SUBMITTED");
  const myWork = workOrders.filter((row) => row.assignedMechanic?.id === user.id && !isClosed(row));
  const metrics = [
    { id: "total", label: "전체 접수", value: summary?.total ?? 0, rows: workOrders, tone: "blue", Icon: ClipboardList },
    { id: "completed", label: "최종 완료", value: summary?.completed ?? 0, rows: workOrders.filter(isClosed), tone: "green", Icon: CheckCircle2 },
    { id: "pending", label: "미결", value: summary?.pending ?? 0, rows: workOrders.filter((row) => !isClosed(row)), tone: "amber", Icon: ClipboardCheck },
    { id: "delayed", label: "지연", value: summary?.delayed ?? 0, rows: delayed, tone: "red", Icon: AlertTriangle },
    {
      id: "planned",
      label: "계획 업무",
      value: summary?.planned ?? 0,
      rows: workOrders.filter((row) => ["ASSIGNED", "IN_PROGRESS", "PART_WAITING", "ON_HOLD"].includes(row.status)),
      tone: "teal",
      Icon: CalendarDays
    },
    { id: "urgent", label: "긴급", value: summary?.urgent ?? 0, rows: urgent, tone: "violet", Icon: Gauge }
  ];
  const selectedMetric = metrics.find((metric) => metric.id === activeMetric) ?? metrics[0];

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2>운영 현황</h2>
          <p>{hasAnyRole(user, ["EXECUTIVE"]) ? "임원 보고 기준으로 완료율, 지연, 긴급 건을 먼저 보여줍니다." : "오늘 처리해야 할 접수, 배정, 보고 대기 건을 모아봅니다."}</p>
        </div>
        <div className="toolbar">
          {hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"]) ? (
            <button onClick={() => switchTab("reception")} type="button"><Plus size={16} />접수 등록</button>
          ) : null}
          {hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE"]) ? (
            <button onClick={() => switchTab("kpi")} type="button"><BarChart3 size={16} />보고/KPI</button>
          ) : null}
        </div>
      </div>
      <div className="metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.Icon;
          return (
            <button
              className={`metric metric-button metric-${metric.tone} ${selectedMetric.id === metric.id ? "active" : ""}`}
              key={metric.id}
              type="button"
              onClick={() => setActiveMetric(metric.id)}
              aria-pressed={selectedMetric.id === metric.id}
            >
              <span className="metric-top"><Icon size={16} />{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.rows.length}건 리스트 보기</small>
            </button>
          );
        })}
      </div>
      <div className="section">
        <div className="section-header">
          <div>
            <h2>{selectedMetric.label} 리스트</h2>
            <p>현황판 숫자를 선택하면 해당 조건의 정비건만 바로 확인합니다.</p>
          </div>
          <span className="chip">{selectedMetric.rows.length}건</span>
        </div>
        <WorkList workOrders={selectedMetric.rows.slice(0, 12)} onSelect={select} />
      </div>
      <div className="insight-grid">
        <Insight title="긴급 처리" value={`${urgent.length}건`} text={urgent[0] ? `${urgent[0].customer?.name} · ${urgent[0].faultDescription}` : "긴급 미결 건 없음"} tone="red" />
        <Insight title="지연 리스크" value={`${delayed.length}건`} text={delayed[0] ? `${delayed[0].requestNo} 목표일 초과` : "지연 관리 안정"} tone="amber" />
        <Insight title="승인 대기" value={`${reviewWaiting.length}건`} text="정비사 보고 후 관리자 최종 승인 필요" tone="green" />
        {hasAnyRole(user, ["MECHANIC"]) ? <Insight title="내 배정 업무" value={`${myWork.length}건`} text="작업 시작과 완료보고는 내 작업 탭에서 처리" tone="blue" /> : null}
      </div>
      <div className="panel-grid">
        <div className="section">
          <div className="section-header">
            <h2>우선 처리 업무</h2>
          </div>
          <WorkList workOrders={workOrders.slice(0, 8)} onSelect={select} />
        </div>
        <div className="tool-panel">
          <h2>시연 포인트</h2>
          <div className="kv"><span>임원</span><strong>전체 완료율, 긴급/지연, 정비사별 KPI를 보고합니다.</strong></div>
          <div className="kv"><span>관리자</span><strong>미배정 건 배정, 보고 승인, 계정 생성과 권한 부여를 처리합니다.</strong></div>
          <div className="kv"><span>정비사</span><strong>내 업무만 확인하고 작업 시작, 완료보고, 목표일 변경 요청을 보냅니다.</strong></div>
        </div>
      </div>
    </div>
  );
}

function DailyStatusPanel({
  workOrders,
  users,
  onOpen
}: {
  workOrders: WorkOrder[];
  users: UserRow[];
  onOpen: (id: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [mechanicFilter, setMechanicFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("priority");
  const mechanicOptions = useMemo(() => makeMechanicOptions(workOrders, users), [users, workOrders]);
  const dailyRows = useMemo(
    () => workOrders.filter((row) => isDailyStatusTarget(row, selectedDate)),
    [selectedDate, workOrders]
  );
  const filtered = useMemo(() => {
    return sortWorkOrders(
      dailyRows.filter((row) => {
        const priorityOk = priorityFilter === "ALL" || row.priorityLevel === priorityFilter;
        const mechanicOk =
          mechanicFilter === "ALL" ||
          (mechanicFilter === "UNASSIGNED" ? !row.assignedMechanic?.id : row.assignedMechanic?.id === mechanicFilter);
        const statusOk =
          statusFilter === "ALL" ||
          (statusFilter === "ACTIVE" ? !isClosed(row) : statusFilter === "COMPLETED" ? isClosed(row) : statusFilter === "RISK" ? isRiskWorkOrder(row, selectedDate) : row.status === statusFilter);
        return priorityOk && mechanicOk && statusOk;
      }),
      sortBy
    );
  }, [dailyRows, mechanicFilter, priorityFilter, selectedDate, sortBy, statusFilter]);
  const approvalRows = dailyRows.filter((row) => row.status === "REPORT_SUBMITTED");
  const delayedRows = dailyRows.filter((row) => isRiskWorkOrder(row, selectedDate));
  const completedRows = dailyRows.filter((row) => isClosed(row) || isSameDayKey(selectedDate, row.finalCompletedAt));
  const unassignedRows = dailyRows.filter((row) => !row.assignedMechanic?.id && !isClosed(row));
  const inProgressRows = dailyRows.filter((row) => ["ASSIGNED", "IN_PROGRESS", "PART_WAITING", "ON_HOLD", "DELAYED"].includes(row.status));
  const mechanicLoad = useMemo(() => mechanicDailyLoad(dailyRows), [dailyRows]);
  const topRisks = sortWorkOrders(delayedRows.length ? delayedRows : dailyRows.filter((row) => !isClosed(row)), "priority").slice(0, 4);

  return (
    <div className="section daily-status-view">
      <div className="section-header">
        <div>
          <h2>관리자 일일업무 현황</h2>
          <p>선택한 날짜 기준으로 접수, 진행, 목표일, 보고, 완료 건을 한 번에 리스트업합니다.</p>
        </div>
        <div className="toolbar">
          <a className="icon-button" href="/api/exports/daily-status" download><Download size={16} />일일현황 엑셀</a>
        </div>
      </div>

      <div className="daily-command-bar">
        <Input label="기준일" type="date" value={selectedDate} onChange={setSelectedDate} />
        <Select label="정비사" value={mechanicFilter} onChange={setMechanicFilter} options={mechanicOptions} />
        <Select label="우선순위" value={priorityFilter} onChange={setPriorityFilter} options={[{ value: "ALL", label: "전체 우선순위" }, ...priorityOptions]} />
        <Select
          label="상태"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "ALL", label: "전체" },
            { value: "ACTIVE", label: "미결 전체" },
            { value: "RISK", label: "지연/리스크" },
            { value: "REPORT_SUBMITTED", label: "승인 대기" },
            { value: "UNASSIGNED", label: "미배정" },
            { value: "IN_PROGRESS", label: "작업중" },
            { value: "COMPLETED", label: "완료/종결" }
          ]}
        />
        <Select
          label="정렬"
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: "priority", label: "우선순위 높은 순" },
            { value: "target", label: "목표일 빠른 순" },
            { value: "mechanic", label: "정비사별" },
            { value: "status", label: "상태별" },
            { value: "requestDate", label: "접수 최신 순" }
          ]}
        />
      </div>

      <div className="daily-metric-grid">
        <button type="button" className="metric metric-button" onClick={() => setStatusFilter("ALL")}>
          <span>금일 대상</span>
          <strong>{dailyRows.length}</strong>
        </button>
        <button type="button" className="metric metric-button" onClick={() => setStatusFilter("RISK")}>
          <span>지연/리스크</span>
          <strong>{delayedRows.length}</strong>
        </button>
        <button type="button" className="metric metric-button" onClick={() => setStatusFilter("REPORT_SUBMITTED")}>
          <span>승인 대기</span>
          <strong>{approvalRows.length}</strong>
        </button>
        <button type="button" className="metric metric-button" onClick={() => setStatusFilter("UNASSIGNED")}>
          <span>미배정</span>
          <strong>{unassignedRows.length}</strong>
        </button>
        <button type="button" className="metric metric-button" onClick={() => setStatusFilter("IN_PROGRESS")}>
          <span>진행/계획</span>
          <strong>{inProgressRows.length}</strong>
        </button>
        <button type="button" className="metric metric-button" onClick={() => setStatusFilter("COMPLETED")}>
          <span>완료/종결</span>
          <strong>{completedRows.length}</strong>
        </button>
      </div>

      <div className="daily-layout">
        <section className="daily-list-section">
          <div className="section-header">
            <div>
              <h2>{selectedDate} 업무 리스트</h2>
              <p>관리자가 오전 회의나 마감 보고 전에 바로 읽을 수 있도록 현장, 장비, 조치, 다음 액션을 같이 보여줍니다.</p>
            </div>
            <span className="chip">{filtered.length}건</span>
          </div>
          <div className="daily-work-list">
            {filtered.map((row) => (
              <article
                className={`daily-work-card clickable-card ${priorityClass[row.priorityLevel]}`}
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(row.id);
                  }
                }}
              >
                <div className="daily-work-card-main">
                  <div className="daily-card-head">
                    <div>
                      <button className="link-button" type="button" onClick={() => onOpen(row.id)}>{row.requestNo}</button>
                      <strong>{row.customer?.name ?? "미지정"} · {row.site?.name ?? row.equipment?.site?.name ?? "-"}</strong>
                    </div>
                    <div className="chips">
                      <span className={`chip ${priorityChip[row.priorityLevel]}`}>{priorityLabel[row.priorityLevel]}</span>
                      <span className="chip">{dailyStatusReason(row, selectedDate)}</span>
                      <span className="chip">{labelStatus(row.status)}</span>
                      {isRiskWorkOrder(row, selectedDate) ? <span className="chip red">리스크</span> : null}
                    </div>
                  </div>
                  <div className="daily-card-body">
                    <div>
                      <span>현장/장비</span>
                      <strong>{row.equipmentInput ?? row.equipmentNoNormalized ?? "-"} · {row.equipment?.modelName ?? "모델 미지정"}</strong>
                      <p>{row.equipment?.vehicleRegistrationNo ?? row.equipment?.serialNo ?? "장비 세부정보 미등록"}</p>
                    </div>
                    <div>
                      <span>접수 내용</span>
                      <strong>{row.faultDescription}</strong>
                      <p>{dailyDetailText(row)}</p>
                    </div>
                    <div>
                      <span>담당/일정</span>
                      <strong>{row.assignedMechanic?.name ?? "미배정"}</strong>
                      <p>접수 {formatDate(row.requestDate)} · 목표일 {formatDate(row.targetDueDate)}</p>
                      <p className={isRiskWorkOrder(row, selectedDate) ? "danger-text" : "muted"}>{targetStatusText(row, selectedDate)}</p>
                    </div>
                  </div>
                  {row.memo ? <p className="daily-card-memo">메모: {row.memo}</p> : null}
                </div>
                <div className="daily-card-action">
                  <span>관리자 액션</span>
                  <strong>{dailyActionText(row, selectedDate)}</strong>
                  <button className="small-button" type="button" onClick={() => onOpen(row.id)}>상세 보기</button>
                </div>
              </article>
            ))}
            {!filtered.length ? <p className="notice">표시할 일일업무가 없습니다.</p> : null}
          </div>
        </section>

        <aside className="daily-side-panel">
          <div className="tool-panel">
            <h2>관리자 확인 포인트</h2>
            <div className="kv"><span>1순위</span><strong>{approvalRows.length ? `완료보고 ${approvalRows.length}건 최종 승인 필요` : "승인 대기 건 없음"}</strong></div>
            <div className="kv"><span>2순위</span><strong>{delayedRows.length ? `지연/리스크 ${delayedRows.length}건 목표일 재확인` : "지연 리스크 안정"}</strong></div>
            <div className="kv"><span>3순위</span><strong>{unassignedRows.length ? `미배정 ${unassignedRows.length}건 정비사 배정 필요` : "미배정 건 없음"}</strong></div>
          </div>
          <div className="tool-panel">
            <h2>정비사별 금일 부하</h2>
            {mechanicLoad.map((item) => (
              <div className="daily-load-row" key={item.name}>
                <span>{item.name}</span>
                <strong>{item.count}건</strong>
              </div>
            ))}
          </div>
          <div className="tool-panel">
            <h2>주요 리스크</h2>
            {topRisks.map((row) => (
              <button className="daily-risk-row" key={row.id} type="button" onClick={() => onOpen(row.id)}>
                <span>{row.requestNo} · {priorityLabel[row.priorityLevel]}</span>
                <strong>{row.customer?.name ?? "-"} / {row.assignedMechanic?.name ?? "미배정"}</strong>
                <p>{dailyActionText(row, selectedDate)}</p>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReceptionPanel({ onCreated }: { onCreated: () => Promise<void> }) {
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [form, setForm] = useState({
    customerName: "태성이엔지",
    siteName: "CYL 도장물류",
    equipmentInput: "290호기",
    requestDate: new Date().toISOString().slice(0, 10),
    contactPhone: "010-2625-0987",
    faultCategoryName: "시동/출력",
    faultDescription: "시동은 걸리지만 작업 중 출력이 떨어집니다.",
    equipmentType: "RENTAL",
    priorityLevel: "P1",
    memo: ""
  });
  const [message, setMessage] = useState("");

  async function lookupEquipment() {
    setMessage("");
    try {
      setLookup(await api<LookupResult>(`/api/equipment/lookup?keyword=${encodeURIComponent(form.equipmentInput)}`));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "장비 조회에 실패했습니다.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await postJson("/api/work-orders", form);
      await onCreated();
      setMessage("접수 등록이 완료되었습니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "접수 등록에 실패했습니다.");
    }
  }

  function setField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="panel-grid">
      <form className="tool-panel form-grid" onSubmit={submit}>
        <div className="section-header">
          <div>
            <h2>정비 접수</h2>
            <p>차량번호나 호기 번호로 장비를 찾고 접수 내용을 등록합니다.</p>
          </div>
        </div>
        <div className="form-row">
          <Input label="사업장/고객사" value={form.customerName} onChange={(value) => setField("customerName", value)} />
          <Input label="배치장소/현장" value={form.siteName} onChange={(value) => setField("siteName", value)} />
        </div>
        <div className="form-row">
          <Input label="차량번호/호기" value={form.equipmentInput} onChange={(value) => setField("equipmentInput", value)} />
          <div className="field">
            <label>장비 조회</label>
            <button type="button" onClick={lookupEquipment}><Search size={16} />조회</button>
          </div>
        </div>
        <div className="form-row">
          <Input label="요청일자" type="date" value={form.requestDate} onChange={(value) => setField("requestDate", value)} />
          <Input label="정비문의 연락처" value={form.contactPhone} onChange={(value) => setField("contactPhone", value)} />
        </div>
        <div className="form-row">
          <Input label="고장 유형" value={form.faultCategoryName} onChange={(value) => setField("faultCategoryName", value)} />
          <Select label="우선순위" value={form.priorityLevel} onChange={(value) => setField("priorityLevel", value)} options={priorityOptions} />
        </div>
        <div className="field">
          <label>고장 내용</label>
          <textarea value={form.faultDescription} onChange={(event) => setField("faultDescription", event.target.value)} />
        </div>
        <div className="field">
          <label>비고</label>
          <textarea value={form.memo} onChange={(event) => setField("memo", event.target.value)} />
        </div>
        {message ? <div className={message.includes("완료") ? "notice" : "error"}>{message}</div> : null}
        <button className="primary" type="submit"><Plus size={16} />접수 등록</button>
      </form>
      <div className="detail-panel">
        <h2>장비 조회 결과</h2>
        {lookup?.equipment ? (
          <div className="detail-grid">
            <Info label="정규화 번호" value={lookup.normalized} />
            <Info label="사업장" value={lookup.equipment.customer?.name} />
            <Info label="현장" value={lookup.equipment.site?.name} />
            <Info label="장비 No" value={lookup.equipment.equipmentNo} />
            <Info label="배치 No" value={lookup.equipment.placementNo} />
            <Info label="모델명" value={lookup.equipment.modelName} />
            <Info label="차대번호" value={lookup.equipment.serialNo} />
            <Info label="톤수" value={lookup.equipment.tonnage} />
          </div>
        ) : (
          <p className="muted">290, 118, 041 같은 데모 장비 번호로 조회해 볼 수 있습니다.</p>
        )}
        {lookup?.duplicateCandidates?.length ? (
          <div className="notice">
            <strong>관련 접수 {lookup.duplicateCandidates.length}건</strong>
            {lookup.duplicateCandidates.map((item) => (
              <p key={item.id}>{item.requestNo} · {labelStatus(item.status)} · {item.faultDescription}</p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ApprovalPanel({
  currentUser,
  workOrders,
  users,
  onOpen,
  onChanged
}: {
  currentUser: AuthUser;
  workOrders: WorkOrder[];
  users: UserRow[];
  onOpen: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<"ALL" | "ADMIN" | "EXECUTIVE" | "DONE">("ALL");
  const approvalRows = useMemo(
    () => sortWorkOrders(workOrders.filter((row) => isApprovalTarget(row, users)), "priority"),
    [users, workOrders]
  );
  const completedRows = useMemo(
    () => sortWorkOrders(workOrders.filter((row) => row.status === "FINAL_COMPLETED" || row.status === "TEMPORARY_ACTION"), "requestDate").slice(0, 12),
    [workOrders]
  );
  const adminPending = approvalRows.filter((row) => nextApprovalStep(resolveApprovalLineForWorkOrder(row, users))?.role === "ADMIN");
  const executivePending = approvalRows.filter((row) => nextApprovalStep(resolveApprovalLineForWorkOrder(row, users))?.role === "EXECUTIVE");
  const myPending = approvalRows.filter((row) => {
    const step = nextApprovalStep(resolveApprovalLineForWorkOrder(row, users));
    return step ? canApproveApprovalStep(currentUser, step) : false;
  });
  const visibleRows =
    filter === "DONE"
      ? completedRows
      : approvalRows.filter((row) => {
          const step = nextApprovalStep(resolveApprovalLineForWorkOrder(row, users));
          if (filter === "ADMIN") return step?.role === "ADMIN";
          if (filter === "EXECUTIVE") return step?.role === "EXECUTIVE";
          return true;
        });

  return (
    <div className="section approval-board">
      <div className="section-header">
        <div>
          <h2>정비 완료 승인</h2>
          <p>정비사 완료보고 이후 고민서 책임 승인, 김민식 전무 최종승인 순서로 결재합니다.</p>
        </div>
        <span className="chip green">내 승인 {myPending.length}건</span>
      </div>
      <div className="approval-metric-grid">
        <button className={`metric metric-button ${filter === "ALL" ? "active" : ""}`} type="button" onClick={() => setFilter("ALL")}>
          <span>전체 승인대기</span>
          <strong>{approvalRows.length}</strong>
        </button>
        <button className={`metric metric-button ${filter === "ADMIN" ? "active" : ""}`} type="button" onClick={() => setFilter("ADMIN")}>
          <span>고민서 책임 단계</span>
          <strong>{adminPending.length}</strong>
        </button>
        <button className={`metric metric-button ${filter === "EXECUTIVE" ? "active" : ""}`} type="button" onClick={() => setFilter("EXECUTIVE")}>
          <span>김민식 전무 단계</span>
          <strong>{executivePending.length}</strong>
        </button>
        <button className={`metric metric-button ${filter === "DONE" ? "active" : ""}`} type="button" onClick={() => setFilter("DONE")}>
          <span>최근 승인완료</span>
          <strong>{completedRows.length}</strong>
        </button>
      </div>
      <div className="approval-list">
        {visibleRows.map((row) => (
          <ApprovalWorkflowCard
            currentUser={currentUser}
            key={row.id}
            row={row}
            users={users}
            onOpen={onOpen}
            onChanged={onChanged}
          />
        ))}
        {!visibleRows.length ? <p className="notice">현재 조건에 맞는 승인 대상이 없습니다.</p> : null}
      </div>
    </div>
  );
}

function ApprovalWorkflowCard({
  currentUser,
  row,
  users,
  onOpen,
  onChanged
}: {
  currentUser: AuthUser;
  row: WorkOrder;
  users: UserRow[];
  onOpen: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const line = resolveApprovalLineForWorkOrder(row, users);
  const adminStep = line.find((step) => step.role === "ADMIN");
  const executiveStep = line.find((step) => step.role === "EXECUTIVE");
  const currentStep = nextApprovalStep(line);
  const [adminApproverId, setAdminApproverId] = useState(adminStep?.approverId ?? "");
  const [executiveApproverId, setExecutiveApproverId] = useState(executiveStep?.approverId ?? "");
  const [message, setMessage] = useState("");
  const canEditLine = hasAnyRole(currentUser, ["SUPER_ADMIN", "ADMIN"]);
  const canApprove = currentStep ? canApproveApprovalStep(currentUser, currentStep) : false;
  const adminOptions = makeApproverOptions(users, ["SUPER_ADMIN", "ADMIN"], adminStep, "ko.ms", "고민서 책임");
  const executiveOptions = makeApproverOptions(users, ["EXECUTIVE"], executiveStep, "kim.ms", "김민식 전무");

  useEffect(() => {
    setAdminApproverId(adminStep?.approverId ?? "");
    setExecutiveApproverId(executiveStep?.approverId ?? "");
    setMessage("");
  }, [adminStep?.approverId, executiveStep?.approverId, row.id]);

  return (
    <article className={`approval-card ${priorityClass[row.priorityLevel]}`}>
      <div className="approval-card-main">
        <div className="approval-card-head">
          <div>
            <button className="link-button" type="button" onClick={() => onOpen(row.id)}>{row.requestNo}</button>
            <strong>{row.customer?.name ?? "미지정"} · {row.equipmentInput ?? row.equipmentNoNormalized ?? "-"}</strong>
            <p>{row.faultDescription}</p>
          </div>
          <div className="chips">
            <span className={`chip ${priorityChip[row.priorityLevel]}`}>{priorityLabel[row.priorityLevel]}</span>
            <span className="chip">{labelStatus(row.status)}</span>
            <span className="chip">목표일 {formatDate(row.targetDueDate)}</span>
          </div>
        </div>
        <ApprovalLineView steps={line} />
        <div className="approval-summary-grid">
          <Info label="정비사" value={row.assignedMechanic?.name ?? "미배정"} />
          <Info label="완료보고" value={formatDate(row.mechanicReportedAt ?? row.reports?.[0]?.submittedAt)} />
          <Info label="현재 단계" value={currentStep ? `${currentStep.label} · ${currentStep.approverName ?? "-"}` : "결재 완료"} />
        </div>
        {canEditLine ? (
          <div className="approval-select-grid">
            <Select label="관리자 승인자" value={adminApproverId} onChange={setAdminApproverId} options={adminOptions} />
            <Select label="임원 최종승인자" value={executiveApproverId} onChange={setExecutiveApproverId} options={executiveOptions} />
            <div className="field">
              <label>결재라인</label>
              <button
                type="button"
                onClick={async () => {
                  setMessage("");
                  try {
                    await patchJson(`/api/work-orders/${row.id}/approval-line`, { adminApproverId, executiveApproverId });
                    await onChanged();
                    setMessage("결재라인을 저장했습니다.");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "결재라인 저장에 실패했습니다.");
                  }
                }}
              >
                <Users size={16} />저장
              </button>
            </div>
          </div>
        ) : null}
        {message ? <p className={message.includes("실패") || message.includes("permission") ? "error" : "notice"}>{message}</p> : null}
      </div>
      <div className="approval-card-actions">
        <span>{currentStep ? `${currentStep.approverName ?? "-"} 차례` : "최종 승인 완료"}</span>
        <button className="small-button" type="button" onClick={() => onOpen(row.id)}>정비건 열기</button>
        <button
          className="primary"
          disabled={!canApprove}
          type="button"
          onClick={async () => {
            setMessage("");
            try {
              await postJson(`/api/work-orders/${row.id}/approve`, {});
              await onChanged();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "승인 처리에 실패했습니다.");
            }
          }}
        >
          <CheckCircle2 size={16} />내 승인 처리
        </button>
      </div>
    </article>
  );
}

function WorkOrdersPanel({
  workOrders,
  selected,
  users,
  currentUser,
  canAdmin,
  onSelect,
  onChanged
}: {
  workOrders: WorkOrder[];
  selected: WorkOrder | null;
  users: UserRow[];
  currentUser: AuthUser;
  canAdmin: boolean;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [mechanicFilter, setMechanicFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [sortBy, setSortBy] = useState("priority");
  const mechanicOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of workOrders) {
      if (row.assignedMechanic?.id) map.set(row.assignedMechanic.id, row.assignedMechanic.name);
    }
    for (const user of users) {
      if (user.roles.some((role) => role.role.code === "MECHANIC")) map.set(user.id, user.name);
    }
    return [{ value: "ALL", label: "전체 정비사" }, { value: "UNASSIGNED", label: "미배정" }, ...Array.from(map, ([value, label]) => ({ value, label }))];
  }, [users, workOrders]);
  const filtered = useMemo(() => {
    return sortWorkOrders(
      workOrders.filter((row) => {
        const priorityOk = priorityFilter === "ALL" || row.priorityLevel === priorityFilter;
        const mechanicOk =
          mechanicFilter === "ALL" ||
          (mechanicFilter === "UNASSIGNED" ? !row.assignedMechanic?.id : row.assignedMechanic?.id === mechanicFilter);
        const statusOk =
          statusFilter === "ALL" ||
          (statusFilter === "ACTIVE" ? !isClosed(row) : statusFilter === "COMPLETED" ? isClosed(row) : row.status === statusFilter);
        return priorityOk && mechanicOk && statusOk;
      }),
      sortBy
    );
  }, [mechanicFilter, priorityFilter, sortBy, statusFilter, workOrders]);

  return (
    <div className="panel-grid">
      <div className="section">
        <div className="section-header">
          <div>
            <h2>정비건 목록</h2>
            <p>인원, 우선순위, 상태 기준으로 필터링하고 목표일 또는 접수일 기준으로 정렬합니다.</p>
          </div>
          <span className="chip">{filtered.length}건</span>
        </div>
        <div className="filter-panel">
          <Select label="정비사" value={mechanicFilter} onChange={setMechanicFilter} options={mechanicOptions} />
          <Select label="우선순위" value={priorityFilter} onChange={setPriorityFilter} options={[{ value: "ALL", label: "전체 우선순위" }, ...priorityOptions]} />
          <Select
            label="상태"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "ACTIVE", label: "미결 전체" },
              { value: "ALL", label: "전체 상태" },
              { value: "COMPLETED", label: "완료/종결" },
              { value: "UNASSIGNED", label: "미배정" },
              { value: "ASSIGNED", label: "배정" },
              { value: "IN_PROGRESS", label: "작업중" },
              { value: "REPORT_SUBMITTED", label: "보고 대기" },
              { value: "DELAYED", label: "지연" },
              { value: "PART_WAITING", label: "부품 대기" }
            ]}
          />
          <Select
            label="정렬"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: "priority", label: "우선순위 높은 순" },
              { value: "target", label: "목표일 빠른 순" },
              { value: "requestDate", label: "접수 최신 순" },
              { value: "mechanic", label: "정비사별" },
              { value: "status", label: "상태별" }
            ]}
          />
        </div>
        <WorkList workOrders={filtered} selectedId={selected?.id} onSelect={onSelect} />
      </div>
      <WorkDetail selected={selected} users={users} currentUser={currentUser} canAdmin={canAdmin} onChanged={onChanged} />
    </div>
  );
}

function MechanicPanel({
  user,
  workOrders,
  selected,
  onSelect,
  onChanged
}: {
  user: AuthUser;
  workOrders: WorkOrder[];
  selected: WorkOrder | null;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const active = workOrders.filter((workOrder) => workOrder.assignedMechanic?.id === user.id && !isClosed(workOrder));
  const completed = workOrders.filter((workOrder) => workOrder.assignedMechanic?.id === user.id && isClosed(workOrder));
  const mechanicSelected = active.find((row) => row.id === selected?.id) ?? active[0] ?? null;

  return (
    <div className="panel-grid">
      <div className="section">
        <div className="section-header">
          <div>
            <h2>내 배정 업무</h2>
            <p>작업 시작, 완료보고, 목표일 변경 요청을 처리합니다.</p>
          </div>
          <span className="chip green">완료 {completed.length}건</span>
        </div>
        <WorkList workOrders={active} selectedId={mechanicSelected?.id} onSelect={onSelect} />
      </div>
      <MechanicActions selected={mechanicSelected} onChanged={onChanged} />
    </div>
  );
}

function WorkList({
  workOrders,
  selectedId,
  onSelect
}: {
  workOrders: WorkOrder[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  if (!workOrders.length) return <p className="notice">표시할 정비건이 없습니다.</p>;
  return (
    <div className="work-list">
      {workOrders.map((item) => (
        <button
          key={item.id}
          className={`work-card ${priorityClass[item.priorityLevel]} ${selectedId === item.id ? "selected" : ""}`}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          <div className="work-card-header">
            <div className="work-title">
              <strong>{item.requestNo} · {item.customer?.name ?? "미지정"}</strong>
              <span className="muted">{item.equipmentInput ?? item.equipmentNoNormalized} · {item.faultDescription}</span>
            </div>
            <span className={`chip ${priorityChip[item.priorityLevel]}`}>{priorityLabel[item.priorityLevel]}</span>
          </div>
          <div className="chips">
            <span className="chip">{labelStatus(item.status)}</span>
            <span className="chip">목표일 {formatDate(item.targetDueDate)}</span>
            <span className="chip">{item.assignedMechanic?.name ?? "미배정"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function PlanningPanel({
  currentUser,
  workOrders,
  dailyPlans,
  users,
  onChanged,
  onOpenWorkOrder
}: {
  currentUser: AuthUser;
  workOrders: WorkOrder[];
  dailyPlans: DailyWorkPlan[];
  users: UserRow[];
  onChanged: () => Promise<void>;
  onOpenWorkOrder: (id: string) => void;
}) {
  return (
    <div className="section planning-panel">
      <div className="section-header">
        <div>
          <h2>계획업무</h2>
          <p>미결 정비건을 선택해 계획업무를 요청하고, 관리자가 승인/반려/수정/최종확정까지 처리합니다.</p>
        </div>
        <span className="chip blue"><CalendarDays size={14} />계획 {dailyPlans.length}건</span>
      </div>
      <PlanningWorkflow
        currentUser={currentUser}
        workOrders={workOrders}
        dailyPlans={visiblePlansForUser(dailyPlans, currentUser, hasAnyRole(currentUser, ["SUPER_ADMIN", "ADMIN"]) ? "admin" : hasAnyRole(currentUser, ["EXECUTIVE"]) ? "executive" : "mechanic")}
        users={users}
        compact={false}
        onChanged={onChanged}
        onOpenWorkOrder={onOpenWorkOrder}
      />
    </div>
  );
}

function MobilePlanPanel({
  currentUser,
  workOrders,
  dailyPlans,
  users,
  mode,
  onChanged,
  onOpenWorkOrder
}: {
  currentUser: AuthUser;
  workOrders: WorkOrder[];
  dailyPlans: DailyWorkPlan[];
  users: UserRow[];
  mode: MobilePreviewMode;
  onChanged: () => Promise<void>;
  onOpenWorkOrder: (id: string) => void;
}) {
  return (
    <PlanningWorkflow
      currentUser={currentUser}
      workOrders={workOrders}
      dailyPlans={dailyPlans}
      users={users}
      compact
      mobileMode={mode}
      onChanged={onChanged}
      onOpenWorkOrder={onOpenWorkOrder}
    />
  );
}

function PlanningWorkflow({
  currentUser,
  workOrders,
  dailyPlans,
  users,
  compact,
  mobileMode,
  onChanged,
  onOpenWorkOrder
}: {
  currentUser: AuthUser;
  workOrders: WorkOrder[];
  dailyPlans: DailyWorkPlan[];
  users: UserRow[];
  compact: boolean;
  mobileMode?: MobilePreviewMode;
  onChanged: () => Promise<void>;
  onOpenWorkOrder: (id: string) => void;
}) {
  const canCreate = hasAnyRole(currentUser, ["SUPER_ADMIN", "ADMIN", "MECHANIC"]);
  const canAdminPlan = hasAnyRole(currentUser, ["SUPER_ADMIN", "ADMIN"]) || mobileMode === "admin";
  const openRows = useMemo(() => sortWorkOrders(workOrders.filter((row) => !isClosed(row)), "priority").slice(0, compact ? 8 : 24), [compact, workOrders]);
  const alerts = useMemo(() => buildPlanAlerts(dailyPlans, currentUser, canAdminPlan), [canAdminPlan, currentUser, dailyPlans]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState(() => toDateKey(new Date()));
  const [requestMemo, setRequestMemo] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedPlan = dailyPlans.find((plan) => plan.id === selectedPlanId) ?? dailyPlans[0] ?? null;

  function toggleWorkOrder(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function createPlan() {
    if (!selectedIds.length) {
      setMessage("계획업무로 묶을 미결 정비건을 선택하세요.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await postJson<DailyWorkPlan>("/api/daily-plans/request", {
        planDate,
        workOrderIds: selectedIds,
        itemDetails: selectedIds.map((workOrderId) => ({
          workOrderId,
          mechanicMemo: hasAnyRole(currentUser, ["MECHANIC"]) ? requestMemo : undefined,
          adminMemo: canAdminPlan ? requestMemo : undefined
        }))
      });
      setSelectedIds([]);
      setRequestMemo("");
      setMessage("계획업무가 관리자에게 공유되었습니다.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "계획업무 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`planning-layout ${compact ? "compact" : ""}`}>
      <section className="planning-column">
        <div className="planning-alert-box">
          <div className="mobile-ai-alert-head">
            <span><Bell size={14} />계획 알림</span>
            <strong>{alerts.length ? `${alerts.length}건` : "대기 없음"}</strong>
          </div>
          <div className="planning-alert-list">
            {alerts.length ? alerts.map((alert) => (
              <button className={`planning-alert ${alert.tone}`} key={alert.id} type="button" onClick={() => setSelectedPlanId(alert.planId)}>
                <span>{alert.label}</span>
                <strong>{alert.title}</strong>
                <p>{alert.body}</p>
              </button>
            )) : <p className="mobile-empty">확인할 계획업무 알림이 없습니다.</p>}
          </div>
        </div>

        {canCreate ? (
          <div className="planning-create">
            <div className="section-header">
              <div>
                <h3>미결 정비건으로 계획 작성</h3>
                <p>선택한 정비건을 계획업무로 묶어 관리자에게 공유합니다.</p>
              </div>
              <span className="chip green">{selectedIds.length}건 선택</span>
            </div>
            <Input label="계획일자" type="date" value={planDate} onChange={setPlanDate} />
            <div className="plan-select-list">
              {openRows.map((row) => (
                <label className={`plan-select-row ${selectedIds.includes(row.id) ? "active" : ""}`} key={row.id}>
                  <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleWorkOrder(row.id)} />
                  <span>
                    <strong>{row.requestNo} · {row.customer?.name ?? "-"}</strong>
                    <small>{priorityLabel[row.priorityLevel]} · {row.assignedMechanic?.name ?? "담당 미지정"} · 목표 {formatDate(row.targetDueDate)}</small>
                    <small>{row.faultDescription}</small>
                  </span>
                </label>
              ))}
              {!openRows.length ? <p className="notice">계획업무로 선택할 미결 정비건이 없습니다.</p> : null}
            </div>
            <div className="field">
              <label>{canAdminPlan ? "관리자 메모" : "정비사 메모"}</label>
              <textarea value={requestMemo} onChange={(event) => setRequestMemo(event.target.value)} placeholder="작업 순서, 준비 부품, 현장 유의사항 등을 입력하세요." />
            </div>
            {message ? <p className={message.includes("실패") ? "error" : "notice"}>{message}</p> : null}
            <button className="primary" type="button" disabled={saving} onClick={createPlan}>
              <Plus size={16} />{saving ? "공유 중" : "계획업무 공유"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="planning-column">
        <div className="planning-list">
          <div className="section-header">
            <div>
              <h3>계획 목록</h3>
              <p>승인 대기, 반려, 승인, 최종확정 상태를 확인합니다.</p>
            </div>
            <span className="chip">{dailyPlans.length}건</span>
          </div>
          {dailyPlans.length ? dailyPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              active={selectedPlan?.id === plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
            />
          )) : <p className="notice">표시할 계획업무가 없습니다.</p>}
        </div>
        <PlanDetail
          plan={selectedPlan}
          currentUser={currentUser}
          users={users}
          compact={compact}
          onChanged={onChanged}
          onOpenWorkOrder={onOpenWorkOrder}
        />
      </section>
    </div>
  );
}

function PlanCard({ plan, active, onClick }: { plan: DailyWorkPlan; active: boolean; onClick: () => void }) {
  return (
    <button className={`plan-card ${active ? "selected" : ""} ${plan.status.toLowerCase().replace("_", "-")}`} type="button" onClick={onClick}>
      <div>
        <strong>{formatDate(plan.planDate)} 계획 · {plan.items.length}건</strong>
        <p>{plan.items[0]?.workOrder.customer?.name ?? "-"} {plan.items.length > 1 ? `외 ${plan.items.length - 1}건` : ""}</p>
      </div>
      <span className={`chip ${planStatusChip(plan.status)}`}>{planStatusLabel(plan.status)}</span>
    </button>
  );
}

function PlanDetail({
  plan,
  currentUser,
  users,
  compact,
  onChanged,
  onOpenWorkOrder
}: {
  plan: DailyWorkPlan | null;
  currentUser: AuthUser;
  users: UserRow[];
  compact: boolean;
  onChanged: () => Promise<void>;
  onOpenWorkOrder: (id: string) => void;
}) {
  const canAdminPlan = hasAnyRole(currentUser, ["SUPER_ADMIN", "ADMIN"]);
  const locked = plan?.status === "FINAL_CONFIRMED";
  const mechanics = users.filter((user) => user.roles.some((role) => role.role.code === "MECHANIC"));
  const mechanicOptions = [{ value: "", label: "담당 미지정" }, ...mechanics.map((user) => ({ value: user.id, label: `${user.name} ${user.title ?? ""}`.trim() }))];
  const [draftDate, setDraftDate] = useState("");
  const [draftMemo, setDraftMemo] = useState("");
  const [itemDrafts, setItemDrafts] = useState<{ workOrderId: string; mechanicId?: string | null; adminMemo: string; mechanicMemo: string }[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftDate(toDateKey(plan?.planDate ?? new Date()));
    setDraftMemo(plan?.reviewMemo ?? "");
    setItemDrafts((plan?.items ?? []).map((item) => ({
      workOrderId: item.workOrderId,
      mechanicId: item.mechanicId,
      adminMemo: item.adminMemo ?? "",
      mechanicMemo: item.mechanicMemo ?? ""
    })));
    setMessage("");
  }, [plan?.id, plan?.planDate, plan?.reviewMemo, plan?.items]);

  if (!plan) return <div className="planning-detail">계획업무를 선택하세요.</div>;

  function updateItem(workOrderId: string, patch: Partial<{ mechanicId: string | null; adminMemo: string; mechanicMemo: string }>) {
    setItemDrafts((current) => current.map((item) => item.workOrderId === workOrderId ? { ...item, ...patch } : item));
  }

  async function submitUpdate() {
    if (!plan || locked) return;
    setSaving(true);
    setMessage("");
    try {
      await api<DailyWorkPlan>(`/api/daily-plans/${plan.id}`, {
        method: "PUT",
        body: JSON.stringify({
          planDate: draftDate,
          reviewMemo: draftMemo,
          itemDetails: itemDrafts
        })
      });
      setMessage(canAdminPlan ? "계획 수정 알림을 정비사에게 보냈습니다." : "계획 수정 요청을 관리자에게 보냈습니다.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "계획업무 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function approvePlan() {
    if (!plan) return;
    setSaving(true);
    setMessage("");
    try {
      await postJson<DailyWorkPlan>(`/api/daily-plans/${plan.id}/approve`, { memo: draftMemo });
      setMessage("계획업무를 승인했고 예정업무에 반영했습니다.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "계획업무 승인에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function rejectPlan() {
    if (!plan) return;
    const memo = window.prompt("반려 사유", draftMemo || "일정 또는 세부업무 보완 필요");
    if (!memo) return;
    setSaving(true);
    setMessage("");
    try {
      await postJson<DailyWorkPlan>(`/api/daily-plans/${plan.id}/reject`, { memo });
      setMessage("계획업무를 반려했고 정비사에게 알림을 보냈습니다.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "계획업무 반려에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function finalizePlan() {
    if (!plan) return;
    setSaving(true);
    setMessage("");
    try {
      await postJson<DailyWorkPlan>(`/api/daily-plans/${plan.id}/finalize`, { memo: draftMemo || "최종확정" });
      setMessage("계획업무를 최종확정했습니다. 추가 수정이 제한됩니다.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "계획업무 최종확정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="planning-detail">
      <div className="section-header">
        <div>
          <h3>{formatDate(plan.planDate)} 계획 세부업무</h3>
          <p>{plan.requestedBy?.name ?? "요청자 미지정"} 요청 · {plan.reviewedBy?.name ? `${plan.reviewedBy.name} 검토` : "관리자 검토 대기"}</p>
        </div>
        <span className={`chip ${planStatusChip(plan.status)}`}>{planStatusLabel(plan.status)}</span>
      </div>
      {locked ? <p className="notice"><Lock size={14} /> 최종확정된 계획업무입니다. 추가 수정이 제한됩니다.</p> : null}
      <div className="form-row">
        <Input label="계획일자" type="date" value={draftDate} onChange={setDraftDate} />
        <Input label="검토/변경 메모" value={draftMemo} onChange={setDraftMemo} />
      </div>
      <div className="plan-item-list">
        {plan.items.map((item) => {
          const draft = itemDrafts.find((row) => row.workOrderId === item.workOrderId);
          return (
            <article className={`plan-item-card ${priorityClass[item.workOrder.priorityLevel]}`} key={item.id}>
              <div className="plan-item-head">
                <div>
                  <button className="link-button" type="button" onClick={() => onOpenWorkOrder(item.workOrderId)}>
                    {item.workOrder.requestNo}
                  </button>
                  <strong>{item.workOrder.customer?.name ?? "-"} · {item.workOrder.equipmentInput ?? item.workOrder.equipmentNoNormalized ?? "-"}</strong>
                  <p>{item.workOrder.faultDescription}</p>
                </div>
                <span className={`chip ${priorityChip[item.workOrder.priorityLevel]}`}>{priorityLabel[item.workOrder.priorityLevel]}</span>
              </div>
              <div className="form-row">
                {canAdminPlan ? (
                  <Select
                    label="담당 정비사"
                    value={draft?.mechanicId ?? ""}
                    onChange={(value) => updateItem(item.workOrderId, { mechanicId: value || null })}
                    options={mechanicOptions}
                  />
                ) : (
                  <Info label="담당 정비사" value={item.mechanic?.name ?? item.workOrder.assignedMechanic?.name ?? "담당 미지정"} />
                )}
                <Info label="현재 목표일" value={formatDate(item.workOrder.targetDueDate)} />
              </div>
              <div className="form-row">
                <div className="field">
                  <label>관리자 세부지시</label>
                  <textarea
                    value={draft?.adminMemo ?? ""}
                    disabled={!canAdminPlan || locked}
                    onChange={(event) => updateItem(item.workOrderId, { adminMemo: event.target.value })}
                    placeholder="관리자 수정사항, 우선순위, 고객 공유 내용"
                  />
                </div>
                <div className="field">
                  <label>정비사 추가의견</label>
                  <textarea
                    value={draft?.mechanicMemo ?? ""}
                    disabled={locked}
                    onChange={(event) => updateItem(item.workOrderId, { mechanicMemo: event.target.value })}
                    placeholder="현장 상황, 부품 준비, 일정 변경 의견"
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {message ? <p className={message.includes("실패") || message.includes("수 없습니다") ? "error" : "notice"}>{message}</p> : null}
      <div className="toolbar">
        <button type="button" disabled={saving || locked} onClick={submitUpdate}>
          <Send size={16} />{canAdminPlan ? "수정 알림 전송" : "수정 요청"}
        </button>
        {canAdminPlan ? (
          <>
            <button className="primary" type="button" disabled={saving || locked} onClick={approvePlan}>
              <CheckCircle2 size={16} />승인
            </button>
            <button className="danger" type="button" disabled={saving || locked} onClick={rejectPlan}>
              <XCircle size={16} />반려
            </button>
            <button type="button" disabled={saving || locked} onClick={finalizePlan}>
              <Lock size={16} />최종확정
            </button>
          </>
        ) : null}
      </div>
      {compact ? <p className="mobile-empty">PC 화면의 계획업무 탭에서도 동일하게 작성/수정할 수 있습니다.</p> : null}
    </div>
  );
}

function WorkDetail({
  selected,
  users,
  currentUser,
  canAdmin,
  onChanged
}: {
  selected: WorkOrder | null;
  users: UserRow[];
  currentUser: AuthUser;
  canAdmin: boolean;
  onChanged: () => Promise<void>;
}) {
  const [mechanicId, setMechanicId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const mechanics = users.filter((user) => user.roles.some((role) => role.role.code === "MECHANIC"));
  const mechanicOptions = [{ value: "", label: "정비사 선택" }, ...mechanics.map((user) => ({ value: user.id, label: `${user.name} ${user.title ?? ""}`.trim() }))];

  if (!selected) return <div className="detail-panel">정비건을 선택하세요.</div>;
  const approvalLine = resolveApprovalLineForWorkOrder(selected, users);
  const currentApprovalStep = nextApprovalStep(approvalLine);
  const canApproveCurrentStep = currentApprovalStep ? canApproveApprovalStep(currentUser, currentApprovalStep) : false;
  return (
    <div className="detail-panel">
      <div className="section-header">
        <div>
          <h2>{selected.requestNo}</h2>
          <p>{selected.customer?.name} · {selected.equipmentInput}</p>
        </div>
        <span className={`chip ${priorityChip[selected.priorityLevel]}`}>{priorityLabel[selected.priorityLevel]}</span>
      </div>
      <div className="detail-grid">
        <Info label="상태" value={labelStatus(selected.status)} />
        <Info label="담당 정비사" value={selected.assignedMechanic?.name} />
        <Info label="목표일" value={formatDate(selected.targetDueDate)} />
        <Info label="연락처" value={selected.contactPhone} />
        <Info label="모델" value={selected.equipment?.modelName} />
        <Info label="차대번호" value={selected.equipment?.serialNo} />
        <Info label="진단 결과" value={selected.diagnosisResult} />
        <Info label="조치 내용" value={selected.actionTaken} />
      </div>
      <div className="section approval-inline">
        <div className="section-header">
          <div>
            <h3>완료 승인 결재라인</h3>
            <p>정비사 완료보고 후 관리자, 임원 순서로 최종 완료 처리됩니다.</p>
          </div>
        </div>
        <ApprovalLineView steps={approvalLine} />
        {currentApprovalStep ? (
          <div className="toolbar approval-action-bar">
            <span className="chip">현재 단계: {currentApprovalStep.label} · {currentApprovalStep.approverName ?? "-"}</span>
            <button
              className="primary"
              disabled={!canApproveCurrentStep}
              type="button"
              onClick={async () => {
                await postJson(`/api/work-orders/${selected.id}/approve`, {});
                await onChanged();
              }}
            >
              <CheckCircle2 size={16} />현재 단계 승인
            </button>
          </div>
        ) : (
          <p className="notice">결재가 모두 완료된 정비건입니다.</p>
        )}
      </div>
      {canAdmin ? (
        <div className="section">
          <h3>관리자 처리</h3>
          <div className="form-row">
            <Select label="담당자" value={mechanicId} onChange={setMechanicId} options={mechanicOptions} />
            <Input label="목표일" type="date" value={targetDate} onChange={setTargetDate} />
          </div>
          <div className="toolbar">
            <button
              type="button"
              onClick={async () => {
                if (mechanicId) await patchJson(`/api/work-orders/${selected.id}/assign`, { assignedMechanicId: mechanicId });
                await onChanged();
              }}
            >
              <UserCog size={16} />배정
            </button>
            <button
              type="button"
              onClick={async () => {
                if (targetDate) await patchJson(`/api/work-orders/${selected.id}/target`, { targetDueDate: targetDate });
                await onChanged();
              }}
            >
              <CalendarDays size={16} />목표일
            </button>
            <button
              className="danger"
              type="button"
              onClick={async () => {
                const reason = window.prompt("반려 사유");
                if (reason) {
                  await postJson(`/api/work-orders/${selected.id}/reject`, { reason });
                  await onChanged();
                }
              }}
            >
              반려
            </button>
          </div>
        </div>
      ) : (
        <div className="notice">배정과 목표일 변경은 관리자만 처리합니다. 결재 단계가 도착하면 위 승인 버튼이 활성화됩니다.</div>
      )}
      <Timeline selected={selected} />
    </div>
  );
}

function MechanicActions({ selected, onChanged }: { selected: WorkOrder | null; onChanged: () => Promise<void> }) {
  const [diagnosisResult, setDiagnosisResult] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [resultType, setResultType] = useState("COMPLETED");
  const [targetRequestDate, setTargetRequestDate] = useState("");
  const [reportFiles, setReportFiles] = useState<ReportUploadFile[]>([]);
  const [reportMessage, setReportMessage] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const reportFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setReportFiles([]);
    setReportMessage("");
    if (reportFileInputRef.current) reportFileInputRef.current.value = "";
  }, [selected?.id]);

  if (!selected) return <div className="detail-panel">현재 배정된 미결 업무가 없습니다.</div>;

  async function submitReport() {
    if (!selected) return;
    setSubmittingReport(true);
    setReportMessage("");
    try {
      const response = await postJson<ReportSubmitResponse>(`/api/work-orders/${selected.id}/report`, {
        resultType,
        diagnosisResult: diagnosisResult.trim() || "현장 점검 후 원인 확인",
        actionTaken: actionTaken.trim() || "조치 완료 후 시운전 확인"
      });
      for (const item of reportFiles) {
        const formData = new FormData();
        formData.append("reportId", response.report.id);
        formData.append("stage", item.stage);
        formData.append("file", item.file);
        await api<WorkReportAttachment>("/api/uploads/work-report", { method: "POST", body: formData });
      }
      setDiagnosisResult("");
      setActionTaken("");
      setReportFiles([]);
      if (reportFileInputRef.current) reportFileInputRef.current.value = "";
      setReportMessage(reportFiles.length ? `완료보고와 사진/영상 ${reportFiles.length}개가 등록되었습니다.` : "완료보고가 등록되었습니다.");
      await onChanged();
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : "완료보고 등록에 실패했습니다.");
    } finally {
      setSubmittingReport(false);
    }
  }

  return (
    <div className="detail-panel form-grid">
      <div className="section-header">
        <div>
          <h2>{selected.requestNo} 작업 처리</h2>
          <p>{selected.customer?.name} · {selected.faultDescription}</p>
        </div>
        <span className="chip">{labelStatus(selected.status)}</span>
      </div>
      <div className="toolbar">
        <button type="button" onClick={async () => { await postJson(`/api/work-orders/${selected.id}/start`, {}); await onChanged(); }}>
          <Wrench size={16} />작업 시작
        </button>
      </div>
      <Select label="완료 결과" value={resultType} onChange={setResultType} options={resultOptions} />
      <div className="field">
        <label>진단 결과</label>
        <textarea value={diagnosisResult} onChange={(event) => setDiagnosisResult(event.target.value)} placeholder="예: 유압 호스 연결부 누유 확인" />
      </div>
      <div className="field">
        <label>조치 내용</label>
        <textarea value={actionTaken} onChange={(event) => setActionTaken(event.target.value)} placeholder="예: 호스 클램프 교체 및 시운전 완료" />
      </div>
      <div className="field">
        <label htmlFor="reportPhotos">정비 전/후 사진·영상 첨부</label>
        <div className="file-picker">
          <input
            id="reportPhotos"
            ref={reportFileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(event) => {
              const nextFiles = Array.from(event.target.files ?? []).map((file, index) => ({
                id: `${file.name}-${file.lastModified}-${index}-${Math.random().toString(36).slice(2, 8)}`,
                file,
                stage: "AFTER" as AttachmentStage
              }));
              setReportFiles((current) => [...current, ...nextFiles]);
              event.currentTarget.value = "";
            }}
          />
          <small>정비 전 상태, 작업 중, 정비 후 결과 사진과 영상을 여러 개 첨부할 수 있습니다. 파일당 50MB 이하로 제한됩니다.</small>
        </div>
        {reportFiles.length ? (
          <div className="attachment-preview-grid">
            {reportFiles.map((item) => (
              <div className="attachment-preview" key={item.id}>
                <div className="attachment-preview-head">
                  <strong>{item.file.name}</strong>
                  <button
                    type="button"
                    onClick={() => setReportFiles((current) => current.filter((file) => file.id !== item.id))}
                  >
                    삭제
                  </button>
                </div>
                <span>{item.file.type.startsWith("video/") ? "영상" : "사진"} · {formatFileSize(item.file.size)}</span>
                <select
                  value={item.stage}
                  onChange={(event) =>
                    setReportFiles((current) =>
                      current.map((file) => file.id === item.id ? { ...file, stage: event.target.value as AttachmentStage } : file)
                    )
                  }
                >
                  {attachmentStageOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {reportMessage ? <p className="notice">{reportMessage}</p> : null}
      <button
        className="primary"
        type="button"
        disabled={submittingReport}
        onClick={submitReport}
      >
        <CheckCircle2 size={16} />{submittingReport ? "제출 중" : "완료보고 제출"}
      </button>
      <div className="form-row">
        <Input label="목표일 변경 요청" type="date" value={targetRequestDate} onChange={setTargetRequestDate} />
        <div className="field">
          <label>요청</label>
          <button
            type="button"
            onClick={async () => {
              if (targetRequestDate) {
                await postJson(`/api/work-orders/${selected.id}/target-change-requests`, {
                  requestedDate: targetRequestDate,
                  reason: "정비사 일정/현장 상황"
                });
                await onChanged();
              }
            }}
          >
            변경 요청
          </button>
        </div>
      </div>
      <Timeline selected={selected} />
    </div>
  );
}

function Timeline({ selected }: { selected: WorkOrder }) {
  const reports = selected.reports ?? [];
  const comments = selected.comments ?? [];
  return (
    <div className="section">
      <h3>댓글/보고</h3>
      {!reports.length && !comments.length ? <p className="muted">아직 등록된 보고가 없습니다.</p> : null}
      {reports.map((report) => (
        <div className="kv" key={report.id}>
          <span>{resultLabel[report.resultType] ?? report.resultType} · {formatDate(report.submittedAt)}</span>
          <strong>{report.actionTaken}</strong>
          <p className="muted">{report.diagnosisResult}</p>
          <ReportAttachments attachments={report.attachments ?? []} />
        </div>
      ))}
      {comments.map((comment) => (
        <div className="kv" key={comment.id}>
          <span>{comment.author?.name ?? "시스템"} · {formatDate(comment.createdAt)}</span>
          <strong>{comment.body}</strong>
        </div>
      ))}
    </div>
  );
}

function ReportAttachments({ attachments }: { attachments: WorkReportAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="report-attachments">
      {attachments.map((attachment) => (
        <div className="report-attachment" key={attachment.id}>
          {attachment.mediaType === "IMAGE" && attachment.publicPath ? (
            <img src={attachment.publicPath} alt={attachment.originalName} />
          ) : attachment.mediaType === "VIDEO" && attachment.publicPath ? (
            <video src={attachment.publicPath} controls preload="metadata" />
          ) : (
            <span className="file-thumb">{attachment.mediaType === "VIDEO" ? "영상" : "파일"}</span>
          )}
          <span>
            <strong>{attachment.originalName}</strong>
            <small>{attachmentStageLabel(attachment.stage)} · {formatFileSize(attachment.sizeBytes)}</small>
          </span>
          {attachment.publicPath ? (
            <a className="attachment-open-link" href={attachment.publicPath} target="_blank" rel="noreferrer">원본 열기</a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CalendarPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void api<WorkOrder[]>("/api/calendar/tasks").then(setRows);
  }, []);
  const monthDays = useMemo(() => calendarDays(month), [month]);
  const selectedRows = useMemo(
    () => rows.filter((row) => isDateWithinSchedule(selectedDate, row)),
    [rows, selectedDate]
  );
  const monthLabel = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;

  function selectDate(key: string, date: Date) {
    setSelectedDate(key);
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2>월간 진행 일정</h2>
          <p>접수일자부터 목표일까지 진행 막대로 표시하고, 날짜를 선택하면 해당 일자의 진행 내용을 확인합니다.</p>
        </div>
        <div className="toolbar">
          <button type="button" onClick={() => setMonth(addMonths(month, -1))}>이전 달</button>
          <span className="chip">{monthLabel}</span>
          <button type="button" onClick={() => setMonth(addMonths(month, 1))}>다음 달</button>
        </div>
      </div>
      <div className="calendar-board">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
        {monthDays.map((date) => {
          const key = toDateKey(date);
          const dayRows = sortWorkOrders(rows.filter((row) => isDateWithinSchedule(key, row)), "priority");
          const isSelected = selectedDate === key;
          const visibleRows = isSelected ? dayRows : dayRows.slice(0, 3);
          const hiddenCount = Math.max(dayRows.length - visibleRows.length, 0);
          const muted = date.getMonth() !== month.getMonth();
          return (
            <div
              role="button"
              tabIndex={0}
              className={`calendar-day ${isSelected ? "selected" : ""} ${muted ? "muted-day" : ""}`}
              key={key}
              onClick={() => selectDate(key, date)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectDate(key, date);
                }
              }}
            >
              <div className="calendar-day-head">
                <span className="calendar-date">{date.getDate()}</span>
                {dayRows.length ? <span className="calendar-count">진행 {dayRows.length}건</span> : null}
              </div>
              <div className="schedule-stack">
                {visibleRows.map((row) => (
                  <button
                    className={`schedule-bar ${priorityClass[row.priorityLevel]}`}
                    key={row.id}
                    title={calendarScheduleTitle(row, key)}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(row.id);
                    }}
                  >
                    {calendarScheduleLabel(row)}
                  </button>
                ))}
                {hiddenCount ? (
                  <button
                    className="calendar-more"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      selectDate(key, date);
                    }}
                  >
                    +{hiddenCount} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="section calendar-detail-section" ref={detailRef}>
        <div className="section-header">
          <div>
            <h2>{selectedDate} 진행 내용</h2>
            <p>선택한 날짜에 접수일과 목표일 범위가 걸쳐 있는 정비건입니다.</p>
          </div>
          <span className="chip">{selectedRows.length}건</span>
        </div>
        <WorkList workOrders={sortWorkOrders(selectedRows, "priority")} onSelect={onOpen} />
      </div>
    </div>
  );
}

function EquipmentPanel({ canManage, onOpenWorkOrder }: { canManage: boolean; onOpenWorkOrder: (id: string) => void }) {
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    status: "",
    managerName: "",
    location: "",
    operationType: "",
    operatingHours: ""
  });

  async function loadAssets() {
    const rows = await api<EquipmentAsset[]>("/api/equipment");
    setAssets(rows);
    setSelectedId((current) => (current && rows.some((row) => row.id === current) ? current : sortEquipmentAssets(rows)[0]?.id ?? null));
  }

  useEffect(() => {
    void loadAssets().catch((error) => setMessage(error instanceof Error ? error.message : "장비 목록을 불러오지 못했습니다."));
  }, []);

  const selected = assets.find((asset) => asset.id === selectedId) ?? assets[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    setForm({
      status: selected.status ?? "",
      managerName: selected.managerName ?? "",
      location: selected.location ?? selected.siteName ?? "",
      operationType: selected.operationType ?? "",
      operatingHours: selected.operatingHours ?? ""
    });
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sortEquipmentAssets(assets
      .filter((asset) => riskFilter === "ALL" || asset.riskLevel === riskFilter)
      .filter((asset) => {
        if (!normalized) return true;
        return [
          asset.normalizedNo,
          asset.equipmentNo,
          asset.placementNo,
          asset.customerName,
          asset.siteName,
          asset.modelName,
          asset.serialNo,
          asset.vehicleRegistrationNo,
          asset.managerName
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      }));
  }, [assets, query, riskFilter]);

  useEffect(() => {
    if (!filtered.length) return;
    if (!selectedId || !filtered.some((asset) => asset.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const criticalCount = assets.filter((asset) => asset.riskLevel === "CRITICAL").length;
  const watchCount = assets.filter((asset) => asset.riskLevel === "WATCH").length;
  const openCount = assets.reduce((sum, asset) => sum + asset.openWorkOrderCount, 0);
  const totalWorkOrders = assets.reduce((sum, asset) => sum + asset.workOrderCount, 0);

  async function importMasterList() {
    setMessage("");
    try {
      await postJson("/api/equipment/import-master-list", {});
      await loadAssets();
      setMessage("마스터 목록 기준 장비 목록을 갱신했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "마스터 목록 가져오기에 실패했습니다.");
    }
  }

  async function saveAsset(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !canManage) return;
    setSaving(true);
    setMessage("");
    try {
      await patchJson(`/api/equipment/${selected.id}`, form);
      setAssets((current) => current.map((asset) => (asset.id === selected.id ? { ...asset, ...form } : asset)));
      setMessage(`${equipmentDisplayName(selected)} 관리 정보가 저장되었습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "장비 정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section equipment-panel">
      <div className="section-header">
        <div>
          <h2>전체 장비/지게차 자산관리</h2>
          <p>마스터 목록 장비와 누적 정비 데이터를 연결해 잦은 고장, 교체/폐각 검토 대상을 확인합니다.</p>
        </div>
        <div className="toolbar">
          {canManage ? <button type="button" onClick={importMasterList}><Upload size={16} />마스터 목록 갱신</button> : null}
          <a className="icon-button" href="/api/exports/equipment-history" download><Download size={16} />장비 이력 엑셀</a>
        </div>
      </div>
      {message ? <p className="notice">{message}</p> : null}
      <div className="equipment-summary-grid">
        <Insight title="전체 장비" value={`${assets.length}대`} text="마스터 목록 기준 전체 자산" tone="blue" />
        <Insight title="교체/폐각 검토" value={`${criticalCount}대`} text="반복 고장, 긴급/지연 누적 장비" tone="red" />
        <Insight title="정밀점검 대상" value={`${watchCount}대`} text="예방정비 강화 필요 장비" tone="amber" />
        <Insight title="미결 정비" value={`${openCount}건`} text={`누적 정비 이력 ${totalWorkOrders}건`} tone="green" />
      </div>
      <div className="equipment-toolbar">
        <div className="field">
          <label>장비 검색</label>
          <div className="search-inline">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="호기, 장비 No, 고객, 모델, 차대번호 검색" />
          </div>
        </div>
        <Select
          label="관리 판단"
          value={riskFilter}
          onChange={setRiskFilter}
          options={[
            { value: "ALL", label: "전체" },
            { value: "CRITICAL", label: "교체/폐각 검토" },
            { value: "WATCH", label: "정밀점검 대상" },
            { value: "NORMAL", label: "일반 관리" }
          ]}
        />
      </div>
      <div className="equipment-layout">
        <section className="equipment-list" aria-label="장비 목록">
          {filtered.length ? (
            filtered.map((asset) => (
              <button
                className={`equipment-row ${asset.riskLevel.toLowerCase()} ${asset.id === selected?.id ? "selected" : ""}`}
                key={asset.id}
                type="button"
                onClick={() => setSelectedId(asset.id)}
              >
                <div>
                  <span className={`chip ${equipmentRiskChip(asset.riskLevel)}`}>{equipmentRiskLabel(asset.riskLevel)}</span>
                  <strong>{equipmentDisplayName(asset)} · {asset.customerName}</strong>
                  <p>{asset.modelName || "모델 미등록"} · {asset.tonnage || "톤수 미등록"} · {asset.siteName}</p>
                </div>
                <div className="equipment-row-stats">
                  <span>정비 {asset.workOrderCount}</span>
                  <span>미결 {asset.openWorkOrderCount}</span>
                  <span>긴급 {asset.urgentWorkOrderCount}</span>
                  <span>지연 {asset.delayedWorkOrderCount}</span>
                </div>
              </button>
            ))
          ) : (
            <p className="notice">조건에 맞는 장비가 없습니다.</p>
          )}
        </section>
        <aside className="equipment-detail">
          {selected ? (
            <>
              <div className={`equipment-decision ${selected.riskLevel.toLowerCase()}`}>
                <span>{equipmentRiskLabel(selected.riskLevel)}</span>
                <strong>{selected.recommendation}</strong>
                <p>{selected.lastFaultDescription || "누적 정비 이력이 없으면 일반 자산관리 대상으로 유지합니다."}</p>
              </div>
              <div className="detail-grid">
                <Info label="장비/호기" value={equipmentDisplayName(selected)} />
                <Info label="장비 No" value={selected.equipmentNo} />
                <Info label="배치 No" value={selected.placementNo} />
                <Info label="고객/현장" value={`${selected.customerName} · ${selected.siteName}`} />
                <Info label="모델/톤수" value={`${selected.modelName || "-"} · ${selected.tonnage || "-"}`} />
                <Info label="차대번호" value={selected.serialNo} />
                <Info label="차량등록" value={selected.vehicleRegistrationNo} />
                <Info label="년식/가동시간" value={`${selected.year || "-"} · ${selected.operatingHours || "-"}`} />
              </div>
              <form className="equipment-manage-form" onSubmit={saveAsset}>
                <div className="section-header">
                  <h3>관리 정보</h3>
                  {!canManage ? <span className="chip">관리자 수정 가능</span> : null}
                </div>
                <Input label="상태" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} />
                <Input label="담당자" value={form.managerName} onChange={(value) => setForm((current) => ({ ...current, managerName: value }))} />
                <Input label="배치장소" value={form.location} onChange={(value) => setForm((current) => ({ ...current, location: value }))} />
                <Input label="운영구분" value={form.operationType} onChange={(value) => setForm((current) => ({ ...current, operationType: value }))} />
                <Input label="가동시간" value={form.operatingHours} onChange={(value) => setForm((current) => ({ ...current, operatingHours: value }))} />
                <button className="primary" type="submit" disabled={!canManage || saving}>{saving ? "저장 중" : "관리정보 저장"}</button>
              </form>
              <div className="equipment-history">
                <div className="section-header">
                  <h3>최근 정비 이력</h3>
                  <span className="chip">{selected.workOrderCount}건</span>
                </div>
                {selected.recentWorkOrders.length ? (
                  selected.recentWorkOrders.map((row) => (
                    <button className={`equipment-history-row ${priorityClass[row.priorityLevel as WorkOrder["priorityLevel"]] ?? ""}`} key={row.id} type="button" onClick={() => onOpenWorkOrder(row.id)}>
                      <span>{formatDate(row.requestDate)} · {row.requestNo} · {labelStatus(row.status)}</span>
                      <strong>{row.faultDescription}</strong>
                      <p>{row.assignedMechanicName || "담당 미지정"} · {priorityLabel[row.priorityLevel as WorkOrder["priorityLevel"]] ?? row.priorityLevel}</p>
                    </button>
                  ))
                ) : (
                  <p className="notice">누적 정비 이력이 없습니다.</p>
                )}
              </div>
            </>
          ) : (
            <p className="notice">장비를 선택하세요.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function KpiPanel({ enabled, workOrders, onOpen }: { enabled: boolean; workOrders: WorkOrder[]; onOpen: (id: string) => void }) {
  const [mechanics, setMechanics] = useState<Record<string, unknown>[]>([]);
  const [priorities, setPriorities] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    if (!enabled) return;
    void Promise.all([
      api<Record<string, unknown>[]>("/api/admin/kpi/mechanics"),
      api<Record<string, unknown>[]>("/api/admin/kpi/priorities")
    ]).then(([mechanicRows, priorityRows]) => {
      setMechanics(mechanicRows);
      setPriorities(priorityRows);
    });
  }, [enabled]);
  if (!enabled) return <p className="notice">KPI는 관리자와 임원만 조회할 수 있습니다.</p>;

  const totalReceived = priorities.reduce((sum, row) => sum + Number(row.received ?? 0), 0);
  const totalCompleted = priorities.reduce((sum, row) => sum + Number(row.completed ?? 0), 0);
  const totalDelayed = priorities.reduce((sum, row) => sum + Number(row.delayed ?? 0), 0);
  const urgentRows = workOrders.filter((row) => row.priorityLevel === "P1" && !isClosed(row));
  const reportWaiting = workOrders.filter((row) => row.status === "REPORT_SUBMITTED");
  const delayedRows = workOrders.filter((row) => row.isDelayed || row.status === "DELAYED");
  const noteworthy = noteworthyWorkOrders(workOrders).slice(0, 8);

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2>임원 보고/KPI</h2>
          <p>정비사별 처리량, 우선순위별 완료율, 특이사항과 진행 리스크를 한 페이지에서 확인합니다.</p>
        </div>
        <div className="toolbar">
          <a className="icon-button" href="/api/admin/kpi/report"><Download size={16} />원페이지 보고 엑셀</a>
          <a className="icon-button" href="/api/admin/kpi/export"><Download size={16} />KPI 엑셀</a>
        </div>
      </div>
      <div className="insight-grid">
        <Insight title="접수" value={`${totalReceived}건`} text="데모 기간 전체 접수" tone="blue" />
        <Insight title="완료" value={`${totalCompleted}건`} text="관리자 최종 승인 기준" tone="green" />
        <Insight title="지연" value={`${totalDelayed}건`} text="목표일 초과 또는 지연 상태" tone="amber" />
        <Insight title="승인 대기" value={`${reportWaiting.length}건`} text="정비사 보고 후 관리자 검토 필요" tone="red" />
      </div>
      <div className="report-page">
        <div className="section-header">
          <div>
            <h2>특이사항 및 진행 현황</h2>
            <p>임원 보고 시 바로 읽을 수 있는 원페이지 요약입니다.</p>
          </div>
          <div className="chips">
            <span className="chip red">긴급 {urgentRows.length}건</span>
            <span className="chip amber">지연 {delayedRows.length}건</span>
            <span className="chip green">보고 대기 {reportWaiting.length}건</span>
          </div>
        </div>
        <div className="report-grid">
          <div className="tool-panel">
            <h3>관리 포인트</h3>
            <div className="kv"><span>긴급</span><strong>P1 미완료 건은 당일 목표일 기준으로 우선 처리합니다.</strong></div>
            <div className="kv"><span>승인</span><strong>보고 대기 건은 관리자 승인 전까지 KPI 완료로 반영하지 않습니다.</strong></div>
            <div className="kv"><span>지연</span><strong>목표일 초과 건은 부품/외주/현장 사유를 함께 확인합니다.</strong></div>
          </div>
          <div className="tool-panel">
            <h3>주요 특이사항</h3>
            {noteworthy.map((row) => (
              <button className="kv compact clickable-kv" key={row.id} type="button" onClick={() => onOpen(row.id)}>
                <span>{row.requestNo} · {priorityLabel[row.priorityLevel]} · {labelStatus(row.status)}</span>
                <strong>{row.customer?.name ?? "-"} / {row.assignedMechanic?.name ?? "미배정"}</strong>
                <p className="muted">{row.actionTaken || row.diagnosisResult || row.faultDescription}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
      <SimpleTable rows={mechanics} title="정비사별 KPI" />
      <SimpleTable rows={priorities} title="우선순위별 KPI" />
    </div>
  );
}

function AdminPanel({
  currentUser,
  users,
  onChanged
}: {
  currentUser: AuthUser;
  users: UserRow[];
  onChanged: () => Promise<void>;
}) {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [newUser, setNewUser] = useState({
    loginId: "",
    name: "",
    title: "",
    team: "",
    phone: "",
    email: "",
    temporaryPassword: "User!2026Test",
    roleCodes: ["MECHANIC"]
  });
  const roleOptions = [
    { code: "MECHANIC", label: "정비사" },
    { code: "RECEPTIONIST", label: "접수자" },
    { code: "ADMIN", label: "관리자" },
    { code: "EXECUTIVE", label: "임원" },
    ...(currentUser.roles.includes("SUPER_ADMIN") ? [{ code: "SUPER_ADMIN", label: "최고 관리자" }] : [])
  ];

  async function importMasterList() {
    await postJson("/api/equipment/import-master-list", {});
    setMessage("마스터 목록 데모 가져오기가 완료되었습니다.");
    await onChanged();
  }

  async function loadLogs() {
    setLogs(await api<Record<string, unknown>[]>("/api/admin/audit-logs"));
  }

  function setNewUserField(name: keyof typeof newUser, value: string | string[]) {
    setNewUser((current) => ({ ...current, [name]: value }));
  }

  function toggleRole(roleCode: string) {
    setNewUser((current) => {
      const exists = current.roleCodes.includes(roleCode);
      const roleCodes = exists ? current.roleCodes.filter((code) => code !== roleCode) : [...current.roleCodes, roleCode];
      return { ...current, roleCodes: roleCodes.length ? roleCodes : ["MECHANIC"] };
    });
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await postJson("/api/admin/users", {
        ...newUser,
        email: newUser.email || undefined
      });
      setMessage(`${newUser.name} 계정이 생성되었습니다. 초기 비밀번호: ${newUser.temporaryPassword}`);
      setNewUser({
        loginId: "",
        name: "",
        title: "",
        team: "",
        phone: "",
        email: "",
        temporaryPassword: "User!2026Test",
        roleCodes: ["MECHANIC"]
      });
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "계정을 생성하지 못했습니다.");
    }
  }

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2>관리자 설정</h2>
          <p>고민서 책임 계정으로 사용자 생성, 권한 부여, 마스터 목록 가져오기, 감사로그를 확인합니다.</p>
        </div>
        <div className="toolbar">
          <button onClick={importMasterList} type="button"><Upload size={16} />마스터 목록 가져오기</button>
          <button onClick={loadLogs} type="button"><Shield size={16} />감사로그</button>
        </div>
      </div>
      <form className="tool-panel form-grid" onSubmit={createUser}>
        <div className="section-header">
          <div>
            <h2>하부 사용자 계정 생성</h2>
            <p>최고 관리자는 관리자, 임원, 정비사, 접수자 권한을 직접 부여할 수 있습니다.</p>
          </div>
        </div>
        <div className="form-row">
          <Input label="아이디" value={newUser.loginId} onChange={(value) => setNewUserField("loginId", value)} />
          <Input label="임시 비밀번호" value={newUser.temporaryPassword} onChange={(value) => setNewUserField("temporaryPassword", value)} />
        </div>
        <div className="form-row">
          <Input label="이름" value={newUser.name} onChange={(value) => setNewUserField("name", value)} />
          <Input label="직책" value={newUser.title} onChange={(value) => setNewUserField("title", value)} />
        </div>
        <div className="form-row">
          <Input label="팀" value={newUser.team} onChange={(value) => setNewUserField("team", value)} />
          <Input label="연락처" value={newUser.phone} onChange={(value) => setNewUserField("phone", value)} />
        </div>
        <Input label="이메일" value={newUser.email} onChange={(value) => setNewUserField("email", value)} />
        <div className="field">
          <label>권한</label>
          <div className="role-options">
            {roleOptions.map((role) => (
              <label className="check-row" key={role.code}>
                <input
                  type="checkbox"
                  checked={newUser.roleCodes.includes(role.code)}
                  onChange={() => toggleRole(role.code)}
                />
                <span>{role.label}</span>
              </label>
            ))}
          </div>
        </div>
        {message ? <div className="notice">{message}</div> : null}
        <button className="primary" type="submit"><Plus size={16} />계정 생성 및 권한 부여</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>이름</th><th>아이디</th><th>역할</th><th>팀</th><th>상태</th></tr></thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id}>
                <td>{row.name} {row.title}</td>
                <td>{row.loginId}</td>
                <td>{row.roles.map((role) => role.role.name).join(", ")}</td>
                <td>{row.team}</td>
                <td>{row.isActive ? "활성" : "비활성"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {logs.length ? <SimpleTable rows={logs.slice(0, 20)} title="최근 감사로그" /> : null}
    </div>
  );
}

function ExportsPanel() {
  const links = [
    ["/api/admin/kpi/report", "원페이지 임원 보고"],
    ["/api/exports/daily-status", "일일 업무 진행 현황"],
    ["/api/exports/work-diary", "업무일지"],
    ["/api/exports/monthly", "월별 정비 현황"],
    ["/api/exports/site", "사업장별 정비 현황"],
    ["/api/exports/mechanic", "정비사별 처리 현황"],
    ["/api/exports/pending", "미결 현황"],
    ["/api/exports/completed", "완료 현황"],
    ["/api/exports/equipment-history", "차량별 정비 이력"]
  ];
  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2>엑셀 다운로드</h2>
          <p>다운로드 파일은 수정 가능한 xlsx 형식으로 생성됩니다.</p>
        </div>
      </div>
      <div className="metric-grid">
        {links.map(([href, label]) => (
          <a className="metric download-tile" href={href} download key={href}>
            <span><Download size={16} /> 다운로드</span>
            <strong>{label}</strong>
          </a>
        ))}
      </div>
    </div>
  );
}

function Insight({ title, value, text, tone }: { title: string; value: string; text: string; tone: "red" | "amber" | "green" | "blue" }) {
  return (
    <div className={`insight ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{text}</p>
    </div>
  );
}

function SimpleTable({ rows, title }: { rows: Record<string, unknown>[]; title: string }) {
  const keys = Object.keys(rows[0] ?? {});
  return (
    <div className="section">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>{keys.map((key) => <td key={key}>{formatCell(row[key])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApprovalLineView({ steps }: { steps: ApprovalStep[] }) {
  return (
    <ol className="approval-line" aria-label="완료 승인 결재라인">
      {steps.map((step) => (
        <li className={`approval-step ${approvalStatusClass(step.status)}`} key={step.id}>
          <span className="approval-step-dot">{step.status === "APPROVED" ? <CheckCircle2 size={13} /> : null}</span>
          <div>
            <strong>{step.label}</strong>
            <span>{step.approverName ?? "-"}</span>
            <small>{approvalStatusLabel(step.status)}{step.approvedAt ? ` · ${formatDate(step.approvedAt)}` : ""}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option value={option.value} key={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function hasAnyRole(user: AuthUser, roles: string[]) {
  return roles.some((role) => user.roles.includes(role));
}

function resolveApprovalLineForWorkOrder(row: WorkOrder, users: UserRow[]): ApprovalStep[] {
  const existing = Array.isArray(row.approvalLine) ? row.approvalLine.filter(isApprovalStep) : [];
  if (existing.length) return existing;
  const admin = findDefaultApprover(users, ["SUPER_ADMIN", "ADMIN"], "ko.ms", "고민서 책임");
  const executive = findDefaultApprover(users, ["EXECUTIVE"], "kim.ms", "김민식 전무");
  const mechanicDone = Boolean(row.mechanicReportedAt || row.reports?.length);
  const finalDone = Boolean(row.finalCompletedAt || row.status === "FINAL_COMPLETED" || row.status === "TEMPORARY_ACTION");
  const adminDone = Boolean(row.adminApprovedAt || finalDone);
  return [
    {
      id: "mechanic-report",
      role: "MECHANIC",
      label: "정비사 완료보고",
      approverId: row.assignedMechanic?.id,
      approverName: row.assignedMechanic?.name ?? "미배정",
      approverTitle: row.assignedMechanic?.title,
      status: mechanicDone ? "APPROVED" : "PENDING",
      requestedAt: row.requestDate,
      approvedAt: row.mechanicReportedAt ?? row.reports?.[0]?.submittedAt ?? null
    },
    {
      id: "admin-approval",
      role: "ADMIN",
      label: "관리자 승인",
      approverId: admin.id,
      approverName: admin.name,
      approverTitle: admin.title,
      status: adminDone ? "APPROVED" : mechanicDone ? "PENDING" : "NOT_STARTED",
      requestedAt: row.mechanicReportedAt ?? row.reports?.[0]?.submittedAt ?? null,
      approvedAt: row.adminApprovedAt ?? null
    },
    {
      id: "executive-approval",
      role: "EXECUTIVE",
      label: "임원 최종승인",
      approverId: executive.id,
      approverName: executive.name,
      approverTitle: executive.title,
      status: finalDone ? "APPROVED" : adminDone ? "PENDING" : "NOT_STARTED",
      requestedAt: row.adminApprovedAt ?? null,
      approvedAt: row.finalCompletedAt ?? null
    }
  ];
}

function isApprovalStep(value: unknown): value is ApprovalStep {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ApprovalStep>;
  return typeof item.id === "string" && typeof item.role === "string" && typeof item.label === "string" && typeof item.status === "string";
}

function findDefaultApprover(users: UserRow[], roleCodes: string[], preferredLoginId: string, fallbackName: string) {
  const user =
    users.find((item) => item.loginId === preferredLoginId) ??
    users.find((item) => item.roles.some((role) => roleCodes.includes(role.role.code)));
  return {
    id: user?.id ?? "",
    name: user ? `${user.name} ${user.title ?? ""}`.trim() : fallbackName,
    title: user?.title ?? null
  };
}

function makeApproverOptions(
  users: UserRow[],
  roleCodes: string[],
  currentStep: ApprovalStep | undefined,
  preferredLoginId: string,
  fallbackLabel: string
): SelectOption[] {
  const map = new Map<string, string>();
  const preferred = users.find((user) => user.loginId === preferredLoginId);
  if (preferred) map.set(preferred.id, `${preferred.name} ${preferred.title ?? ""}`.trim());
  for (const user of users) {
    if (user.roles.some((role) => roleCodes.includes(role.role.code))) {
      map.set(user.id, `${user.name} ${user.title ?? ""}`.trim());
    }
  }
  if (currentStep?.approverId) {
    map.set(currentStep.approverId, currentStep.approverName ?? fallbackLabel);
  }
  const options = Array.from(map, ([value, label]) => ({ value, label }));
  return options.length ? options : [{ value: "", label: fallbackLabel }];
}

function isApprovalTarget(row: WorkOrder, users: UserRow[]) {
  if (row.status === "FINAL_COMPLETED" || row.status === "CANCELLED" || row.status === "ARCHIVED") return false;
  const step = nextApprovalStep(resolveApprovalLineForWorkOrder(row, users));
  return Boolean(step && step.role !== "MECHANIC" && ["REPORT_SUBMITTED", "ADMIN_REVIEW", "TEMPORARY_ACTION"].includes(row.status));
}

function nextApprovalStep(steps: ApprovalStep[]) {
  return steps.find((step) => step.status === "PENDING" && step.role !== "MECHANIC") ?? null;
}

function canApproveApprovalStep(user: AuthUser, step: ApprovalStep) {
  if (user.roles.includes("SUPER_ADMIN")) return true;
  if (step.approverId && step.approverId !== user.id) return false;
  if (step.role === "ADMIN") return user.roles.includes("ADMIN");
  if (step.role === "EXECUTIVE") return user.roles.includes("EXECUTIVE");
  return false;
}

function approvalStatusClass(status: ApprovalStep["status"]) {
  return status.toLowerCase().replace("_", "-");
}

function approvalStatusLabel(status: ApprovalStep["status"]) {
  return {
    NOT_STARTED: "대기 전",
    PENDING: "승인 대기",
    APPROVED: "승인 완료",
    REJECTED: "반려"
  }[status];
}

function buildMobileAiAlerts(rows: WorkOrder[]): MobileAiAlert[] {
  const alerts = new Map<string, MobileAiAlert>();
  const equipmentGroups = new Map<string, WorkOrder[]>();

  for (const row of rows) {
    const key = equipmentKey(row);
    if (!key) continue;
    const group = equipmentGroups.get(key) ?? [];
    group.push(row);
    equipmentGroups.set(key, group);
  }

  for (const group of equipmentGroups.values()) {
    const sortedGroup = sortWorkOrders(group, "requestDate");
    const latest = sortedGroup[0];
    if (!latest) continue;
    if (sortedGroup.length >= 2) {
      const level = sortedGroup.length >= 3 || sortedGroup.some((row) => row.priorityLevel === "P1" || row.isDelayed || row.status === "DELAYED") ? "critical" : "warning";
      const equipment = equipmentLabel(latest);
      alerts.set(`repeat-${equipmentKey(latest)}`, {
        id: `repeat-${equipmentKey(latest)}`,
        level,
        title: `${equipment} 반복 고장 ${sortedGroup.length}건`,
        message: "동일 장비에서 고장 접수가 반복됩니다. 주요 부품, 사용 조건, 이전 임시조치 부위를 함께 점검하세요.",
        equipment,
        count: sortedGroup.length,
        primaryWorkOrderId: latest.id
      });
    }
  }

  for (const row of rows) {
    const text = `${row.faultDescription} ${row.memo ?? ""} ${row.diagnosisResult ?? ""} ${row.actionTaken ?? ""}`;
    const hasRecurSignal = /재발|반복|재방문|다시|또\s*/.test(text);
    const hasRiskSignal = !isClosed(row) && (row.priorityLevel === "P1" || row.isDelayed || row.status === "DELAYED");
    if (!hasRecurSignal && !hasRiskSignal) continue;

    const equipment = equipmentLabel(row);
    const id = `risk-${row.id}`;
    alerts.set(id, {
      id,
      level: hasRiskSignal ? "critical" : "warning",
      title: hasRecurSignal ? `${equipment} 재발 신호 감지` : `${equipment} 긴급 점검 필요`,
      message: hasRecurSignal
        ? "고장 내용에 재발 또는 재방문 신호가 있습니다. 같은 증상이 다시 생기지 않도록 원인 부품과 운행 조건을 유념하세요."
        : "긴급 또는 지연 상태입니다. 장비 사용 전 안전 점검과 담당자 확인이 필요합니다.",
      equipment,
      count: 1,
      primaryWorkOrderId: row.id
    });
  }

  return Array.from(alerts.values())
    .sort((a, b) => aiAlertRank(a.level) - aiAlertRank(b.level) || b.count - a.count || a.equipment.localeCompare(b.equipment, "ko"))
    .slice(0, 6);
}

function aiAlertRank(level: MobileAiAlert["level"]) {
  return { critical: 0, warning: 1, info: 2 }[level];
}

function equipmentKey(row: WorkOrder) {
  const raw =
    row.equipment?.serialNo ??
    row.equipment?.equipmentNo ??
    row.equipment?.placementNo ??
    row.equipment?.vehicleRegistrationNo ??
    row.equipmentNoNormalized ??
    row.equipmentInput ??
    "";
  return raw.toLowerCase().replace(/[^\p{Letter}\p{Number}]/gu, "");
}

function equipmentLabel(row: WorkOrder) {
  return row.equipmentInput ?? row.equipmentNoNormalized ?? row.equipment?.equipmentNo ?? row.equipment?.serialNo ?? "장비 미지정";
}

function equipmentDisplayName(asset: EquipmentAsset) {
  return asset.normalizedNo || asset.equipmentNo || asset.placementNo || asset.serialNo || "장비 미지정";
}

function equipmentRiskLabel(riskLevel: EquipmentAsset["riskLevel"]) {
  return {
    CRITICAL: "교체/폐각 검토",
    WATCH: "정밀점검 대상",
    NORMAL: "일반 관리"
  }[riskLevel];
}

function equipmentRiskChip(riskLevel: EquipmentAsset["riskLevel"]) {
  return {
    CRITICAL: "red",
    WATCH: "amber",
    NORMAL: "green"
  }[riskLevel];
}

function equipmentRiskRank(riskLevel: EquipmentAsset["riskLevel"]) {
  return {
    CRITICAL: 0,
    WATCH: 1,
    NORMAL: 2
  }[riskLevel];
}

function sortEquipmentAssets(rows: EquipmentAsset[]) {
  return [...rows].sort((a, b) => equipmentRiskRank(a.riskLevel) - equipmentRiskRank(b.riskLevel) || b.workOrderCount - a.workOrderCount || a.customerName.localeCompare(b.customerName, "ko"));
}

function initialMobilePreviewMode(user: AuthUser): MobilePreviewMode {
  if (hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"])) return "admin";
  if (hasAnyRole(user, ["EXECUTIVE"])) return "executive";
  return "mechanic";
}

function uniqueWorkOrders(rows: WorkOrder[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function makeMechanicOptions(workOrders: WorkOrder[], users: UserRow[]) {
  const map = new Map<string, string>();
  for (const row of workOrders) {
    if (row.assignedMechanic?.id) map.set(row.assignedMechanic.id, row.assignedMechanic.name);
  }
  for (const user of users) {
    if (user.roles.some((role) => role.role.code === "MECHANIC")) map.set(user.id, user.name);
  }
  return [{ value: "ALL", label: "전체 정비사" }, { value: "UNASSIGNED", label: "미배정" }, ...Array.from(map, ([value, label]) => ({ value, label }))];
}

function isDailyStatusTarget(row: WorkOrder, key: string) {
  return (
    isDateWithinSchedule(key, row) ||
    isSameDayKey(key, row.requestDate) ||
    isSameDayKey(key, row.targetDueDate) ||
    isSameDayKey(key, row.mechanicReportedAt) ||
    isSameDayKey(key, row.finalCompletedAt)
  );
}

function isRiskWorkOrder(row: WorkOrder, key: string) {
  const target = toDateKey(row.targetDueDate ?? "");
  const targetOver = Boolean(target && target < key && !isClosed(row));
  return Boolean(row.isDelayed || row.status === "DELAYED" || targetOver || (row.priorityLevel === "P1" && !isClosed(row)));
}

function dailyStatusReason(row: WorkOrder, key: string) {
  if (isSameDayKey(key, row.finalCompletedAt)) return "금일 완료";
  if (isSameDayKey(key, row.mechanicReportedAt)) return "금일 보고";
  if (isSameDayKey(key, row.requestDate)) return "금일 접수";
  if (isSameDayKey(key, row.targetDueDate)) return "금일 목표일";
  if (isDateWithinSchedule(key, row)) return "진행 범위";
  return "참조";
}

function dailyDetailText(row: WorkOrder) {
  const latestReport = row.reports?.[0];
  if (row.actionTaken || latestReport?.actionTaken) return `조치: ${row.actionTaken ?? latestReport?.actionTaken}`;
  if (row.diagnosisResult || latestReport?.diagnosisResult) return `진단: ${row.diagnosisResult ?? latestReport?.diagnosisResult}`;
  if (row.comments?.[0]?.body) return `최근 메모: ${row.comments[0].body}`;
  return "등록된 조치/보고 내용이 아직 없습니다.";
}

function calendarScheduleLabel(row: WorkOrder) {
  const place = row.customer?.name ?? row.site?.name ?? equipmentLabel(row);
  return `${row.requestNo} · ${place}`;
}

function calendarScheduleTitle(row: WorkOrder, key: string) {
  const mechanic = row.assignedMechanic?.name ?? "미배정";
  return `${calendarScheduleLabel(row)} · ${labelStatus(row.status)} · ${priorityLabel[row.priorityLevel]} · ${mechanic} · ${dailyStatusReason(row, key)}`;
}

function dailyActionText(row: WorkOrder, key: string) {
  if (!row.assignedMechanic?.id && !isClosed(row)) return "정비사 배정 필요";
  if (row.status === "REPORT_SUBMITTED") return "완료보고 검토 후 승인";
  if (isRiskWorkOrder(row, key)) return "지연 사유와 목표일 재조정 확인";
  if (row.status === "PART_WAITING") return "부품 입고 일정 확인";
  if (row.status === "ON_HOLD" || row.priorityLevel === "OUTSOURCE") return "외주/보류 일정 확인";
  if (row.status === "IN_PROGRESS") return "작업 진행 상태 확인";
  if (isClosed(row)) return "완료 내용 보관";
  return "금일 처리 상태 모니터링";
}

function targetStatusText(row: WorkOrder, key: string) {
  if (isClosed(row)) return `완료 ${formatDate(row.finalCompletedAt ?? row.mechanicReportedAt)}`;
  const target = toDateKey(row.targetDueDate ?? "");
  if (!target) return "목표일 미지정";
  if (target < key) return "목표일 초과";
  if (target === key) return "오늘 마감";
  return `D-${daysBetween(key, target)}`;
}

function daysBetween(fromKey: string, toKey: string) {
  const from = new Date(`${fromKey}T00:00:00`).getTime();
  const to = new Date(`${toKey}T00:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return "-";
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function mechanicDailyLoad(rows: WorkOrder[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = row.assignedMechanic?.name ?? "미배정";
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
}

function formatRoles(roles: string[]) {
  return roles.map((role) => roleLabel[role] ?? role).join(", ");
}

function labelStatus(status: string) {
  return statusLabel[status] ?? status;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

function attachmentStageLabel(stage?: AttachmentStage | string | null) {
  return attachmentStageOptions.find((option) => option.value === stage)?.label ?? "일반 보고";
}

function isClosed(workOrder: WorkOrder) {
  return ["FINAL_COMPLETED", "ARCHIVED", "CANCELLED"].includes(workOrder.status);
}

function sortWorkOrders(rows: WorkOrder[], sortBy: string) {
  return [...rows].sort((a, b) => {
    if (sortBy === "target") return dateValue(a.targetDueDate) - dateValue(b.targetDueDate);
    if (sortBy === "requestDate") return dateValue(b.requestDate) - dateValue(a.requestDate);
    if (sortBy === "mechanic") return (a.assignedMechanic?.name ?? "미배정").localeCompare(b.assignedMechanic?.name ?? "미배정", "ko");
    if (sortBy === "status") return labelStatus(a.status).localeCompare(labelStatus(b.status), "ko");
    return priorityRank(a.priorityLevel) - priorityRank(b.priorityLevel) || dateValue(a.targetDueDate) - dateValue(b.targetDueDate);
  });
}

function noteworthyWorkOrders(rows: WorkOrder[]) {
  return sortWorkOrders(
    rows.filter(
      (row) =>
        row.priorityLevel === "P1" ||
        row.status === "DELAYED" ||
        row.status === "REPORT_SUBMITTED" ||
        row.status === "PART_WAITING" ||
        row.status === "ON_HOLD" ||
        row.isDelayed
    ),
    "priority"
  );
}

function priorityRank(priority: WorkOrder["priorityLevel"]) {
  return { P1: 0, P2: 1, P3: 2, OUTSOURCE: 3, UNSET: 4 }[priority] ?? 9;
}

function dateValue(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function toDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDayKey(key: string, value?: string | null) {
  return Boolean(value && toDateKey(value) === key);
}

function isDateWithinSchedule(key: string, row: WorkOrder) {
  const start = toDateKey(row.requestDate);
  const end = toDateKey(row.targetDueDate ?? row.requestDate);
  return key >= start && key <= end;
}

function visiblePlansForUser(plans: DailyWorkPlan[], user: AuthUser, mode: MobilePreviewMode) {
  if (mode === "executive") return plans.filter((plan) => ["APPROVED", "FINAL_CONFIRMED"].includes(plan.status));
  if (mode === "admin" || hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"])) return plans;
  return plans.filter((plan) => plan.requestedById === user.id || plan.items.some((item) => item.mechanicId === user.id));
}

function buildPlanAlerts(plans: DailyWorkPlan[], user: AuthUser, canAdminPlan: boolean) {
  return plans
    .filter((plan) => {
      if (canAdminPlan) return plan.status === "REQUESTED";
      return plan.requestedById === user.id || plan.items.some((item) => item.mechanicId === user.id);
    })
    .map((plan) => {
      const adminLabel = plan.status === "REQUESTED" ? "검토 필요" : planStatusLabel(plan.status);
      const mechanicLabel = plan.status === "REJECTED" ? "반려 확인" : plan.status === "APPROVED" ? "승인 반영" : plan.status === "FINAL_CONFIRMED" ? "최종확정" : "변경 확인";
      return {
        id: `plan-alert-${plan.id}-${plan.status}`,
        planId: plan.id,
        label: canAdminPlan ? adminLabel : mechanicLabel,
        title: `${formatDate(plan.planDate)} 계획 · ${plan.items.length}건`,
        body: plan.reviewMemo ?? (canAdminPlan ? "정비사가 계획업무 검토를 요청했습니다." : "계획업무 변경사항을 확인하세요."),
        tone: plan.status === "REJECTED" ? "danger" : plan.status === "FINAL_CONFIRMED" || plan.status === "APPROVED" ? "success" : "warning"
      };
    });
}

function planStatusLabel(status: DailyPlanStatus) {
  const labels: Record<DailyPlanStatus, string> = {
    DRAFT: "임시저장",
    REQUESTED: "승인요청",
    APPROVED: "승인됨",
    REJECTED: "반려",
    FINAL_CONFIRMED: "최종확정"
  };
  return labels[status] ?? status;
}

function planStatusChip(status: DailyPlanStatus) {
  if (status === "REJECTED") return "red";
  if (status === "APPROVED" || status === "FINAL_CONFIRMED") return "green";
  if (status === "REQUESTED") return "amber";
  return "blue";
}

function formatCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return resultLabel[value] ?? priorityLabel[value as WorkOrder["priorityLevel"]] ?? statusLabel[value] ?? value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "name" in value && typeof value.name === "string") return value.name;
  return JSON.stringify(value);
}
