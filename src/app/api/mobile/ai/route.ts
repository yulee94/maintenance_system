import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import { demoWorkOrders } from "@/lib/demo";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  question: z.string().trim().min(2).max(1000)
});

type AiWorkOrder = {
  id?: string;
  requestNo: string;
  requestDate: string | Date;
  customer?: { name?: string | null } | null;
  site?: { name?: string | null } | null;
  equipmentInput?: string | null;
  equipmentNoNormalized?: string | null;
  faultDescription: string;
  priorityLevel: string;
  status: string;
  diagnosisResult?: string | null;
  actionTaken?: string | null;
  memo?: string | null;
  assignedMechanic?: { id?: string | null; name?: string | null } | null;
  reports?: { diagnosisResult?: string | null; actionTaken?: string | null; resultType?: string | null; submittedAt?: string | Date }[];
  comments?: { body?: string | null; createdAt?: string | Date }[];
};

type AiMatch = {
  requestNo: string;
  customer: string;
  equipment: string;
  faultDescription: string;
  diagnosisResult: string;
  actionTaken: string;
  status: string;
  similarity: number;
  hasRepairHistory: boolean;
};

type AiTaskId = "maintenance" | "work_report" | "operations_report" | "kpi" | "admin_data";

type AiTaskPolicy = {
  id: AiTaskId;
  label: string;
  allowedRoles: RoleCode[];
  deniedMessage: string;
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = await readJson(request, schema);
    const task = classifyAiTask(input.question);
    const access = canUseAiTask(task, user.roles);
    if (!access.allowed) {
      return ok({
        source: "policy",
        answer: access.message,
        matches: [],
        task: task.id,
        denied: true,
        allowedRoles: task.allowedRoles
      });
    }
    const rows = await getAiWorkOrders();
    const scopedRows = scopeRowsForUser(rows, user);
    const matches = task.id === "kpi" || task.id === "operations_report" || task.id === "admin_data" ? [] : findSimilarWorkOrders(input.question, scopedRows).slice(0, 5);

    if (appEnv.openAiApiKey) {
      return ok({
        source: "openai",
        answer: await askOpenAi(input.question, matches, scopedRows, task, user.roles),
        matches,
        task: task.id,
        denied: false,
        allowedRoles: task.allowedRoles
      });
    }

    return ok({
      source: appEnv.demoMode ? "demo" : "local",
      answer: localAiAnswer(input.question, matches, scopedRows, task, user.roles),
      matches,
      task: task.id,
      denied: false,
      allowedRoles: task.allowedRoles
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function getAiWorkOrders(): Promise<AiWorkOrder[]> {
  if (appEnv.demoMode) return demoWorkOrders();
  return prisma.workOrder.findMany({
    include: {
      customer: { select: { name: true } },
      site: { select: { name: true } },
      assignedMechanic: { select: { id: true, name: true } },
      reports: {
        select: { diagnosisResult: true, actionTaken: true, resultType: true, submittedAt: true },
        orderBy: { submittedAt: "desc" },
        take: 3
      },
      comments: {
        select: { body: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 3
      }
    },
    orderBy: { requestDate: "desc" },
    take: 200
  });
}

function classifyAiTask(question: string): AiTaskPolicy {
  const normalized = question.toLowerCase();
  if (/(kpi|완료율|처리율|성과|실적|정비사별|우선순위별|지표|평가|순위)/i.test(normalized)) {
    return {
      id: "kpi",
      label: "KPI/성과 자료",
      allowedRoles: [RoleCode.ADMIN, RoleCode.EXECUTIVE, RoleCode.SUPER_ADMIN],
      deniedMessage: "KPI와 성과 지표는 관리자, 임원 및 최고관리자가 관리하는 수치입니다. 현재 권한에서는 조회할 수 없습니다."
    };
  }
  if (/(계정|권한|사용자|비밀번호|감사|로그|접속|최고관리|관리자\s*자료)/i.test(normalized)) {
    return {
      id: "admin_data",
      label: "계정/권한/감사 자료",
      allowedRoles: [RoleCode.SUPER_ADMIN],
      deniedMessage: "계정, 권한, 감사 로그와 같은 최고관리자 자료는 최고관리자만 조회하거나 요청할 수 있습니다."
    };
  }
  if (/(완료보고|작업보고|정비보고|조치\s*보고|보고\s*문안|보고\s*작성)/i.test(normalized)) {
    return {
      id: "work_report",
      label: "정비 완료보고 작성",
      allowedRoles: [RoleCode.MECHANIC, RoleCode.ADMIN, RoleCode.SUPER_ADMIN],
      deniedMessage: "정비 완료보고 작성은 정비사와 관리자 권한에서 사용할 수 있습니다."
    };
  }
  if (/(보고서|보고자료|일일보고|월간보고|임원보고|원페이지|엑셀|다운로드|현황\s*요약|업무\s*요약)/i.test(normalized)) {
    return {
      id: "operations_report",
      label: "운영 보고자료 작성",
      allowedRoles: [RoleCode.ADMIN, RoleCode.EXECUTIVE, RoleCode.SUPER_ADMIN],
      deniedMessage: "전체 운영 보고자료는 관리자, 임원 및 최고관리자 권한에서만 작성하거나 조회할 수 있습니다."
    };
  }
  return {
    id: "maintenance",
    label: "정비 문의/유사 이력",
    allowedRoles: [RoleCode.MECHANIC, RoleCode.RECEPTIONIST, RoleCode.ADMIN, RoleCode.EXECUTIVE, RoleCode.SUPER_ADMIN],
    deniedMessage: "현재 권한에서는 이 AI 기능을 사용할 수 없습니다."
  };
}

function canUseAiTask(task: AiTaskPolicy, roles: RoleCode[]) {
  const allowed = roles.includes(RoleCode.SUPER_ADMIN) || task.allowedRoles.some((role) => roles.includes(role));
  return { allowed, message: allowed ? "" : task.deniedMessage };
}

function scopeRowsForUser(rows: AiWorkOrder[], user: { id: string; roles: RoleCode[] }) {
  if (user.roles.includes(RoleCode.SUPER_ADMIN) || user.roles.includes(RoleCode.ADMIN) || user.roles.includes(RoleCode.EXECUTIVE)) {
    return rows;
  }
  if (user.roles.includes(RoleCode.MECHANIC)) {
    const ownRows = rows.filter((row) => row.assignedMechanic?.id === user.id);
    return ownRows.length ? ownRows : rows.filter((row) => row.assignedMechanic?.name);
  }
  return rows.filter((row) => !["ARCHIVED", "CANCELLED"].includes(row.status));
}

function findSimilarWorkOrders(question: string, rows: AiWorkOrder[]): AiMatch[] {
  const queryTerms = terms(question);
  return rows
    .map((row) => {
      const latestReport = row.reports?.[0];
      const diagnosisResult = row.diagnosisResult ?? latestReport?.diagnosisResult ?? "";
      const actionTaken = row.actionTaken ?? latestReport?.actionTaken ?? "";
      const haystack = [
        row.requestNo,
        row.customer?.name,
        row.site?.name,
        row.equipmentInput,
        row.equipmentNoNormalized,
        row.faultDescription,
        row.memo,
        diagnosisResult,
        actionTaken,
        row.comments?.map((comment) => comment.body).join(" ")
      ].join(" ");
      const rowTerms = new Set(terms(haystack));
      const overlap = queryTerms.filter((term) => rowTerms.has(term)).length;
      const priorityBoost = row.priorityLevel === "P1" ? 0.15 : 0;
      const completedBoost = actionTaken || diagnosisResult ? 0.2 : 0;
      return {
        requestNo: row.requestNo,
        customer: row.customer?.name ?? "미지정",
        equipment: row.equipmentInput ?? row.equipmentNoNormalized ?? "-",
        faultDescription: row.faultDescription,
        diagnosisResult: diagnosisResult || "과거 진단 내용 없음",
        actionTaken: actionTaken || "과거 조치 내용 없음",
        status: row.status,
        hasRepairHistory: Boolean(diagnosisResult || actionTaken),
        similarity: overlap / Math.max(queryTerms.length, 1) + priorityBoost + completedBoost
      };
    })
    .filter((row) => row.similarity > 0.05)
    .sort((a, b) => Number(b.hasRepairHistory) - Number(a.hasRepairHistory) || b.similarity - a.similarity);
}

function terms(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    )
  );
}

function localAiAnswer(question: string, matches: AiMatch[], rows: AiWorkOrder[], task: AiTaskPolicy, roles: RoleCode[]) {
  if (task.id === "kpi") return kpiAnswer(rows);
  if (task.id === "operations_report") return operationsReportAnswer(rows);
  if (task.id === "admin_data") return adminDataAnswer(rows);
  if (task.id === "work_report") return workReportDraftAnswer(question, matches, rows);
  return maintenanceAnswer(question, matches, roles);
}

function maintenanceAnswer(question: string, matches: AiMatch[], roles: RoleCode[]) {
  if (!matches.length) {
    return [
      `문의: ${question}`,
      "유사 정비 이력을 찾지 못했습니다.",
      "추천 확인 순서: 장비번호/호기 재확인, 최근 정비 이력 조회, 증상 재현 조건 기록, 사진 또는 현장 메모 첨부.",
      roles.includes(RoleCode.MECHANIC)
        ? "정비사는 KPI나 전체 성과 자료 대신 정비 조치, 내 작업 완료보고, 유사 고장 이력 중심으로 사용할 수 있습니다."
        : "정확한 조치 전에는 안전 정지와 관리자 확인을 우선하세요."
    ].join("\n");
  }

  const best = matches.find((match) => match.hasRepairHistory) ?? matches[0];
  const similar = matches
    .slice(0, 3)
    .map((row) => `- ${row.requestNo} ${row.customer}: ${row.faultDescription} / 조치: ${row.actionTaken}`)
    .join("\n");

  return [
    `가장 유사한 과거 이력은 ${best.requestNo} (${best.customer}, ${best.equipment})입니다.`,
    `과거 진단: ${best.diagnosisResult}`,
    `과거 조치: ${best.actionTaken}`,
    "추천 대응",
    "1. 동일 증상 재현 조건과 경고등, 누유, 소음 위치를 먼저 확인합니다.",
    "2. 과거 조치 부품 또는 점검 부위를 우선 점검하고, 고객 사용 환경 변화를 기록합니다.",
    "3. 완료 전 시운전 결과와 재발 가능성을 보고에 남깁니다.",
    "",
    "참고 유사 이력:",
    similar
  ].join("\n");
}

function workReportDraftAnswer(question: string, matches: AiMatch[], rows: AiWorkOrder[]) {
  const best = matches.find((match) => match.hasRepairHistory) ?? matches[0];
  const current = rows.find((row) => !isAiClosed(row)) ?? rows[0];
  return [
    "정비 완료보고 초안",
    `대상: ${current ? `${current.requestNo} / ${current.customer?.name ?? "고객 미지정"} / ${current.equipmentInput ?? current.equipmentNoNormalized ?? "-"}` : "선택 정비건"}`,
    `문의 내용: ${question}`,
    `증상: ${current?.faultDescription ?? best?.faultDescription ?? "현장 증상 입력 필요"}`,
    `진단: ${best?.diagnosisResult ?? "점검 결과와 원인 부품을 입력하세요."}`,
    `조치: ${best?.actionTaken ?? "조치 내용과 교체/조정 부위를 입력하세요."}`,
    "확인: 시운전, 누유/소음/경고등 재확인, 고객 인수 확인",
    "추가 메모: 재발 가능성이 있으면 관찰 필요 부위를 명시하세요.",
    "",
    "권한 안내: 정비사는 본인 작업의 완료보고 문안 작성은 가능하지만, 개인 KPI나 전체 성과 지표는 조회할 수 없습니다."
  ].join("\n");
}

function operationsReportAnswer(rows: AiWorkOrder[]) {
  const summary = summarizeRows(rows);
  const notable = rows
    .filter((row) => row.priorityLevel === "P1" || row.status === "DELAYED" || row.status === "REPORT_SUBMITTED")
    .slice(0, 5)
    .map((row) => `- ${row.requestNo} ${row.customer?.name ?? "-"} / ${row.faultDescription} / ${statusText(row.status)}`)
    .join("\n");
  return [
    "운영 보고자료 초안",
    `총 접수 ${summary.total}건, 완료 ${summary.completed}건, 미결 ${summary.pending}건, 긴급 ${summary.urgent}건, 지연 ${summary.delayed}건입니다.`,
    `완료율은 ${summary.completionRate}%입니다.`,
    "",
    "특이사항",
    notable || "- 특이사항 없음",
    "",
    "보고 문안",
    `현재 미결 ${summary.pending}건 중 긴급 ${summary.urgent}건을 우선 처리 중이며, 보고 대기 및 지연 건은 관리자 확인 후 후속 조치 예정입니다.`
  ].join("\n");
}

function kpiAnswer(rows: AiWorkOrder[]) {
  const summary = summarizeRows(rows);
  const mechanicMap = new Map<string, { total: number; completed: number }>();
  for (const row of rows) {
    const name = row.assignedMechanic?.name ?? "미배정";
    const current = mechanicMap.get(name) ?? { total: 0, completed: 0 };
    current.total += 1;
    if (isAiClosed(row)) current.completed += 1;
    mechanicMap.set(name, current);
  }
  const mechanicRows = Array.from(mechanicMap, ([name, value]) => {
    const rate = value.total ? Math.round((value.completed / value.total) * 100) : 0;
    return `- ${name}: 총 ${value.total}건 / 완료 ${value.completed}건 / 완료율 ${rate}%`;
  }).join("\n");
  return [
    "KPI 요약",
    `전체 완료율 ${summary.completionRate}%`,
    `총 ${summary.total}건 / 완료 ${summary.completed}건 / 미결 ${summary.pending}건 / 긴급 ${summary.urgent}건 / 지연 ${summary.delayed}건`,
    "",
    "정비사별 처리 현황",
    mechanicRows || "- 데이터 없음",
    "",
    "권한 안내: KPI는 관리자, 임원, 최고관리자 권한에서만 제공됩니다."
  ].join("\n");
}

function adminDataAnswer(rows: AiWorkOrder[]) {
  const summary = summarizeRows(rows);
  return [
    "최고관리자 자료 요청",
    "계정, 권한, 감사 로그, 전체 운영 데이터 요청 권한이 확인되었습니다.",
    `현재 운영 데이터 기준 총 ${summary.total}건, 미결 ${summary.pending}건, 완료 ${summary.completed}건입니다.`,
    "가능 작업: 사용자 계정/권한 점검, 감사 로그 확인, 전체 KPI/보고자료 작성, 운영 데이터 검토",
    "민감 정보는 화면 공유 또는 엑셀 다운로드 전에 대상자와 목적을 확인하세요."
  ].join("\n");
}

function summarizeRows(rows: AiWorkOrder[]) {
  const total = rows.length;
  const completed = rows.filter(isAiClosed).length;
  const pending = total - completed;
  const urgent = rows.filter((row) => row.priorityLevel === "P1").length;
  const delayed = rows.filter((row) => row.status === "DELAYED").length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, pending, urgent, delayed, completionRate };
}

function isAiClosed(row: AiWorkOrder) {
  return ["FINAL_COMPLETED", "ARCHIVED", "CANCELLED"].includes(row.status);
}

function statusText(status: string) {
  return {
    RECEIVED: "접수",
    UNASSIGNED: "미배정",
    ASSIGNED: "배정",
    IN_PROGRESS: "작업중",
    REPORT_SUBMITTED: "보고 대기",
    ADMIN_REVIEW: "관리자 검토",
    FINAL_COMPLETED: "최종 완료",
    DELAYED: "지연",
    TEMPORARY_ACTION: "임시 조치",
    PART_WAITING: "부품 대기",
    ON_HOLD: "보류",
    CANCELLED: "취소",
    ARCHIVED: "보관"
  }[status] ?? status;
}

async function askOpenAi(question: string, matches: AiMatch[], rows: AiWorkOrder[], task: AiTaskPolicy, roles: RoleCode[]) {
  const summary = summarizeRows(rows);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appEnv.openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: appEnv.openAiModel,
      input: [
        {
          role: "system",
          content:
            [
              "You are a Korean maintenance operations assistant.",
              "Respect role-based access strictly.",
              "Never reveal KPI, performance, account, permission, audit, or organization-wide report data unless the current task policy allows it.",
              "If access is not allowed, explain that the data cannot be viewed due to role policy.",
              "Use only the provided scoped data when recommending repairs or drafting reports."
            ].join(" ")
        },
        {
          role: "user",
          content: [
            `질문: ${question}`,
            `작업 유형: ${task.label}`,
            `현재 역할: ${roles.join(", ")}`,
            `허용 역할: ${task.allowedRoles.join(", ")}`,
            `요약 데이터: 총 ${summary.total}건, 완료 ${summary.completed}건, 미결 ${summary.pending}건, 긴급 ${summary.urgent}건, 지연 ${summary.delayed}건, 완료율 ${summary.completionRate}%`,
            "유사 과거 정비 이력:",
            matches.length ? matches.map(formatMatchForPrompt).join("\n") : "검색된 유사 이력 없음"
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok) {
    throw new ApiError(502, "AI 응답을 받아오지 못했습니다.");
  }

  const body = (await response.json()) as {
    output_text?: string;
    output?: { content?: { text?: string; type?: string }[] }[];
  };
  const text =
    body.output_text ??
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n");
  return text?.trim() || localAiAnswer(question, matches, rows, task, roles);
}

function formatMatchForPrompt(row: AiMatch) {
  return [
    `정비건: ${row.requestNo}`,
    `고객/장비: ${row.customer} / ${row.equipment}`,
    `증상: ${row.faultDescription}`,
    `진단: ${row.diagnosisResult}`,
    `조치: ${row.actionTaken}`,
    `상태: ${row.status}`
  ].join(" | ");
}
