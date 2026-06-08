"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Gauge,
  LogOut,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  Upload,
  UserCog,
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
  customer?: { id: string; name: string } | null;
  site?: { id: string; name: string } | null;
  equipment?: {
    modelName?: string | null;
    serialNo?: string | null;
    tonnage?: string | null;
    maker?: string | null;
    vehicleRegistrationNo?: string | null;
  } | null;
  assignedMechanic?: { id: string; name: string; title?: string | null; phone?: string | null } | null;
  comments?: { id: string; body: string; createdAt: string; author?: { name: string } | null }[];
  reports?: { id: string; resultType: string; diagnosisResult: string; actionTaken: string; submittedAt: string }[];
};

type UserRow = {
  id: string;
  loginId: string;
  name: string;
  title?: string | null;
  team?: string | null;
  phone?: string | null;
  isActive: boolean;
  roles: { role: { code: string; name: string } }[];
};

type LookupResult = {
  normalized: string;
  equipment?: WorkOrder["equipment"] & {
    customer?: { name: string } | null;
    site?: { name: string } | null;
    placementNo?: string | null;
    equipmentNo?: string | null;
    normalizedNo?: string | null;
  };
  duplicateCandidates: WorkOrder[];
};

const tabs = [
  { id: "dashboard", label: "현황", icon: Gauge },
  { id: "reception", label: "접수", icon: Plus },
  { id: "workorders", label: "업무", icon: ClipboardList },
  { id: "mechanic", label: "정비작업", icon: Wrench },
  { id: "calendar", label: "달력", icon: CalendarDays },
  { id: "kpi", label: "KPI", icon: BarChart3 },
  { id: "admin", label: "관리", icon: UserCog },
  { id: "exports", label: "엑셀", icon: FileSpreadsheet }
] as const;

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
  OUTSOURCE: "",
  UNSET: ""
};

const priorityLabel: Record<WorkOrder["priorityLevel"], string> = {
  P1: "Priority #1",
  P2: "Priority #2",
  P3: "Priority #3",
  OUTSOURCE: "외주",
  UNSET: "미지정"
};

export function AppShell() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("dashboard");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

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
      if (user.roles.includes("ADMIN")) {
        setUsers(await api<UserRow[]>("/api/admin/users"));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api<{ user: AuthUser | null }>("/api/auth/me")
      .then((data) => {
        setUser(data.user);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) {
    return <LoginScreen onLogin={setUser} loading={loading} />;
  }

  const canKpi = user.roles.includes("ADMIN") || user.roles.includes("EXECUTIVE");

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">TS</div>
            <div>
              <h1>정비/렌탈 업무 시스템</h1>
              <p>{user.name} · {user.roles.join(", ")}</p>
            </div>
          </div>
          <nav className="tabs" aria-label="업무 메뉴">
            {tabs.map((item) => {
              const Icon = item.icon;
              const disabled = item.id === "kpi" && !canKpi;
              return (
                <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} disabled={disabled}>
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="user-box">
            <button className="icon-button" title="새로고침" onClick={refresh} disabled={loading}>
              <RefreshCcw size={16} />
            </button>
            <button
              className="icon-button"
              title="로그아웃"
              onClick={async () => {
                await postJson("/api/auth/logout", {});
                setUser(null);
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {message ? <p className="notice">{message}</p> : null}
        {tab === "dashboard" ? <Dashboard summary={summary} workOrders={workOrders} select={setSelectedId} switchTab={setTab} /> : null}
        {tab === "reception" ? <ReceptionPanel onCreated={refresh} /> : null}
        {tab === "workorders" ? <WorkOrdersPanel workOrders={workOrders} selected={selected} users={users} onSelect={setSelectedId} onChanged={refresh} /> : null}
        {tab === "mechanic" ? <MechanicPanel workOrders={workOrders} selected={selected} onSelect={setSelectedId} onChanged={refresh} /> : null}
        {tab === "calendar" ? <CalendarPanel /> : null}
        {tab === "kpi" ? <KpiPanel enabled={canKpi} /> : null}
        {tab === "admin" ? <AdminPanel users={users} onChanged={refresh} /> : null}
        {tab === "exports" ? <ExportsPanel /> : null}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin, loading }: { onLogin: (user: AuthUser) => void; loading: boolean }) {
  const [loginId, setLoginId] = useState("son.hn");
  const [password, setPassword] = useState("ChangeMe!2026");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      onLogin(await postJson<AuthUser>("/api/auth/login", { loginId, password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패");
    }
  }

  return (
    <div className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <h1>정비 업무 로그인</h1>
        <p>접수, 배정, 작업보고, KPI를 한 흐름에서 관리합니다.</p>
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
          <button className="primary" disabled={loading}>로그인</button>
        </div>
      </form>
    </div>
  );
}

function Dashboard({
  summary,
  workOrders,
  select,
  switchTab
}: {
  summary: Summary | null;
  workOrders: WorkOrder[];
  select: (id: string) => void;
  switchTab: (tab: (typeof tabs)[number]["id"]) => void;
}) {
  const metrics = [
    ["전체 접수", summary?.total ?? 0],
    ["완료", summary?.completed ?? 0],
    ["미결", summary?.pending ?? 0],
    ["지연", summary?.delayed ?? 0],
    ["계획업무", summary?.planned ?? 0],
    ["긴급", summary?.urgent ?? 0]
  ];
  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2>메인 현황판</h2>
          <p>기간 필터와 KPI 집계가 확장될 수 있는 운영 대시보드입니다.</p>
        </div>
        <div className="toolbar">
          <button onClick={() => switchTab("reception")}><Plus size={16} />접수 등록</button>
          <button onClick={() => switchTab("exports")}><Download size={16} />엑셀</button>
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
      <div className="panel-grid">
        <div className="section">
          <div className="section-header">
            <h2>우선 처리 업무</h2>
          </div>
          <WorkList workOrders={workOrders.slice(0, 8)} onSelect={select} />
        </div>
        <div className="tool-panel">
          <h2>운영 기준</h2>
          <p className="muted">Priority #1은 당일 target으로 관리하고, 관리자 최종 승인 시점만 KPI 완료로 집계합니다.</p>
          <div className="chips">
            <span className="chip red">긴급</span>
            <span className="chip amber">중요</span>
            <span className="chip green">일반</span>
            <span className="chip">외주</span>
          </div>
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
    faultCategoryName: "시동안걸림",
    faultDescription: "시동안걸림-지금은 점프해서 사용중(와서 점검은 해달라고 합니다)",
    equipmentType: "RENTAL",
    priorityLevel: "P1",
    memo: ""
  });
  const [error, setError] = useState("");

  async function lookupEquipment() {
    setError("");
    try {
      setLookup(await api<LookupResult>(`/api/equipment/lookup?keyword=${encodeURIComponent(form.equipmentInput)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 실패");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await postJson("/api/work-orders", form);
      await onCreated();
      setError("접수 등록이 완료되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 실패");
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
            <h2>정비의뢰 접수</h2>
            <p>카카오톡 접수증 내용을 수동 입력하고 장비 정보를 자동 조회합니다.</p>
          </div>
        </div>
        <div className="form-row">
          <Input label="사업장/고객사" value={form.customerName} onChange={(value) => setField("customerName", value)} />
          <Input label="배치장소/현장" value={form.siteName} onChange={(value) => setField("siteName", value)} />
        </div>
        <div className="form-row">
          <Input label="차량번호/호기수" value={form.equipmentInput} onChange={(value) => setField("equipmentInput", value)} />
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
          <Input label="고장유형" value={form.faultCategoryName} onChange={(value) => setField("faultCategoryName", value)} />
          <Select label="Priority" value={form.priorityLevel} onChange={(value) => setField("priorityLevel", value)} options={["P1", "P2", "P3", "OUTSOURCE", "UNSET"]} />
        </div>
        <div className="field">
          <label>고장내용</label>
          <textarea value={form.faultDescription} onChange={(event) => setField("faultDescription", event.target.value)} />
        </div>
        <div className="field">
          <label>비고</label>
          <textarea value={form.memo} onChange={(event) => setField("memo", event.target.value)} />
        </div>
        {error ? <div className={error.includes("완료") ? "notice" : "error"}>{error}</div> : null}
        <button className="primary"><Plus size={16} />접수 등록</button>
      </form>
      <div className="detail-panel">
        <h2>장비 조회 결과</h2>
        {lookup?.equipment ? (
          <div className="detail-grid">
            <Info label="정규화 번호" value={lookup.normalized} />
            <Info label="사업장" value={lookup.equipment.customer?.name} />
            <Info label="현장" value={lookup.equipment.site?.name} />
            <Info label="장비 No" value={lookup.equipment.equipmentNo} />
            <Info label="배치No" value={lookup.equipment.placementNo} />
            <Info label="모델명" value={lookup.equipment.modelName} />
            <Info label="차대번호" value={lookup.equipment.serialNo} />
            <Info label="톤수" value={lookup.equipment.tonnage} />
          </div>
        ) : (
          <p className="muted">장비 번호를 조회하면 Master List 기반 정보와 중복 의심 접수가 표시됩니다.</p>
        )}
        {lookup?.duplicateCandidates?.length ? (
          <div className="notice">
            <strong>중복 의심 접수 {lookup.duplicateCandidates.length}건</strong>
            {lookup.duplicateCandidates.map((item) => (
              <p key={item.id}>{item.requestNo} · {item.status} · {item.faultDescription}</p>
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
  onSelect,
  onChanged
}: {
  workOrders: WorkOrder[];
  selected: WorkOrder | null;
  users: UserRow[];
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
        <WorkList workOrders={workOrders} onSelect={onSelect} />
      </div>
      <WorkDetail selected={selected} users={users} onChanged={onChanged} />
    </div>
  );
}

function MechanicPanel({
  workOrders,
  selected,
  onSelect,
  onChanged
}: {
  workOrders: WorkOrder[];
  selected: WorkOrder | null;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const active = workOrders.filter((workOrder) => !["FINAL_COMPLETED", "ARCHIVED", "CANCELLED"].includes(workOrder.status));
  return (
    <div className="panel-grid">
      <div className="section">
        <div className="section-header">
          <div>
            <h2>정비사 작업</h2>
            <p>전체 업무 조회, 작업 시작, 완료보고, 계획업무 요청을 처리합니다.</p>
          </div>
        </div>
        <WorkList workOrders={active} onSelect={onSelect} />
      </div>
      <MechanicActions selected={selected} onChanged={onChanged} />
    </div>
  );
}

function WorkList({ workOrders, onSelect }: { workOrders: WorkOrder[]; onSelect: (id: string) => void }) {
  if (!workOrders.length) return <p className="notice">표시할 정비건이 없습니다.</p>;
  return (
    <div className="work-list">
      {workOrders.map((item) => (
        <button key={item.id} className={`work-card ${priorityClass[item.priorityLevel]}`} onClick={() => onSelect(item.id)}>
          <div className="work-card-header">
            <div className="work-title">
              <strong>{item.requestNo} · {item.customer?.name ?? "미지정"}</strong>
              <span className="muted">{item.equipmentInput ?? item.equipmentNoNormalized} · {item.faultDescription}</span>
            </div>
            <span className={`chip ${priorityChip[item.priorityLevel]}`}>{priorityLabel[item.priorityLevel]}</span>
          </div>
          <div className="chips">
            <span className="chip">{item.status}</span>
            <span className="chip">Target {item.targetDueDate ? item.targetDueDate.slice(0, 10) : "미지정"}</span>
            <span className="chip">{item.assignedMechanic?.name ?? "미배정"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function WorkDetail({ selected, users, onChanged }: { selected: WorkOrder | null; users: UserRow[]; onChanged: () => Promise<void> }) {
  const [mechanicId, setMechanicId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const mechanics = users.filter((user) => user.roles.some((role) => role.role.code === "MECHANIC"));
  if (!selected) return <div className="detail-panel">정비건을 선택하세요.</div>;
  return (
    <div className="detail-panel">
      <div className="section-header">
        <div>
          <h2>{selected.requestNo}</h2>
          <p>{selected.customer?.name} · {selected.equipmentInput}</p>
        </div>
      </div>
      <div className="detail-grid">
        <Info label="상태" value={selected.status} />
        <Info label="Priority" value={priorityLabel[selected.priorityLevel]} />
        <Info label="담당 정비사" value={selected.assignedMechanic?.name} />
        <Info label="Target" value={selected.targetDueDate?.slice(0, 10)} />
        <Info label="모델" value={selected.equipment?.modelName} />
        <Info label="차대번호" value={selected.equipment?.serialNo} />
        <Info label="연락처" value={selected.contactPhone} />
        <Info label="조치내용" value={selected.actionTaken} />
      </div>
      <div className="section">
        <h3>관리자 처리</h3>
        <div className="form-row">
          <Select label="담당자" value={mechanicId} onChange={setMechanicId} options={["", ...mechanics.map((user) => user.id)]} render={(value) => mechanics.find((item) => item.id === value)?.name ?? "선택"} />
          <Input label="Target" type="date" value={targetDate} onChange={setTargetDate} />
        </div>
        <div className="toolbar">
          <button onClick={async () => { if (mechanicId) await patchJson(`/api/work-orders/${selected.id}/assign`, { assignedMechanicId: mechanicId }); await onChanged(); }}><UserCog size={16} />배정</button>
          <button onClick={async () => { if (targetDate) await patchJson(`/api/work-orders/${selected.id}/target`, { targetDueDate: targetDate }); await onChanged(); }}><CalendarDays size={16} />Target</button>
          <button onClick={async () => { await postJson(`/api/work-orders/${selected.id}/approve`, {}); await onChanged(); }}><CheckCircle2 size={16} />승인</button>
          <button className="danger" onClick={async () => { const reason = window.prompt("반려 사유"); if (reason) { await postJson(`/api/work-orders/${selected.id}/reject`, { reason }); await onChanged(); } }}>반려</button>
        </div>
      </div>
      <Timeline selected={selected} />
    </div>
  );
}

function MechanicActions({ selected, onChanged }: { selected: WorkOrder | null; onChanged: () => Promise<void> }) {
  const [diagnosisResult, setDiagnosisResult] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [resultType, setResultType] = useState("COMPLETED");
  const [targetRequestDate, setTargetRequestDate] = useState("");
  if (!selected) return <div className="detail-panel">작업할 정비건을 선택하세요.</div>;
  return (
    <div className="detail-panel form-grid">
      <h2>{selected.requestNo} 작업 처리</h2>
      <p className="muted">{selected.faultDescription}</p>
      <div className="toolbar">
        <button onClick={async () => { await postJson(`/api/work-orders/${selected.id}/start`, {}); await onChanged(); }}><Wrench size={16} />작업 시작</button>
      </div>
      <Select label="완료 결과" value={resultType} onChange={setResultType} options={["COMPLETED", "TEMPORARY_ACTION", "INCOMPLETE", "REVISIT_REQUIRED"]} />
      <div className="field">
        <label>점검 결과</label>
        <textarea value={diagnosisResult} onChange={(event) => setDiagnosisResult(event.target.value)} />
      </div>
      <div className="field">
        <label>조치 내용</label>
        <textarea value={actionTaken} onChange={(event) => setActionTaken(event.target.value)} />
      </div>
      <button className="primary" onClick={async () => { await postJson(`/api/work-orders/${selected.id}/report`, { resultType, diagnosisResult, actionTaken }); await onChanged(); }}><CheckCircle2 size={16} />완료보고 제출</button>
      <div className="form-row">
        <Input label="Target 변경 요청" type="date" value={targetRequestDate} onChange={setTargetRequestDate} />
        <div className="field">
          <label>요청</label>
          <button onClick={async () => { if (targetRequestDate) await postJson(`/api/work-orders/${selected.id}/target-change-requests`, { requestedDate: targetRequestDate, reason: "정비사 일정/현장 상황" }); await onChanged(); }}>변경 요청</button>
        </div>
      </div>
    </div>
  );
}

function Timeline({ selected }: { selected: WorkOrder }) {
  return (
    <div className="section">
      <h3>댓글/보고</h3>
      {selected.reports?.map((report) => (
        <div className="kv" key={report.id}>
          <span>{report.resultType} · {report.submittedAt.slice(0, 10)}</span>
          <strong>{report.actionTaken}</strong>
        </div>
      ))}
      {selected.comments?.map((comment) => (
        <div className="kv" key={comment.id}>
          <span>{comment.author?.name ?? "시스템"} · {comment.createdAt.slice(0, 10)}</span>
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
        <h2>Target 달력</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Target</th><th>접수번호</th><th>사업장</th><th>차량</th><th>상태</th><th>담당</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.targetDueDate?.slice(0, 10)}</td>
                <td>{row.requestNo}</td>
                <td>{row.customer?.name}</td>
                <td>{row.equipmentInput}</td>
                <td>{row.status}</td>
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
  const [mechanics, setMechanics] = useState<Record<string, string | number>[]>([]);
  const [priorities, setPriorities] = useState<Record<string, string | number>[]>([]);
  useEffect(() => {
    if (!enabled) return;
    void Promise.all([
      api<Record<string, string | number>[]>("/api/admin/kpi/mechanics"),
      api<Record<string, string | number>[]>("/api/admin/kpi/priorities")
    ]).then(([mechanicRows, priorityRows]) => {
      setMechanics(mechanicRows);
      setPriorities(priorityRows);
    });
  }, [enabled]);
  if (!enabled) return <p className="notice">KPI는 관리자와 임원/대표만 조회할 수 있습니다.</p>;
  return (
    <div className="section">
      <div className="section-header">
        <h2>KPI 대시보드</h2>
        <a className="icon-button" href="/api/admin/kpi/export"><Download size={16} />KPI 엑셀</a>
      </div>
      <SimpleTable rows={mechanics} title="정비사별 KPI" />
      <SimpleTable rows={priorities} title="Priority별 KPI" />
    </div>
  );
}

function AdminPanel({ users, onChanged }: { users: UserRow[]; onChanged: () => Promise<void> }) {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  async function importMasterList() {
    await postJson("/api/equipment/import-master-list", {});
    await onChanged();
  }
  async function loadLogs() {
    setLogs(await api<Record<string, unknown>[]>("/api/admin/audit-logs"));
  }
  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2>관리자 설정</h2>
          <p>사용자, Master List import, 감사로그를 관리합니다.</p>
        </div>
        <div className="toolbar">
          <button onClick={importMasterList}><Upload size={16} />Master List import</button>
          <button onClick={loadLogs}><Shield size={16} />감사로그</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>이름</th><th>아이디</th><th>역할</th><th>팀</th><th>상태</th></tr></thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id}><td>{row.name} {row.title}</td><td>{row.loginId}</td><td>{row.roles.map((role) => role.role.name).join(", ")}</td><td>{row.team}</td><td>{row.isActive ? "활성" : "비활성"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {logs.length ? <SimpleTable rows={logs.slice(0, 20) as Record<string, string | number>[]} title="최근 감사로그" /> : null}
    </div>
  );
}

function ExportsPanel() {
  const links = [
    ["/api/exports/daily-status", "일일 업무진행현황"],
    ["/api/exports/work-diary", "업무일지"],
    ["/api/exports/monthly", "월별 정비현황"],
    ["/api/exports/site", "사업장별 정비현황"],
    ["/api/exports/mechanic", "정비사별 처리현황"],
    ["/api/exports/pending", "미결현황"],
    ["/api/exports/completed", "완료현황"],
    ["/api/exports/equipment-history", "차량별 정비이력"]
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

function SimpleTable({ rows, title }: { rows: Record<string, string | number>[]; title: string }) {
  const keys = Object.keys(rows[0] ?? {});
  return (
    <div className="section">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>{keys.map((key) => <td key={key}>{String(row[key] ?? "")}</td>)}</tr>
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
  options,
  render
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  render?: (value: string) => string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option value={option} key={option}>{render ? render(option) : option}</option>
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
