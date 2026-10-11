import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { db } from '../core/db';
import { resolveCategory } from '../core/service';
import { Avatar, EmptyState, PageHeader, Panel, Skeleton } from '../components/Bits';
import { Button } from '../components/Button';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { GradientFill } from '../components/Gradient';
import { CheckIcon, CrownIcon, PlusIcon, TrendDownIcon, TrendUpIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { UserFormModal } from '../components/UserFormModal';
import { useAsync } from '../lib/hooks';
import { formatKg, formatWeekRange, pluralize, reps } from '../lib/format';
import { useLogSheet } from '../lib/LogSheet';
import { useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import { rankColor, withAlpha } from '../lib/theme';
import type { BoardMode, ExerciseCategory, LeaderRow, OfficeResponse } from '../types';
import type { RootStackParamList, TabParamList } from '../navigation/types';

const BOARDS: { id: BoardMode; label: string; blurb: string }[] = [
  { id: 'best', label: 'Best', blurb: 'Bodyweight-normalized score' },
  { id: 'absolute', label: 'Absolute', blurb: 'Raw rep counts, bodyweight ignored' },
  { id: 'improved', label: 'Most improved', blurb: 'Personal best compared with the first result' },
  { id: 'active', label: 'Most active', blurb: 'Sessions logged' },
];

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Headline number and the quiet line next to it, per board. */
function figures(row: LeaderRow, mode: BoardMode): { value: string; suffix?: string; detail: string } {
  switch (mode) {
    case 'absolute':
      return {
        value: String(row.pbAbsolute),
        suffix: row.pbAbsolute === 1 ? 'rep' : 'reps',
        detail: `${row.pbNormalized.toFixed(2)} normalized`,
      };
    case 'improved':
      if (row.improvement === null) return { value: '–', detail: 'needs two results' };
      return {
        value: `${row.improvement > 0 ? '+' : ''}${row.improvement}%`,
        detail: `from ${row.firstNormalized?.toFixed(2)} to ${row.pbNormalized.toFixed(2)}`,
      };
    case 'active':
      return {
        value: String(row.sessionCount),
        suffix: row.sessionCount === 1 ? 'session' : 'sessions',
        detail: `${reps(row.totalReps)} total`,
      };
    default:
      return { value: row.pbNormalized.toFixed(2), suffix: 'pts', detail: reps(row.pbAbsolute) };
  }
}

export function LeaderboardScreen() {
  const route = useRoute<RouteProp<TabParamList, 'Leaderboard'>>();
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>(() =>
    resolveCategory(route.params?.category),
  );
  const [mode, setMode] = useState<BoardMode>('best');
  const [addOpen, setAddOpen] = useState(false);
  const version = useDataVersion();
  const { colors } = useTheme();
  const log = useLogSheet();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const lastParamCategory = useRef(route.params?.category);
  useEffect(() => {
    if (route.params?.category && route.params?.category !== lastParamCategory.current) {
      lastParamCategory.current = route.params.category;
      const found = db.category(route.params.category);
      if (found) setSelectedCategory(found);
    }
  }, [route.params?.category]);

  const handleSelectCategory = (cat: ExerciseCategory) => {
    lastParamCategory.current = cat.slug;
    setSelectedCategory(cat);
    navigation.setParams({ category: cat.slug } as never);
  };

  // Tag the board with the exercise/mode it was fetched for: until the response for the current selection
  // arrives we show the skeleton, not the previous selection's rows under the new mode's numbers.
  const boardKey = `${selectedCategory.slug}|${mode}`;
  const {
    data: fetched,
    loading,
    error,
  } = useAsync(async () => ({ key: boardKey, board: await api.board(selectedCategory.slug, mode) }), [boardKey, version]);
  const switching = fetched?.key !== boardKey;
  const data = switching ? null : fetched.board;
  const { data: office } = useAsync(() => api.office(selectedCategory.slug), [selectedCategory.slug, version]);

  const board = BOARDS.find((b) => b.id === mode) ?? BOARDS[0];
  const exerciseName = (db.category(selectedCategory.slug) ?? selectedCategory).name; // fresh after a rename

  const rows = data?.rows ?? [];
  const ranked = rows.filter((r) => r.rank !== null);
  const top = ranked.slice(0, 3);
  const rest = rows.filter((r) => !top.includes(r));
  const hasRanked = ranked.length > 0;

  const openProfile = (row: LeaderRow) =>
    navigation.navigate('UserDetail', { id: row.id, category: selectedCategory.slug });
  const quickLog = (row: LeaderRow) => log.open({ userId: row.id, category: selectedCategory });

  return (
    <Screen>
      <PageHeader
        eyebrow={`${exerciseName} leaderboard`}
        title="Board"
        right={<ExerciseSelector selected={selectedCategory} onSelect={handleSelectCategory} />}
      />

      <View style={{ marginTop: 16 }}>
        <SegmentedControl
          variant="chips"
          options={BOARDS.map((b) => ({ id: b.id, label: b.label }))}
          value={mode}
          onChange={setMode}
        />
      </View>

      <Text style={[styles.blurb, { color: colors.muted }]}>
        {board.blurb}
        {loading
          ? ' · updating...'
          : data && data.userCount > 0
            ? ` · median ${formatKg(data.medianMassKg)} · ${pluralize(data.userCount, 'athlete')}`
            : data
              ? ' · nobody on the board yet'
              : ''}
      </Text>

      {error ? <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text> : null}

      {switching && !error ? (
        <BoardSkeleton />
      ) : data && rows.length === 0 ? (
        <View style={{ marginTop: 20 }}>
          <EmptyState
            title="No athletes yet"
            message="Add a colleague with their name, age and bodyweight. The office median — and everyone's normalized score — is worked out from the roster automatically."
            action={<Button label="Add athlete" variant="primary" onPress={() => setAddOpen(true)} style={{ marginTop: 8 }} />}
          />
        </View>
      ) : data ? (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {hasRanked ? (
            <View style={styles.podium}>
              {top.length >= 2 ? <PodiumColumn row={top[1]} pos={2} mode={mode} onPress={openProfile} onLog={quickLog} /> : null}
              <PodiumColumn row={top[0]} pos={1} mode={mode} onPress={openProfile} onLog={quickLog} solo={top.length === 1} />
              {top.length >= 3 ? (
                <PodiumColumn row={top[2]} pos={3} mode={mode} onPress={openProfile} onLog={quickLog} />
              ) : top.length === 2 ? (
                <View style={{ flex: 1 }} />
              ) : null}
            </View>
          ) : (
            <View style={[styles.notice, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Text style={{ fontSize: 22 }}>🤸</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.noticeTitle, { color: colors.text }]}>No results logged for {exerciseName} yet</Text>
                <Text style={[styles.noticeSub, { color: colors.muted }]}>
                  Tap + next to an athlete to log the first score.
                </Text>
              </View>
            </View>
          )}

          {rest.length > 0 ? (
            <Panel style={hasRanked ? undefined : { marginTop: 14 }}>
              {rest.map((row, i) => (
                <LeaderboardRow
                  key={row.id}
                  row={row}
                  mode={mode}
                  first={i === 0}
                  onOpen={openProfile}
                  onLog={quickLog}
                />
              ))}
            </Panel>
          ) : null}

          {office && data.userCount > 0 ? <WeekCard office={office} athletes={rows} /> : null}
        </View>
      ) : null}

      {mode === 'improved' && data ? (
        <Text style={[styles.foot, { color: colors.faint }]}>
          Improvement is measured from an athlete's first recorded result to their best score, so one bad day
          doesn't erase progress. It appears once someone has logged two results.
        </Text>
      ) : null}

      <Text style={[styles.foot, { color: colors.faint }]}>score = {exerciseName.toLowerCase()} × (bodyweight ÷ office median) ^ 0.67</Text>

      <UserFormModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(u) => navigation.navigate('UserDetail', { id: u.id })}
      />
    </Screen>
  );
}

const PODIUM_HEIGHT = { 1: 104, 2: 78, 3: 58 } as const;

function PodiumColumn({
  row,
  pos,
  mode,
  onPress,
  onLog,
  solo,
}: {
  row: LeaderRow;
  pos: 1 | 2 | 3;
  mode: BoardMode;
  onPress: (row: LeaderRow) => void;
  onLog: (row: LeaderRow) => void;
  solo?: boolean;
}) {
  const { colors } = useTheme();
  const f = figures(row, mode);
  const tint = pos === 1 ? colors.gold : pos === 2 ? colors.silver : colors.bronze;
  const size = pos === 1 ? 76 : 60;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(row)}
      accessibilityLabel={`${row.name}, place ${row.rank ?? pos}`}
      style={[styles.pc, { flex: pos === 1 && !solo ? 1.14 : 1 }, solo && { flex: 0, width: '44%' }]}
    >
      {pos === 1 ? (
        <View style={styles.crown}>
          <CrownIcon size={22} strokeWidth={2} color={colors.gold} fill={colors.gold} />
        </View>
      ) : null}
      {/* The padding gives the quick-log badge room inside this box (touches outside a parent are dropped); the negative margin keeps the layout unchanged. */}
      <View style={styles.avBox}>
        <View
          style={[
            styles.avw,
            { backgroundColor: tint, borderRadius: (size + 6) / 2 },
            pos === 1 && { shadowColor: colors.gold, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
          ]}
        >
          <View style={{ borderWidth: 3, borderColor: colors.bg, borderRadius: size / 2, overflow: 'hidden' }}>
            <Avatar name={row.name} userId={row.id} size={size - 6} />
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onLog(row)}
          accessibilityLabel={`Log result for ${row.name}`}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={[styles.podPlus, { backgroundColor: colors.accent, borderColor: colors.bg }]}
        >
          <PlusIcon size={16} strokeWidth={3} color={colors.accentInk} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.pn, { color: colors.text }]} numberOfLines={1}>
        {firstName(row.name)}
      </Text>
      <Text
        style={[styles.ps, { color: pos === 1 ? colors.gold : colors.text, fontSize: pos === 1 ? 28 : 21 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {f.value}
        {f.suffix ? <Text style={[styles.psUnit, { color: colors.muted }]}> {f.suffix}</Text> : null}
      </Text>
      <View
        style={[
          styles.ped,
          {
            height: PODIUM_HEIGHT[pos],
            borderColor: withAlpha(tint, 0.35),
          },
        ]}
      >
        <GradientFill from={tint} to={tint} fromOpacity={0.22} toOpacity={0.02} />
        <Text style={[styles.pedNum, { color: tint }]}>{row.rank ?? pos}</Text>
      </View>
    </TouchableOpacity>
  );
}

function LeaderboardRow({
  row,
  mode,
  first,
  onOpen,
  onLog,
}: {
  row: LeaderRow;
  mode: BoardMode;
  first: boolean;
  onOpen: (row: LeaderRow) => void;
  onLog: (row: LeaderRow) => void;
}) {
  const { colors } = useTheme();
  const f = figures(row, mode);
  const isUnranked = row.rank === null;

  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }, isUnranked && { opacity: 0.8 }]}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => onOpen(row)} style={styles.rowMain}>
        <Text style={[styles.rk, { color: isUnranked ? colors.faint : rankColor(row.rank ?? 0, colors) }]}>
          {isUnranked ? '—' : row.rank}
        </Text>
        <Avatar name={row.name} userId={row.id} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.whoLine}>
            <Text style={[styles.who, { color: colors.text }]} numberOfLines={1}>
              {row.name}
            </Text>
            {row.trend === 'up' ? (
              <TrendUpIcon size={12} strokeWidth={2.4} color={colors.up} />
            ) : row.trend === 'down' ? (
              <TrendDownIcon size={12} strokeWidth={2.4} color={colors.down} />
            ) : null}
          </View>
          <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
            {[row.age ? `${row.age}y` : null, formatKg(row.weightKg), `×${row.multiplier.toFixed(2)}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <View style={styles.val}>
          <Text style={[styles.valMain, { color: isUnranked ? colors.muted : colors.text }]} numberOfLines={1}>
            {isUnranked ? '—' : f.value}
            {!isUnranked && f.suffix ? <Text style={[styles.valUnit, { color: colors.muted }]}> {f.suffix}</Text> : null}
          </Text>
          <Text style={[styles.valSub, { color: colors.muted }]} numberOfLines={1}>
            {isUnranked ? 'No attempts yet' : f.detail}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onLog(row)}
        accessibilityLabel={`Log result for ${row.name}`}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        style={[styles.plus, { backgroundColor: colors.surface3, borderColor: colors.border }]}
      >
        <PlusIcon size={18} strokeWidth={2.4} color={colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

/** Who has logged this week, and who is leading the XP race. */
function WeekCard({ office, athletes }: { office: OfficeResponse; athletes: LeaderRow[] }) {
  const { colors } = useTheme();
  const logged = new Set(office.xpThisWeek.map((x) => x.userId));
  const leader = office.xpThisWeek[0];
  const count = athletes.length;

  return (
    <View style={[styles.week, { borderColor: colors.border }]}>
      <GradientFill from={colors.surface2} to={colors.surface} direction="d" />
      <View style={styles.weekHead}>
        <Text style={[styles.weekTitle, { color: colors.text }]}>This week</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{formatWeekRange(office.week.start, office.week.end)}</Text>
      </View>
      <View style={[styles.weekRow, { justifyContent: count <= 6 ? 'space-between' : 'flex-start' }]}>
        {athletes.map((a) => {
          const done = logged.has(a.id);
          return (
            <View key={a.id} style={styles.wa}>
              <View>
                <View style={{ opacity: done ? 1 : 0.28 }}>
                  <Avatar name={a.name} userId={a.id} size={40} />
                </View>
                {done ? (
                  <View style={[styles.waCheck, { backgroundColor: colors.accent, borderColor: colors.surface2 }]}>
                    <CheckIcon size={10} strokeWidth={3.5} color={colors.accentInk} />
                  </View>
                ) : null}
              </View>
              <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                {firstName(a.name)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12.5 }}>
        {logged.size} of {count} logged
        {leader ? (
          <>
            {' · '}
            {firstName(leader.name)} leads with <Text style={{ color: colors.accent, fontWeight: '700' }}>{leader.xp} XP</Text>
          </>
        ) : (
          ' · be the first to log this week'
        )}
      </Text>
    </View>
  );
}

function BoardSkeleton() {
  return (
    <View style={{ marginTop: 20 }}>
      <View style={[styles.podium, { marginTop: 0 }]}>
        {[78, 104, 58].map((h, i) => (
          <View key={i} style={[styles.pc, { flex: i === 1 ? 1.14 : 1 }]}>
            <Skeleton height={i === 1 ? 76 : 60} style={{ width: i === 1 ? 76 : 60, borderRadius: 99 }} />
            <Skeleton height={14} style={{ width: '60%', marginTop: 8 }} />
            <Skeleton height={h} style={{ width: '100%', marginTop: 8, borderTopLeftRadius: 14, borderTopRightRadius: 14 }} />
          </View>
        ))}
      </View>
      <Panel style={{ padding: 8 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height={40} />
        ))}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  blurb: { fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  foot: { fontSize: 11, lineHeight: 16, marginTop: 18, marginHorizontal: 4 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginTop: 18 },
  noticeTitle: { fontSize: 14, fontWeight: '700' },
  noticeSub: { fontSize: 12, marginTop: 2 },

  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 14 },
  pc: { alignItems: 'center' },
  crown: { marginBottom: 5 },
  avBox: { padding: 8, margin: -8 },
  avw: { padding: 3 },
  podPlus: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pn: { marginTop: 9, fontWeight: '700', fontSize: 15 },
  ps: { fontWeight: '800', letterSpacing: -0.5, marginTop: 1, marginBottom: 9, fontVariant: ['tabular-nums'] },
  psUnit: { fontSize: 11, fontWeight: '600', letterSpacing: 0 },
  ped: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  pedNum: { fontSize: 34, fontWeight: '800', opacity: 0.92, lineHeight: 38 },

  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 4, minWidth: 0 },
  rk: { width: 20, textAlign: 'center', fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] },
  whoLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  who: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  meta: { fontSize: 11.5, marginTop: 1 },
  val: { alignItems: 'flex-end', maxWidth: 112 },
  valMain: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  valUnit: { fontSize: 11, fontWeight: '600' },
  valSub: { fontSize: 11, marginTop: 1 },
  plus: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  week: { marginTop: 14, padding: 16, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekTitle: { fontSize: 15, fontWeight: '700' },
  weekRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14, marginBottom: 12, marginHorizontal: 2 },
  wa: { alignItems: 'center', gap: 6, minWidth: 44 },
  waCheck: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
