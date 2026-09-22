import { StyleSheet, Text, View } from 'react-native';
import type { Badge, Level, Streaks } from '../types';
import { useTheme } from '../lib/ThemeContext';
import { tierColor } from '../lib/theme';

export function LevelCard({ level, streaks }: { level: Level; streaks: Streaks }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={styles.levelHead}>
          <Text style={[styles.faint, { color: colors.faint }]}>Level {level.level}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{level.title}</Text>
        </View>
        <Text style={[styles.xp, { color: colors.muted }]}>
          {level.isMax ? `${level.xp} XP · maxed out` : `${level.xp} / ${level.xp + level.xpToNext} XP`}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
        <View style={[styles.fill, { width: `${level.progress}%`, backgroundColor: colors.accent }]} />
      </View>
      <View style={styles.row}>
        <Text style={[styles.faint, { color: colors.faint, flex: 1 }]}>
          {level.isMax ? 'Office Legend — nothing left to prove.' : `${level.xpToNext} XP to ${level.nextTitle}`}
        </Text>
        <StreakLine streaks={streaks} />
      </View>
    </View>
  );
}

export function StreakLine({ streaks }: { streaks: Streaks }) {
  const { colors } = useTheme();
  if (streaks.weeks === 0 && streaks.days === 0) {
    return <Text style={[styles.faint, { color: colors.faint }]}>No streak yet</Text>;
  }
  if (streaks.weeks > 1) {
    return (
      <Text style={[styles.faint, { color: colors.down }]}>
        🔥 {streaks.weeks}-week streak{streaks.bestWeeks > streaks.weeks ? ` (best ${streaks.bestWeeks})` : ''}
      </Text>
    );
  }
  return (
    <Text style={[styles.faint, { color: colors.down }]}>
      🔥 {streaks.days === 1 ? 'Back today' : `${streaks.days} days in a row`}
    </Text>
  );
}

export function BadgeTile({ badge }: { badge: Badge }) {
  const { colors } = useTheme();
  const color = tierColor(badge.tier, colors);
  return (
    <View
      style={[
        styles.badge,
        {
          borderColor: colors.border,
          borderStyle: badge.unlocked ? 'solid' : 'dashed',
          backgroundColor: badge.unlocked ? colors.surface2 : 'transparent',
          opacity: badge.unlocked ? 1 : 0.55,
        },
      ]}
    >
      <View
        style={[
          styles.badgeIcon,
          {
            borderColor: badge.unlocked ? color : colors.border,
            backgroundColor: badge.unlocked ? colors.surface : 'transparent',
          },
        ]}
      >
        <Text style={{ fontSize: 14, opacity: badge.unlocked ? 1 : 0.4 }}>{badge.emoji}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.badgeName, { color: badge.unlocked ? colors.text : colors.muted }]} numberOfLines={1}>
          {badge.name}
        </Text>
        <Text style={[styles.badgeSub, { color: colors.faint }]} numberOfLines={1}>
          {badge.unlocked
            ? badge.unlockedAt ?? 'unlocked'
            : badge.progress
              ? `${badge.progress.raw} / ${badge.progress.target}`
              : 'locked'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  levelHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { fontSize: 14, fontWeight: '600' },
  xp: { fontSize: 12, fontVariant: ['tabular-nums'] },
  faint: { fontSize: 12 },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 8 },
  badgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: { fontSize: 12, fontWeight: '600' },
  badgeSub: { fontSize: 10 },
});
