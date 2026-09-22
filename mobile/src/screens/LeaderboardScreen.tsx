import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { db } from '../core/db';
import { resolveCategory } from '../core/service';
import { Avatar, EmptyState, Muted, Panel, Skeleton } from '../components/Bits';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { SegmentedControl } from '../components/SegmentedControl';
import { UserFormModal } from '../components/UserFormModal';
import { useAsync } from '../lib/hooks';
import { formatKg, pluralize, reps } from '../lib/format';
import { useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import { rankColor } from '../lib/theme';
import type { BoardMode, ExerciseCategory, LeaderRow } from '../types';
import type { RootStackParamList, TabParamList } from '../navigation/types';

const BOARDS: { id: BoardMode; label: string; blurb: string }[] = [
  { id: 'best', label: 'Best', blurb: 'Bodyweight-normalized score' },
  { id: 'absolute', label: 'Absolute', blurb: 'Raw rep counts, bodyweight ignored' },
  { id: 'improved', label: 'Most improved', blurb: 'Personal best compared with the first result' },
  { id: 'active', label: 'Most active', blurb: 'Sessions logged' },
];

function figures(row: LeaderRow, mode: BoardMode) {
  if (row.sessionCount === 0) {
    return { value: '—', suffix: '', detail: 'No result yet' };
  }

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
      return {
        value: row.pbNormalized.toFixed(2),
        suffix: 'pts',
        detail: reps(row.pbAbsolute),
      };
  }
}

export function LeaderboardScreen() {
  const route = useRoute<RouteProp<TabParamList, 'Leaderboard'>>();
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>(() =>
    resolveCategory(route.params?.category)
  );
  const [mode, setMode] = useState<BoardMode>('best');
  const [addOpen, setAddOpen] = useState(false);
  const version = useDataVersion();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (route.params?.category) {
      const found = db.category(route.params.category);
      if (found && found.id !== selectedCategory.id) {
        setSelectedCategory(found);
      }
    }
  }, [route.params?.category, selectedCategory.id]);

  const { data, loading, error } = useAsync(
    () => api.board(selectedCategory.slug, mode),
    [selectedCategory.slug, mode, version]
  );
  const board = BOARDS.find((b) => b.id === mode) ?? BOARDS[0];

  const hasRankedResults = data ? data.rows.some((r) => r.sessionCount > 0) : false;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Leaderboard</Text>

      {/* Prominent Exercise Selector */}
      <View style={styles.selectorWrapper}>
        <ExerciseSelector
          selected={selectedCategory}
          onSelect={(cat) => setSelectedCategory(cat)}
        />
      </View>

      <Muted>
        {board.blurb}
        {data && data.userCount > 0
          ? ` · median ${formatKg(data.medianMassKg)} · ${pluralize(data.userCount, 'athlete')}`
          : data
            ? ' · nobody on the board yet'
            : ''}
      </Muted>

      <View style={styles.seg}>
        <SegmentedControl options={BOARDS.map((b) => ({ id: b.id, label: b.label }))} value={mode} onChange={setMode} />
      </View>

      {error ? <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text> : null}

      {loading && !data ? (
        <Panel style={{ padding: 8 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} />
          ))}
        </Panel>
      ) : data && data.rows.length === 0 ? (
        <EmptyState
          title="No athletes yet"
          message="Add a colleague with their name, age and bodyweight. The office median — and everyone's normalized score — is worked out from the roster automatically."
          action={<TouchableOpacity onPress={() => setAddOpen(true)} style={[styles.cta, { backgroundColor: colors.accent }]}><Text style={{ color: colors.accentInk, fontWeight: '600' }}>Add athlete</Text></TouchableOpacity>}
        />
      ) : data ? (
        <>
          {!hasRankedResults ? (
            <View style={[styles.emptyCategoryNotice, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Text style={{ fontSize: 20 }}>🤸</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.noticeTitle, { color: colors.text }]}>
                  No results logged for {selectedCategory.name} yet
                </Text>
                <Text style={[styles.noticeSub, { color: colors.muted }]}>
                  Tap any athlete below to log the first {selectedCategory.name.toLowerCase()} score!
                </Text>
              </View>
            </View>
          ) : null}

          <Panel>
            {data.rows.map((row, i) => {
              const f = figures(row, mode);
              const trend = row.trend === 'up' ? '↑' : row.trend === 'down' ? '↓' : '';
              const isUnranked = row.rank === null;

              return (
                <TouchableOpacity
                  key={row.id}
                  onPress={() => navigation.navigate('UserDetail', { id: row.id, category: selectedCategory.slug })}
                  style={[
                    styles.row,
                    i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                    isUnranked && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.rank, { color: isUnranked ? colors.faint : rankColor(row.rank ?? 0, colors) }]}>
                    {row.rank !== null ? row.rank : '—'}
                  </Text>
                  <Avatar name={row.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                      {row.name} {trend}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                      {[row.age ? `${row.age}y` : null, formatKg(row.weightKg), `×${row.multiplier.toFixed(2)}`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.score, { color: isUnranked ? colors.muted : colors.text }]}>
                      {f.value}
                      {f.suffix ? <Text style={{ color: colors.faint, fontSize: 11 }}> {f.suffix}</Text> : null}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                      {f.detail}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Panel>
        </>
      ) : null}

      {mode === 'improved' && data && hasRankedResults ? (
        <Text style={[styles.footnote, { color: colors.faint }]}>
          Improvement is measured from an athlete's first recorded result to their best score.
        </Text>
      ) : null}

      <UserFormModal visible={addOpen} onClose={() => setAddOpen(false)} onSaved={(u) => navigation.navigate('UserDetail', { id: u.id })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  title: { fontSize: 22, fontWeight: '700' },
  selectorWrapper: { marginTop: 4, marginBottom: 2 },
  seg: { marginVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  rank: { width: 22, fontWeight: '700', fontSize: 14, textAlign: 'center', fontVariant: ['tabular-nums'] },
  name: { fontWeight: '600', fontSize: 15 },
  score: { fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] },
  emptyCategoryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
  },
  noticeTitle: { fontSize: 14, fontWeight: '700' },
  noticeSub: { fontSize: 12, marginTop: 2 },
  footnote: { fontSize: 11, marginTop: 8, lineHeight: 16 },
  cta: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
});
