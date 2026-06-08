"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Gauge,
  KeyRound,
  LogOut,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  Upload,
  UserCog,
  Users,
  Wrench
} from "lucide-react";
import { api, patchJson, postJson } from "@/lib/client-api";

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
  finalCompletedAt?: string | null;
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
  reports?: { id: string; resultType: string; diagnosisResult: string; actionTaken: string; submittedAt: string }[];
  targetChangeRequests?: Record<string, unknown>[];
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
  { id: "dashboard", label: "현황", icon: Gauge, allow: () => true },
  { id: "reception", label: "접수", icon: Plus, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"]) },
  { id: "workorders", label: "정비건", icon: ClipboardList, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE", "RECEPTIONIST"]) },
  { id: "mechanic", label: "내 작업", icon: Wrench, allow: (user: AuthUser) => hasAnyRole(user, ["MECHANIC"]) },
  { id: "calendar", label: "일정", icon: CalendarDays, allow: () => true },
  { id: "kpi", label: "보고/KPI", icon: BarChart3, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE"]) },
  { id: "admin", label: "관리", icon: UserCog, allow: (user: AuthUser) => hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"]) },
  { id: "exports", label: "엑셀", icon: FileSpreadsheet, allow: () => true }
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AppShell() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<TabId>("dashboard");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const visibleTabs = useMemo(() => (user ? tabs.filter((item) => item.allow(user)) : []), [user]);
  const selected = useMemo(
    () => workOrders.find((workOrder) => workOrder.id === selectedId) ?? workOrders[0] ?? null,
    [selectedId, workOrders]
  );

  async function refresh() {
    if (!user) return;
    setLoading(true);
    try {
      const [summaryData, workOrderData] = await Promise.all([
        api<Summary>("/api/dashboard/summary"),
        api<WorkOrder[]>("/api/work-orders")
      ]);
      setSummary(summaryData);
      setWorkOrders(workOrderData);
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
    return <LoginScreen onLogin={setUser} loading={loading} />;
  }

  const canAdmin = hasAnyRole(user, ["SUPER_ADMIN", "ADMIN"]);
  const canKpi = hasAnyRole(user, ["SUPER_ADMIN", "ADMIN", "EXECUTIVE"]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">MS</div>
            <div>
              <h1>정비 렌탈 운영 시스템</h1>
              <p>{user.name} · {formatRoles(user.roles)}</p>
            </div>
          </div>
          <nav className="tabs" aria-label="업무 메뉴">
            {visibleTabs.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} type="button">
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="user-box">
            <button className="icon-button" title="새로고침" onClick={refresh} disabled={loading} type="button">
              <RefreshCcw size={16} />
            </button>
            <button
              className="icon-button"
              title="로그아웃"
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

      <main className="main">
        {message ? <p className="notice">{message}</p> : null}
        {tab === "dashboard" ? <Dashboard summary={summary} workOrders={workOrders} user={user} select={setSelectedId} switchTab={setTab} /> : null}
        {tab === "reception" ? <ReceptionPanel onCreated={refresh} /> : null}
        {tab === "workorders" ? (
          <WorkOrdersPanel workOrders={workOrders} selected={selected} users={users} canAdmin={canAdmin} onSelect={setSelectedId} onChanged={refresh} />
        ) : null}
        {tab === "mechanic" ? <MechanicPanel user={user} workOrders={workOrders} selected={selected} onSelect={setSelectedId} onChanged={refresh} /> : null}
        {tab === "calendar" ? <CalendarPanel /> : null}
        {tab === "kpi" ? <KpiPanel enabled={canKpi} /> : null}
        {tab === "admin" ? <AdminPanel currentUser={user} users={users} onChanged={refresh} /> : null}
        {tab === "exports" ? <ExportsPanel /> : null}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin, loading }: { onLogin: (user: AuthUser) => void; loading: boolean }) {
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
          <h1>정비 렌탈 운영 시스템</h1>
          <p>역할별 데모 계정으로 실제 운영 화면을 확인할 수 있습니다.</p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="loginId">아이디</label>
              <input id="loginId" value={loginId} onChange={(event) => setLoginId(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">비밀번호</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {error ? <div className="error">{error}</div> : null}
            <button className="primary" disabled={loading} type="submit">
              <KeyRound size={16} />
              로그인
            </button>
          </div>
        </form>

        <div className="demo-panel">
          <div className="section-header">
            <div>
              <h2>데모 계정</h2>
              <p>임원, 관리자, 정비사 화면을 즉시 전환해 볼 수 있습니다.</p>
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
  const urgent = workOrders.filter((row) => row.priorityLevel === "P1" && !isClosed(row));
  const delayed = workOrders.filter((row) => row.isDelayed || row.status === "DELAYED");
  const reviewWaiting = workOrders.filter((row) => row.status === "REPORT_SUBMITTED");
  const myWork = workOrders.filter((row) => row.assignedMechanic?.id === user.id && !isClosed(row));
  const metrics = [
    ["전체 접수", summary?.total ?? 0],
    ["최종 완료", summary?.completed ?? 0],
    ["미결", summary?.pending ?? 0],
    ["지연", summary?.delayed ?? 0],
    ["계획 업무", summary?.planned ?? 0],
    ["긴급", summary?.urgent ?? 0]
  ];

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
        {metrics.map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="insight-grid">
        <Insight title="긴급 처리" value={`${urgent.length}건`} text={urgent[0] ? `${urgent[0].customer?.name} · ${urgent[0].faultDescription}` : "긴급 미결 건 없음"} tone="red" />
        <Insight title="지연 리스크" value={`${delayed.length}건`} text={delayed[0] ? `${delayed[0].requestNo} target 초과` : "지연 관리 안정"} tone="amber" />
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
          <div className="kv"><span>정비사</span><strong>내 업무만 확인하고 작업 시작, 완료보고, target 변경 요청을 보냅니다.</strong></div>
        </div>
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
          <Select label="Priority" value={form.priorityLevel} onChange={(value) => setField("priorityLevel", value)} options={priorityOptions} />
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

function WorkOrdersPanel({
  workOrders,
  selected,
  users,
  canAdmin,
  onSelect,
  onChanged
}: {
  workOrders: WorkOrder[];
  selected: WorkOrder | null;
  users: UserRow[];
  canAdmin: boolean;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="panel-grid">
      <div className="section">
        <div className="section-header">
          <div>
            <h2>정비건 목록</h2>
            <p>Priority, 상태, target, 담당자를 한 번에 확인합니다.</p>
          </div>
        </div>
        <WorkList workOrders={workOrders} selectedId={selected?.id} onSelect={onSelect} />
      </div>
      <WorkDetail selected={selected} users={users} canAdmin={canAdmin} onChanged={onChanged} />
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
            <p>작업 시작, 완료보고, target 변경 요청을 처리합니다.</p>
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
            <span className="chip">Target {formatDate(item.targetDueDate)}</span>
            <span className="chip">{item.assignedMechanic?.name ?? "미배정"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function WorkDetail({
  selected,
  users,
  canAdmin,
  onChanged
}: {
  selected: WorkOrder | null;
  users: UserRow[];
  canAdmin: boolean;
  onChanged: () => Promise<void>;
}) {
  const [mechanicId, setMechanicId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const mechanics = users.filter((user) => user.roles.some((role) => role.role.code === "MECHANIC"));
  const mechanicOptions = [{ value: "", label: "정비사 선택" }, ...mechanics.map((user) => ({ value: user.id, label: `${user.name} ${user.title ?? ""}`.trim() }))];

  if (!selected) return <div className="detail-panel">정비건을 선택하세요.</div>;
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
        <Info label="Target" value={formatDate(selected.targetDueDate)} />
        <Info label="연락처" value={selected.contactPhone} />
        <Info label="모델" value={selected.equipment?.modelName} />
        <Info label="차대번호" value={selected.equipment?.serialNo} />
        <Info label="진단 결과" value={selected.diagnosisResult} />
        <Info label="조치 내용" value={selected.actionTaken} />
      </div>
      {canAdmin ? (
        <div className="section">
          <h3>관리자 처리</h3>
          <div className="form-row">
            <Select label="담당자" value={mechanicId} onChange={setMechanicId} options={mechanicOptions} />
            <Input label="Target" type="date" value={targetDate} onChange={setTargetDate} />
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
              <CalendarDays size={16} />Target
            </button>
            <button type="button" onClick={async () => { await postJson(`/api/work-orders/${selected.id}/approve`, {}); await onChanged(); }}>
              <CheckCircle2 size={16} />승인
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
        <div className="notice">임원 계정은 처리 버튼 없이 현황과 보고 내용만 조회합니다.</div>
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

  if (!selected) return <div className="detail-panel">현재 배정된 미결 업무가 없습니다.</div>;
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
      <button
        className="primary"
        type="button"
        onClick={async () => {
          await postJson(`/api/work-orders/${selected.id}/report`, {
            resultType,
            diagnosisResult: diagnosisResult.trim() || "현장 점검 후 원인 확인",
            actionTaken: actionTaken.trim() || "조치 완료 후 시운전 확인"
          });
          setDiagnosisResult("");
          setActionTaken("");
          await onChanged();
        }}
      >
        <CheckCircle2 size={16} />완료보고 제출
      </button>
      <div className="form-row">
        <Input label="Target 변경 요청" type="date" value={targetRequestDate} onChange={setTargetRequestDate} />
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

function CalendarPanel() {
  const [rows, setRows] = useState<WorkOrder[]>([]);
  useEffect(() => {
    void api<WorkOrder[]>("/api/calendar/tasks").then(setRows);
  }, []);
  return (
    <div className="section">
      <div className="section-header">
        <h2>Target 일정</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Target</th><th>접수번호</th><th>사업장</th><th>차량</th><th>상태</th><th>담당</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.targetDueDate)}</td>
                <td>{row.requestNo}</td>
                <td>{row.customer?.name}</td>
                <td>{row.equipmentInput}</td>
                <td>{labelStatus(row.status)}</td>
                <td>{row.assignedMechanic?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiPanel({ enabled }: { enabled: boolean }) {
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

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2>임원 보고/KPI</h2>
          <p>정비사별 처리량과 Priority별 완료율을 비교합니다.</p>
        </div>
        <a className="icon-button" href="/api/admin/kpi/export"><Download size={16} />KPI 엑셀</a>
      </div>
      <div className="insight-grid">
        <Insight title="접수" value={`${totalReceived}건`} text="데모 기간 전체 접수" tone="blue" />
        <Insight title="완료" value={`${totalCompleted}건`} text="관리자 최종 승인 기준" tone="green" />
        <Insight title="지연" value={`${totalDelayed}건`} text="Target 초과 또는 지연 상태" tone="amber" />
      </div>
      <SimpleTable rows={mechanics} title="정비사별 KPI" />
      <SimpleTable rows={priorities} title="Priority별 KPI" />
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
    setMessage("Master List 데모 import가 완료되었습니다.");
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
          <p>고민서 책임 계정으로 사용자 생성, 권한 부여, Master List import, 감사로그를 확인합니다.</p>
        </div>
        <div className="toolbar">
          <button onClick={importMasterList} type="button"><Upload size={16} />Master List import</button>
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
        <h2>엑셀 다운로드</h2>
      </div>
      <div className="metric-grid">
        {links.map(([href, label]) => (
          <a className="metric" href={href} key={href}>
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

function isClosed(workOrder: WorkOrder) {
  return ["FINAL_COMPLETED", "ARCHIVED", "CANCELLED"].includes(workOrder.status);
}

function formatCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return resultLabel[value] ?? priorityLabel[value as WorkOrder["priorityLevel"]] ?? statusLabel[value] ?? value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "name" in value && typeof value.name === "string") return value.name;
  return JSON.stringify(value);
}
