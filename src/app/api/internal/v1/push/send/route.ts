import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { pushNotificationTypes, sendPushNotification } from "@/lib/push-notifications";

const schema = z.object({
  type: z.enum([
    "WORK_ASSIGNED",
    "APPROVAL_REQUEST",
    "ANNOUNCEMENT",
    "INCIDENT_ALERT",
    "INBOUND_OUTBOUND",
    "RESERVATION",
    "PAYMENT_SETTLEMENT"
  ]),
  title: z.string().min(1),
  body: z.string().min(1),
  userIds: z.array(z.string()).optional(),
  branchId: z.string().optional().nullable(),
  data: z.record(z.string(), z.string()).optional()
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request, [RoleCode.SUPER_ADMIN, RoleCode.ADMIN]);
    const input = await readJson(request, schema);
    const result = await sendPushNotification(input);
    if (!appEnv.demoMode) {
      await auditLog({
        user,
        request,
        action: "mobile.push.send",
        targetType: "pushNotification",
        after: {
          ...result,
          label: pushNotificationTypes[input.type]
        }
      });
    }
    return ok({
      apiVersion: "v1",
      result
    });
  } catch (error) {
    return handleApiError(error);
  }
}
