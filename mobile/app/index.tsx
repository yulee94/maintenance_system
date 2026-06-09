import { Redirect } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiBaseUrl } from "../src/api/client";
import { useAuth } from "../src/api/AuthContext";
import { colors, shadow } from "../src/theme/theme";

const demoAccounts = [
  { label: "고민서 책임", loginId: "ko.ms", password: "Admin!2026Test" },
  { label: "정비사", loginId: "jegal.ts", password: "Mech!2026Test" },
  { label: "접수자", loginId: "park.jw", password: "Reception!2026" }
];

export default function LoginScreen() {
  const { user, loading, login } = useAuth();
  const [loginId, setLoginId] = useState(demoAccounts[0]?.loginId ?? "");
  const [password, setPassword] = useState(demoAccounts[0]?.password ?? "");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>세션 확인 중</Text>
      </SafeAreaView>
    );
  }

  if (user) return <Redirect href="/today" />;

  async function handleLogin() {
    setSubmitting(true);
    try {
      await login(loginId.trim(), password);
    } catch (error) {
      Alert.alert("로그인 실패", error instanceof Error ? error.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.appName}>정비 렌탈 운영</Text>
          <Text style={styles.title}>현장 모바일 앱</Text>
          <Text style={styles.subtitle}>오늘 작업, 정비건, 완료건, AI 업무 지원을 한 화면 흐름으로 처리합니다.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>아이디</Text>
          <TextInput autoCapitalize="none" style={styles.input} value={loginId} onChangeText={setLoginId} />
          <Text style={styles.label}>비밀번호</Text>
          <TextInput secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
          <TouchableOpacity disabled={submitting} style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>{submitting ? "확인 중" : "로그인"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.demoGrid}>
          {demoAccounts.map((account) => (
            <Pressable
              key={account.loginId}
              style={styles.demoButton}
              onPress={() => {
                setLoginId(account.loginId);
                setPassword(account.password);
              }}
            >
              <Text style={styles.demoLabel}>{account.label}</Text>
              <Text style={styles.demoId}>{account.loginId}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.apiText}>API: {apiBaseUrl()}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.bg,
    flex: 1
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20
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
    fontWeight: "700"
  },
  hero: {
    marginBottom: 22
  },
  appName: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900"
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "900",
    marginTop: 8
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    gap: 10,
    padding: 16,
    ...shadow
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  loginButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 6,
    paddingVertical: 14
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900"
  },
  demoGrid: {
    gap: 8,
    marginTop: 16
  },
  demoButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  demoLabel: {
    color: colors.ink,
    fontWeight: "800"
  },
  demoId: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  apiText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 14,
    textAlign: "center"
  }
});
