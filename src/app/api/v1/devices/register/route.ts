import { NextRequest } from "next/server";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { hashDeviceId } from "@/lib/mobile-auth-policy";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const deviceId = request.headers.get("x-device-id");
    if (appEnv.mobileDeviceRegistrationRequired && !deviceId) {
      throw new ApiError(400, "모바일 기기 식별자가 필요합니다.");
    }

    const device = {
      registered: Boolean(deviceId),
      deviceIdHash: deviceId ? hashDeviceId(deviceId) : null,
      registeredAt: new Date().toISOString()
    };

    if (!appEnv.demoMode) {
      await auditLog({
        user,
        request,
        action: "mobile.device.register",
        targetType: "mobileDevice",
        targetId: device.deviceIdHash ?? undefined,
        after: device
      });
    }

    return ok({
      apiVersion: "v1",
      device
    });
  } catch (error) {
    return handleApiError(error);
  }
}
