import { importPKCS8, SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";

export const pushNotificationTypes = {
  WORK_ASSIGNED: "작업 배정 알림",
  APPROVAL_REQUEST: "승인 요청 알림",
  ANNOUNCEMENT: "공지사항",
  INCIDENT_ALERT: "장애 알림",
  INBOUND_OUTBOUND: "입고/출고 알림",
  RESERVATION: "예약 알림",
  PAYMENT_SETTLEMENT: "결제/정산 알림"
} as const;

export type PushNotificationType = keyof typeof pushNotificationTypes;

type PushRequest = {
  type: PushNotificationType;
  title: string;
  body: string;
  userIds?: string[];
  branchId?: string | null;
  data?: Record<string, string>;
};

type MobilePushDevice = {
  id: string;
  userId: string;
  branchId: string | null;
  deviceId: string;
  pushToken: string;
  platform: string;
};

export async function sendPushNotification(input: PushRequest) {
  const devices = await findTargetDevices(input);
  const results = [];
  for (const device of devices) {
    results.push(await sendToDevice(device, input));
  }
  return {
    type: input.type,
    label: pushNotificationTypes[input.type],
    targetDevices: devices.length,
    sent: results.filter((result) => result.status === "sent").length,
    skipped: results.filter((result) => result.status === "not_configured").length,
    failed: results.filter((result) => result.status === "failed").length,
    results
  };
}

async function findTargetDevices(input: PushRequest): Promise<MobilePushDevice[]> {
  if (appEnv.demoMode) return [];
  return prisma.mobileDevice.findMany({
    where: {
      revokedAt: null,
      ...(input.userIds?.length ? { userId: { in: input.userIds } } : {}),
      ...(input.branchId ? { branchId: input.branchId } : {})
    },
    select: {
      id: true,
      userId: true,
      branchId: true,
      deviceId: true,
      pushToken: true,
      platform: true
    }
  });
}

async function sendToDevice(device: MobilePushDevice, input: PushRequest) {
  try {
    if (device.platform === "android") return await sendFcm(device, input);
    if (device.platform === "ios") return await sendApns(device, input);
    return { deviceId: device.id, platform: device.platform, status: "failed" as const, error: "Unsupported platform." };
  } catch (error) {
    return {
      deviceId: device.id,
      platform: device.platform,
      status: "failed" as const,
      error: error instanceof Error ? error.message : "Push send failed."
    };
  }
}

async function sendFcm(device: MobilePushDevice, input: PushRequest) {
  if (!appEnv.fcmServerKey) {
    return { deviceId: device.id, platform: device.platform, status: "not_configured" as const };
  }
  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${appEnv.fcmServerKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: device.pushToken,
      priority: "high",
      notification: {
        title: input.title,
        body: input.body
      },
      data: {
        type: input.type,
        ...(input.data ?? {})
      }
    })
  });
  if (!response.ok) throw new Error(`FCM send failed: ${response.status}`);
  return { deviceId: device.id, platform: device.platform, status: "sent" as const };
}

async function sendApns(device: MobilePushDevice, input: PushRequest) {
  const { apnsKeyId, apnsTeamId, apnsBundleId, apnsPrivateKey } = appEnv;
  if (!apnsKeyId || !apnsTeamId || !apnsBundleId || !apnsPrivateKey) {
    return { deviceId: device.id, platform: device.platform, status: "not_configured" as const };
  }
  const privateKey = await importPKCS8(apnsPrivateKey.replace(/\\n/g, "\n"), "ES256");
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: apnsKeyId })
    .setIssuer(apnsTeamId)
    .setIssuedAt()
    .sign(privateKey);
  const host = appEnv.apnsUseSandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const response = await fetch(`https://${host}/3/device/${device.pushToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": apnsBundleId,
      "apns-push-type": "alert",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: input.title,
          body: input.body
        },
        sound: "default"
      },
      type: input.type,
      ...(input.data ?? {})
    })
  });
  if (!response.ok) throw new Error(`APNs send failed: ${response.status}`);
  return { deviceId: device.id, platform: device.platform, status: "sent" as const };
}
