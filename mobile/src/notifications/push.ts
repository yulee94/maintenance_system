import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type NativePushRegistration = {
  pushToken: string;
  platform: "ios" | "android";
  appVersion: string;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

export async function getNativePushRegistration(): Promise<NativePushRegistration> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new Error("모바일 푸시 알림은 iOS 또는 Android 앱에서만 사용할 수 있습니다.");
  }

  if (!Device.isDevice) {
    throw new Error("푸시 알림은 실제 기기에서 확인해야 합니다.");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "정비 알림",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563eb"
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    throw new Error("작업 배정, 승인 요청, 장애 알림을 받기 위해 푸시 알림 권한이 필요합니다.");
  }

  const token = await Notifications.getDevicePushTokenAsync();
  if (token.type !== "ios" && token.type !== "android") {
    throw new Error("지원하지 않는 푸시 토큰 형식입니다.");
  }

  return {
    pushToken: String(token.data),
    platform: token.type,
    appVersion: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "0.1.0"
  };
}
