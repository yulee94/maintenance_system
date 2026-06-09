import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, shadow } from "../theme/theme";

type Tone = "blue" | "green" | "amber" | "red" | "violet";

const toneColor: Record<Tone, { bg: string; ink: string }> = {
  blue: { bg: colors.blueSoft, ink: colors.primary },
  green: { bg: colors.greenSoft, ink: colors.green },
  amber: { bg: colors.amberSoft, ink: colors.amber },
  red: { bg: colors.redSoft, ink: colors.red },
  violet: { bg: colors.violetSoft, ink: colors.violet }
};

type SummaryCardProps = {
  label: string;
  value: number | string;
  tone: Tone;
  onPress?: () => void;
};

export function SummaryCard({ label, value, tone, onPress }: SummaryCardProps) {
  const palette = toneColor[tone];
  const Component = onPress ? TouchableOpacity : View;
  return (
    <Component style={[styles.card, { backgroundColor: palette.bg }]} onPress={onPress} activeOpacity={0.84}>
      <Text style={[styles.value, { color: palette.ink }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Component>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    flex: 1,
    minHeight: 86,
    justifyContent: "center",
    padding: 14,
    ...shadow
  },
  value: {
    fontSize: 26,
    fontWeight: "900"
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4
  }
});
