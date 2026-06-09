export type IntegrationSourceSystem = "maintenance" | "bitween" | "payroll" | "attendance" | "workflow";

export type IntegrationRoleCode =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "EXECUTIVE"
  | "MECHANIC"
  | "RECEPTIONIST"
  | "FINANCE"
  | "HR"
  | "WORKFLOW_APPROVER";

export type AttendanceStatus = "WORKING" | "OFF_DUTY" | "ON_LEAVE" | "ABSENT" | "UNKNOWN";

export type MaintenanceApprovalStatus = "PENDING" | "ADMIN_APPROVED" | "FINAL_APPROVED" | "REJECTED";

export type PayrollExportStatus = "NOT_READY" | "READY" | "EXPORTED" | "FAILED";

export type AiResourceTask =
  | "maintenance"
  | "work_report"
  | "operations_report"
  | "kpi"
  | "admin_data"
  | "attendance"
  | "payroll";

export interface IntegrationActor {
  tenantId?: string;
  userId: string;
  employeeId?: string;
  externalUserId?: string;
  loginId: string;
  displayName: string;
  title?: string;
  teamCode?: string;
  roles: IntegrationRoleCode[];
  isActive: boolean;
  sourceSystem: IntegrationSourceSystem;
}

export interface AttendanceAvailabilitySnapshot {
  tenantId?: string;
  employeeId: string;
  workDate: string;
  attendanceStatus: AttendanceStatus;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  onLeave: boolean;
  overtimeMinutes?: number;
  sourceSystem: "bitween" | "attendance";
  metadata?: Record<string, unknown>;
}

export interface MaintenanceLaborExportPayload {
  requestId: string;
  tenantId?: string;
  workOrderId: string;
  requestNo: string;
  mechanicEmployeeId: string;
  startedAt?: string | null;
  reportedAt: string;
  laborMinutes: number;
  approvalStatus: MaintenanceApprovalStatus;
  payrollExportStatus: PayrollExportStatus;
  sourceSystem: "maintenance";
  metadata?: Record<string, unknown>;
}

export interface AiPolicyContext {
  actor: IntegrationActor;
  requestedTask: AiResourceTask;
  requestedResource: string;
  allowedScopes: string[];
  deniedReason?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationEnvelope<T> {
  ok: boolean;
  requestId?: string;
  sourceSystem: IntegrationSourceSystem;
  data?: T;
  error?: string;
  details?: Record<string, unknown>;
}
