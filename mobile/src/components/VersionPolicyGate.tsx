import { useEffect, useState, type PropsWithChildren } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchVersionPolicy, type VersionPolicy } from "../config/versionPolicy";
import { colors, shadow } from "../theme/theme";

type VersionPolicyState =
  | { status: "checking" }
  | { status: "ready"; policy: VersionPolicy | null; warning?: string }
  | { status: "blocked"; policy: VersionPolicy };

export function VersionPolicyGate({ children }: PropsWithChildren) {
  const [state, setState] = useState<VersionPolicyState>({ status: "checking" });
  const [bannerDismissed, setBannerDismissed] = useState(false);

  async function checkPolicy() {
    setState({ status: "checking" });
    try {
      const policy = await fetchVersionPolicy();
      if (policy.maintenance_mode || policy.force_update_required) {
        setState({ status: "blocked", policy });
        return;
      }
      setState({ status: "ready", policy });
    } catch (error) {
      setState({
        status: "ready",
        policy: null,
        warning: error instanceof Error ? error.message : "버전 정책 확인에 실패했습니다."
      });
    }
  }

  useEffect(() => {
    void checkPolicy();
  }, []);

  if (state.status === "checking") {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>앱 버전 정책 확인 중</Text>
      </SafeAreaView>
    );
  }

  if (state.status === "blocked") {
    const isMaintenance = state.policy.maintenance_mode;
    return (
      <SafeAreaView style={styles.blockedScreen}>
        <View style={styles.blockedCard}>
          <Text style={styles.kicker}>{isMaintenance ? "서버 점검" : "업데이트 필요"}</Text>
          <Text style={styles.blockedTitle}>{isMaintenance ? "현재 서비스 점검 중입니다." : "앱 업데이트가 필요합니다."}</Text>
          <Text style={styles.blockedMessage}>
            {state.policy.notice_message ||
              `현재 앱 버전은 ${state.policy.current_version}입니다. ${state.policy.minimum_supported_version} 이상으로 업데이트해 주세요.`}
          </Text>
          <View style={styles.versionBox}>
            <Text>현재 버전 {state.policy.current_version}</Text>
            <Text>최소 지원 {state.policy.minimum_supported_version}</Text>
            <Text>최신 버전 {state.policy.latest_version}</Text>
          </View>
          {!isMaintenance ? (
            <TouchableOpacity style={styles.primaryButton} onPress={() => openStore(state.policy)}>
              <Text style={styles.primaryButtonText}>스토어에서 업데이트</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.secondaryButton} onPress={checkPolicy}>
            <Text style={styles.secondaryButtonText}>다시 확인</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const showUpdateBanner = !bannerDismissed && state.policy?.update_available;
  const showWarning = !bannerDismissed && state.warning;

  return (
    <View style={styles.shell}>
      {showUpdateBanner ? (
        <View style={styles.banner}>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>새 버전이 있습니다.</Text>
            <Text style={styles.bannerBody}>{state.policy?.notice_message || "최신 버전으로 업데이트하면 더 안정적으로 사용할 수 있습니다."}</Text>
          </View>
          <TouchableOpacity style={styles.bannerButton} onPress={() => state.policy && openStore(state.policy)}>
            <Text style={styles.bannerButtonText}>업데이트</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissButton} onPress={() => setBannerDismissed(true)}>
            <Text style={styles.dismissButtonText}>닫기</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {showWarning ? (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>{state.warning}</Text>
          <TouchableOpacity onPress={() => setBannerDismissed(true)}>
            <Text style={styles.warningDismiss}>닫기</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function openStore(policy: VersionPolicy) {
  const storeUrl = Platform.OS === "ios" ? policy.store_urls.ios : policy.store_urls.android;
  if (storeUrl) void Linking.openURL(storeUrl);
}

const styles = StyleSheet.create({
  shell: {
    flex: 1
  },
  center: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    gap: 10,
    justifyContent: "center"
  },
  centerText: {
    color: colors.muted,
    fontWeight: "800"
  },
  blockedScreen: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: "center",
    padding: 20
  },
  blockedCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    gap: 14,
    maxWidth: 420,
    padding: 22,
    width: "100%",
    ...shadow
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  blockedTitle: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 32
  },
  blockedMessage: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  versionBox: {
    backgroundColor: colors.blueSoft,
    borderRadius: 8,
    gap: 5,
    padding: 12
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 13
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: "900"
  },
  banner: {
    alignItems: "center",
    backgroundColor: colors.primary,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  bannerText: {
    flex: 1,
    gap: 2
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900"
  },
  bannerBody: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    lineHeight: 17
  },
  bannerButton: {
    backgroundColor: "#fff",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  bannerButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900"
  },
  dismissButton: {
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  dismissButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800"
  },
  warningBanner: {
    alignItems: "center",
    backgroundColor: colors.amberSoft,
    flexDirection: "row",
    gap: 8,
    padding: 10
  },
  warningText: {
    color: colors.amber,
    flex: 1,
    fontSize: 12,
    fontWeight: "800"
  },
  warningDismiss: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: "900"
  }
});
