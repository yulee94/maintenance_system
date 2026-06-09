import { NextRequest } from "next/server";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import { hashDeviceId } from "@/lib/mobile-auth-policy";

const schema = z.object({
  branchId: z.string().optional().nullable(),
  pushToken: z.string().min(8),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().optional().nullable()
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const deviceId = request.headers.get("x-device-id");
    if (appEnv.mobileDeviceRegistrationRequired && !deviceId) {
      throw new ApiError(400, "모바일 기기 식별자가 필요합니다.");
    }
    const body = await request.json().catch(() => {
      throw new ApiError(400, "푸시 토큰 등록 정보가 필요합니다.");
    });
    const input = schema.parse(body);
    const deviceIdHash = deviceId ? hashDeviceId(deviceId) : "unknown-device";
    const now = new Date();

    if (appEnv.demoMode) {
      return ok({
        apiVersion: "v1",
        device: {
          userId: user.id,
          branchId: input.branchId ?? null,
          deviceId: deviceIdHash,
          pushTokenStored: true,
          platform: input.platform,
          appVersion: input.appVersion ?? null,
          lastActiveAt: now.toISOString()
        }
      });
    }

    const device = await prisma.mobileDevice.upsert({
      where: { userId_deviceId: { userId: user.id, deviceId: deviceIdHash } },
      update: {
        branchId: input.branchId ?? null,
        pushToken: input.pushToken,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        lastActiveAt: now,
        revokedAt: null
      },
      create: {
        userId: user.id,
        branchId: input.branchId ?? null,
        deviceId: deviceIdHash,
        pushToken: input.pushToken,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        lastActiveAt: now
      }
    });

    await auditLog({
      user,
      request,
      action: "mobile.device.register",
      targetType: "mobileDevice",
      targetId: device.id,
      after: {
        userId: device.userId,
        branchId: device.branchId,
        deviceId: device.deviceId,
        platform: device.platform,
        appVersion: device.appVersion,
        lastActiveAt: device.lastActiveAt
      }
    });

    return ok({
      apiVersion: "v1",
      device: {
        id: device.id,
        userId: device.userId,
        branchId: device.branchId,
        deviceId: device.deviceId,
        pushTokenStored: true,
        platform: device.platform,
        appVersion: device.appVersion,
        lastActiveAt: device.lastActiveAt.toISOString()
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
