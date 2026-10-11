import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { db } from '../core/db';
import { avatarColor, initials } from '../lib/format';
import { useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';

/**
 * Round athlete avatar: the profile photo when there is one (looked up by `userId`, or passed as `url`),
 * otherwise coloured initials.
 */
export function Avatar({
  name,
  size = 32,
  userId,
  url,
}: {
  name: string;
  size?: number;
  userId?: string | null;
  /** Overrides the lookup – used to preview a photo that has not been saved yet. */
  url?: string | null;
}) {
  const { colors } = useTheme();
  useDataVersion(); // photos change through the shared data version
  const src = url ?? (userId ? (db.user(userId)?.avatarUrl ?? null) : null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <Image
        source={{ uri: src }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface3 }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

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
      <Text
        allowFontScaling={false}
        style={{ fontSize: Math.round(size * 0.38), fontWeight: '800', color: '#0b0c0e', letterSpacing: -0.3 }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

/** Eyebrow + big title on the left, an optional control (usually the exercise pill) on the right. */
export function PageHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.pageTop}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: colors.muted }]} numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={[styles.pageTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {right}
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

/** Card heading: bold title on the left, quiet caption on the right. */
export function CardHead({ title, caption }: { title: string; caption?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.cardHead}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      {caption ? (
        <Text style={[styles.cardCaption, { color: colors.muted }]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.sectionTitle, { color: colors.text }]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.muted, fontSize: 12.5, lineHeight: 18 }, style]}>{children}</Text>;
}

export function Skeleton({ height = 46, style }: { height?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[styles.skeleton, { height, backgroundColor: colors.surface3 }, style]} />;
}

const styles = StyleSheet.create({
  pageTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '600' },
  pageTitle: { fontSize: 34, lineHeight: 38, fontWeight: '800', letterSpacing: -1, marginTop: 2 },
  empty: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyMessage: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  panel: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  card: { borderWidth: 1, borderRadius: 22, padding: 16 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardCaption: { fontSize: 12, flexShrink: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  skeleton: { borderRadius: 12, marginVertical: 6 },
});
