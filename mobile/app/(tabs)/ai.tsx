import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { askAi } from "../../src/api/client";
import type { AiResponse } from "../../src/api/types";
import { Screen } from "../../src/components/Screen";
import { colors, shadow } from "../../src/theme/theme";

const quickQuestions = [
  "동일 고장이 반복되는 장비 알려줘",
  "오늘 미결 정비건 보고서 초안 작성해줘",
  "유사 고장 수리 이력 추천해줘"
];

export default function AiScreen() {
  const [question, setQuestion] = useState(quickQuestions[0] ?? "");
  const [result, setResult] = useState<AiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(nextQuestion = question) {
    if (!nextQuestion.trim()) {
      Alert.alert("질문 입력", "AI에게 물어볼 내용을 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const answer = await askAi(nextQuestion.trim());
      setResult(answer);
      setQuestion(nextQuestion);
    } catch (error) {
      Alert.alert("AI 요청 실패", error instanceof Error ? error.message : "AI 응답을 받지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen title="AI" subtitle="정비 문의, 완료보고, 운영 보고서 작성을 권한에 맞춰 지원합니다.">
      <View style={styles.card}>
        <Text style={styles.label}>업무 질문</Text>
        <TextInput multiline style={styles.input} value={question} onChangeText={setQuestion} />
        <TouchableOpacity disabled={loading} style={styles.button} onPress={() => void submit()}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>AI에게 묻기</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.quickRow}>
        {quickQuestions.map((item) => (
          <TouchableOpacity key={item} style={styles.quick} onPress={() => void submit(item)}>
            <Text style={styles.quickText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {result ? (
        <View style={[styles.answer, result.denied && styles.denied]}>
          <Text style={styles.answerMeta}>{result.denied ? "권한 정책 차단" : `${result.source} 답변`}</Text>
          <Text style={styles.answerText}>{result.answer}</Text>
          {result.matches.length ? (
            <View style={styles.matches}>
              <Text style={styles.matchesTitle}>유사 이력</Text>
              {result.matches.slice(0, 3).map((match) => (
                <Text key={match.requestNo} style={styles.matchText}>
                  {match.requestNo} · {match.customer} · {match.actionTaken}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.empty}>정비 관련 질문이나 보고서 초안을 요청해보세요.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    gap: 10,
    padding: 14,
    ...shadow
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  input: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    minHeight: 104,
    padding: 12,
    textAlignVertical: "top"
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 13
  },
  buttonText: {
    color: "#fff",
    fontWeight: "900"
  },
  quickRow: {
    gap: 8
  },
  quick: {
    backgroundColor: colors.blueSoft,
    borderRadius: 8,
    padding: 12
  },
  quickText: {
    color: colors.primary,
    fontWeight: "800"
  },
  answer: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    ...shadow
  },
  denied: {
    backgroundColor: colors.redSoft,
    borderColor: "#ffc8c0"
  },
  answerMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  answerText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 22
  },
  matches: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 6,
    paddingTop: 10
  },
  matchesTitle: {
    color: colors.ink,
    fontWeight: "900"
  },
  matchText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18
  },
  empty: {
    color: colors.muted,
    padding: 16,
    textAlign: "center"
  }
});
