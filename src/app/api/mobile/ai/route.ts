import { NextRequest } from "next/server";
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
  assignedMechanic?: { name?: string | null } | null;
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

export async function POST(request: NextRequest) {
  try {
    await requireUser(request);
    const input = await readJson(request, schema);
    const rows = await getAiWorkOrders();
    const matches = findSimilarWorkOrders(input.question, rows).slice(0, 5);

    if (appEnv.openAiApiKey) {
      return ok({
        source: "openai",
        answer: await askOpenAi(input.question, matches),
        matches
      });
    }

    return ok({
      source: appEnv.demoMode ? "demo" : "local",
      answer: localAiAnswer(input.question, matches),
      matches
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
      assignedMechanic: { select: { name: true } },
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

function localAiAnswer(question: string, matches: AiMatch[]) {
  if (!matches.length) {
    return [
      `문의: ${question}`,
      "유사 이력을 찾지 못했습니다.",
      "추천 확인 순서: 장비번호/호기 재확인, 최근 정비 이력 조회, 증상 재현 조건 기록, 사진 또는 현장 메모 첨부.",
      "정확한 조치 전에는 안전 정지와 관리자 확인을 우선하세요."
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
    "추천 대응:",
    "1. 동일 증상 재현 조건과 경고등/누유/소음 위치를 먼저 확인합니다.",
    "2. 과거 조치 부품 또는 점검 부위를 우선 점검하고, 고객 사용 환경 변화를 기록합니다.",
    "3. 완료 전 시운전 결과와 재발 가능성을 보고에 남깁니다.",
    "",
    "참고 유사 이력:",
    similar
  ].join("\n");
}

async function askOpenAi(question: string, matches: AiMatch[]) {
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
            "You are a Korean maintenance operations assistant. Answer concisely for mechanics and admins. Use only the provided maintenance history when recommending similar repairs. If evidence is weak, say so and suggest what to inspect next."
        },
        {
          role: "user",
          content: [
            `질문: ${question}`,
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
  return text?.trim() || localAiAnswer(question, matches);
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
