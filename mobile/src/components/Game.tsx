import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Badge, Level, Streaks } from '../types';
import { formatDateShort } from '../lib/format';
import { useTheme } from '../lib/ThemeContext';
import { tierColor } from '../lib/theme';
import { Avatar } from './Bits';
import { FlameIcon } from './Icons';

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

/** Avatar with a level-progress ring around it and a "LVL n" pill underneath. */
export function LevelRing({
  name,
  level,
  ringBg,
}: {
  name: string;
  level: Level | null;
  /** Colour of the surface the ring sits on, used to cut the pill out of the ring. */
  ringBg?: string;
}) {
  const { colors } = useTheme();
  const pct = level ? Math.min(100, Math.max(0, level.progress)) : 0;
  return (
    <View style={styles.ring}>
      <Svg width={96} height={96} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Circle cx="50" cy="50" r={RING_R} fill="none" stroke={colors.surface3} strokeWidth={5} />
        <Circle
          cx="50"
          cy="50"
          r={RING_R}
          fill="none"
          stroke={colors.accent}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${((RING_C * pct) / 100).toFixed(1)} 999`}
          transform="rotate(-90 50 50)"
        />
      </Svg>
      <Avatar name={name} size={74} />
      {level ? (
        <View style={[styles.lvl, { backgroundColor: colors.accent, borderColor: ringBg ?? colors.surface }]}>
          <Text style={[styles.lvlText, { color: colors.accentInk }]}>LVL {level.level}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** "4-week streak", "Back today", … or null when there is nothing to show. */
export function streakLabel(streaks: Streaks): string | null {
  if (streaks.weeks === 0 && streaks.days === 0) return null;
  if (streaks.weeks > 1) {
    return `${streaks.weeks}-week streak${streaks.bestWeeks > streaks.weeks ? ` (best ${streaks.bestWeeks})` : ''}`;
  }
  return streaks.days === 1 ? 'Back today' : `${streaks.days} days in a row`;
}

/** Level title, XP bar and streak. Deliberately says nothing about the score – XP never changes it. */
export function XpProgress({ level, streaks }: { level: Level; streaks: Streaks }) {
  const { colors } = useTheme();
  const streak = streakLabel(streaks);
  return (
    <View style={{ marginTop: 20 }}>
      <View style={styles.line}>
        <Text style={[styles.lineStrong, { color: colors.text }]} numberOfLines={1}>
          {level.title}
        </Text>
        <Text style={[styles.lineMuted, { color: colors.muted }]}>
          {level.isMax ? `${level.xp} XP · maxed out` : `${level.xp} / ${level.xp + level.xpToNext} XP`}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, level.progress))}%`, backgroundColor: colors.accent }]} />
      </View>
      <View style={styles.line}>
        <Text style={[styles.lineMuted, { color: colors.muted, flex: 1 }]} numberOfLines={1}>
          {level.isMax ? 'Office Legend — nothing left to prove.' : `${level.xpToNext} XP to ${level.nextTitle}`}
        </Text>
        {streak ? (
          <View style={styles.streak}>
            <FlameIcon size={13} strokeWidth={2.2} color={colors.down} />
            <Text style={[styles.lineMuted, { color: colors.down }]}>{streak}</Text>
          </View>
        ) : (
          <Text style={[styles.lineMuted, { color: colors.faint }]}>No streak yet</Text>
        )}
      </View>
    </View>
  );
}

const shortDate = (value: string | null): string | null =>
  value ? (/^\d{4}-\d{2}-\d{2}/.test(value) ? formatDateShort(value.slice(0, 10)) : value) : null;

/** A round, tier-ringed badge for the horizontal swipe row. Locked ones are dashed and faded. */
export function BadgeMedal({ badge }: { badge: Badge }) {
  const { colors } = useTheme();
  const tint = tierColor(badge.tier, colors);
  return (
    <View style={styles.badge}>
      <View
        style={[
          styles.medal,
          {
            backgroundColor: colors.surface2,
            borderColor: badge.unlocked ? tint : colors.faint,
            borderStyle: badge.unlocked ? 'solid' : 'dashed',
          },
        ]}
      >
        <Text style={{ fontSize: 26, opacity: badge.unlocked ? 1 : 0.35 }}>{badge.emoji}</Text>
      </View>
      <Text style={[styles.badgeName, { color: badge.unlocked ? colors.text : colors.muted }]} numberOfLines={2}>
        {badge.name}
      </Text>
      <Text style={[styles.badgeSub, { color: colors.faint }]} numberOfLines={1}>
        {badge.unlocked
          ? (shortDate(badge.unlockedAt) ?? 'unlocked')
          : badge.progress
            ? `${badge.progress.raw} / ${badge.progress.target}`
            : 'locked'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  lvl: {
    position: 'absolute',
    bottom: -9,
    alignSelf: 'center',
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 99,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lvlText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  lineStrong: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  lineMuted: { fontSize: 12.5, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 99, overflow: 'hidden', marginVertical: 8 },
  fill: { height: '100%', borderRadius: 99 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { width: 68, alignItems: 'center' },
  medal: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  badgeName: { fontSize: 11, fontWeight: '700', lineHeight: 13, textAlign: 'center' },
  badgeSub: { fontSize: 10, marginTop: 1, textAlign: 'center' },
});
