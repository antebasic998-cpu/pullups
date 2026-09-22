import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { avatarColor, initials } from '../lib/format';
import { useTheme } from '../lib/ThemeContext';

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(name),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: '#14161a' }}>{initials(name)}</Text>
    </View>
  );
}

export function Metric({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: accent ? colors.accent : colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.faint }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.muted }]}>{message}</Text>
      {action}
    </View>
  );
}

export function Panel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.sectionTitle, { color: colors.text }]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.muted, fontSize: 13 }, style]}>{children}</Text>;
}

export function Skeleton({ height = 46 }: { height?: number }) {
  const { colors } = useTheme();
  return <View style={[styles.skeleton, { height, backgroundColor: colors.surface3 }]} />;
}

const styles = StyleSheet.create({
  metric: { gap: 2 },
  metricValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 11 },
  empty: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyMessage: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  panel: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600' },
  skeleton: { borderRadius: 10, marginVertical: 6, marginHorizontal: 8 },
});
