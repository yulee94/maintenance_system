export type AuthUser = {
  id: string;
  loginId: string;
  name: string;
  roles: string[];
  mustChangePassword: boolean;
};

export type LoginResponse = AuthUser & {
  sessionToken?: string;
  expiresInHours?: number;
  apiVersion?: string;
};

export type Summary = {
  total: number;
  completed: number;
  pending: number;
  delayed: number;
  planned: number;
  urgent: number;
  completionRate: number;
};

export type WorkOrder = {
  id: string;
  requestNo: string;
  branchId?: string | null;
  branchName?: string | null;
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
  isDelayed?: boolean;
  customer?: { id?: string; name?: string | null } | null;
  site?: { id?: string; name?: string | null } | null;
  assignedMechanic?: { id?: string; name?: string | null; title?: string | null; phone?: string | null } | null;
  reports?: {
    id: string;
    resultType: string;
    diagnosisResult: string;
    actionTaken: string;
    submittedAt: string;
  }[];
};

export type Branch = {
  id: string;
  code: string;
  name: string;
  customerId?: string | null;
  customerName?: string | null;
  isActive: boolean;
  source: "site" | "demo";
};

export type TaskBundle = {
  apiVersion: string;
  summary: Summary;
  tasks: WorkOrder[];
  total: number;
  serverTime: string;
};

export type AiResponse = {
  source: "demo" | "local" | "openai" | "policy";
  answer: string;
  denied: boolean;
  task: string;
  allowedRoles: string[];
  matches: {
    requestNo: string;
    customer: string;
    equipment: string;
    faultDescription: string;
    diagnosisResult: string;
    actionTaken: string;
    status: string;
    similarity: number;
    hasRepairHistory: boolean;
  }[];
};

export type ReportInput = {
  resultType: "COMPLETED" | "TEMPORARY_ACTION" | "INCOMPLETE" | "REVISIT_REQUIRED" | "UNKNOWN";
  diagnosisResult: string;
  actionTaken: string;
  incompleteReason?: string;
  temporaryFollowupDueDate?: string;
  temporaryFollowupContent?: string;
};
