import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, ApiError } from '../api';
import { db } from '../core/db';
import { resolveCategory } from '../core/service';
import { Avatar, Card, EmptyState, Metric, Panel, SectionTitle, Skeleton } from '../components/Bits';
import { BadgeTile, LevelCard } from '../components/Game';
import { ScoreChart } from '../components/ScoreChart';
import { ConfirmDialog } from '../components/Modal';
import { AttemptFormModal } from '../components/AttemptFormModal';
import { ImportModal } from '../components/ImportModal';
import { UserFormModal } from '../components/UserFormModal';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { Button, IconButton } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { useAsync } from '../lib/hooks';
import { daysAgo, formatDate, formatKg, formatScore } from '../lib/format';
import { invalidate, useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import { useToast } from '../components/Toast';
import type { ExerciseCategory } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Series = 'normalized' | 'absolute' | 'weight';

export function UserDetailScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'UserDetail'>>();
  const id = params.id;
  const version = useDataVersion();
  const toast = useToast();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>(() => {
    return resolveCategory(params.category);
  });

  useEffect(() => {
    if (params.category) {
      const found = db.category(params.category);
      if (found && found.id !== selectedCategory.id) {
        setSelectedCategory(found);
      }
    }
  }, [params.category, selectedCategory.id]);

  const { data, loading, error } = useAsync(
    () =>
      Promise.all([
        api.user(id, selectedCategory.slug),
        api.board(selectedCategory.slug, 'best'),
      ]).then(([user, board]) => ({ user, board })),
    [id, selectedCategory.slug, version],
  );

  const [series, setSeries] = useState<Series>('normalized');
  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const user = data?.user.user;
  const normRank = data?.board.rows.find((r) => r.id === id)?.rank ?? null;
  const total = data?.board.userCount ?? 0;

  const chartPoints = useMemo(() => {
    if (!user) return [];
    return user.sessions.map((s) => ({
      id: s.id,
      date: s.date,
      reps: s.reps,
      weightKg: s.weightKg,
      value: series === 'normalized' ? s.normalized : series === 'absolute' ? s.reps : s.weightKg,
    }));
  }, [user, series]);

  const history = useMemo(() => (user ? [...user.sessions].reverse() : []), [user]);
  const visibleHistory = showAll ? history : history.slice(0, 8);

  async function removeAttempt(attemptId: string) {
    try {
      await api.deleteAttempt(attemptId);
      invalidate();
      toast.success('Result deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete this result.');
    }
  }

  async function removeUser() {
    if (!user) return;
    setBusy(true);
    try {
      await api.deleteUser(user.id);
      invalidate();
      toast.success(`${user.name} removed.`);
      navigation.goBack();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove this athlete.');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <Skeleton height={90} />
        <Skeleton height={220} />
        <Skeleton height={260} />
      </View>
    );
  }

  if (error || !data || !user) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <EmptyState title="Athlete not found" message={error ?? 'That person is no longer on the board.'} />
      </View>
    );
  }

  const medianKg = data.user.medianMassKg;
  const seriesMeta = {
    normalized: { unit: 'pts', decimals: 2, color: colors.accent },
    absolute: { unit: selectedCategory.unit, decimals: 0, color: colors.text },
    weight: { unit: 'kg', decimals: 1, color: colors.muted },
  } as const;
  const active = seriesMeta[series];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Avatar name={user.name} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: colors.text }]}>{user.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {[
              user.age ? `${user.age} years` : null,
              formatKg(user.weightKg),
              `×${user.multiplier.toFixed(2)} mass`,
              normRank ? `rank #${normRank} of ${total}` : 'unranked in exercise',
              user.level ? `${user.xp} XP` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>

      {/* Category selector on Profile */}
      <View style={styles.selectorWrapper}>
        <ExerciseSelector
          selected={selectedCategory}
          onSelect={(cat) => setSelectedCategory(cat)}
          size="normal"
        />
      </View>

      <View style={styles.actions}>
        <Button label={`Log ${selectedCategory.name}`} variant="primary" small onPress={() => setLogOpen(true)} />
        <Button label="Import" small onPress={() => setImportOpen(true)} />
        <IconButton label="✎" onPress={() => setEditOpen(true)} />
        <IconButton label="🗑" onPress={() => setDeleteOpen(true)} color={colors.danger} />
      </View>

      {user.level ? <LevelCard level={user.level} streaks={user.streaks} /> : null}

      <Card>
        <View style={styles.metrics}>
          <Metric label="Normalized PB" accent={user.sessionCount > 0} value={user.sessionCount ? formatScore(user.pbNormalized) : '–'} />
          <Metric label={`PB ${selectedCategory.name.toLowerCase()}`} value={user.sessionCount ? user.pbAbsolute : '–'} />
          <Metric label={`Total ${selectedCategory.unit}`} value={user.totalReps} />
          <Metric label="Sessions" value={user.sessionCount} />
          <Metric
            label="Since first result"
            value={user.improvement === null ? '–' : `${user.improvement > 0 ? '+' : ''}${user.improvement}%`}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.chartHead}>
          <SectionTitle>Progress ({selectedCategory.name})</SectionTitle>
          <SegmentedControl
            options={[
              { id: 'normalized' as const, label: 'Normalized' },
              { id: 'absolute' as const, label: selectedCategory.name },
              { id: 'weight' as const, label: 'Bodyweight' },
            ]}
            value={series}
            onChange={setSeries}
          />
        </View>
        <ScoreChart points={chartPoints} unit={active.unit} decimals={active.decimals} color={active.color} />
      </Card>

      <Panel>
        <View style={styles.sectionHead}>
          <SectionTitle>Badges</SectionTitle>
          <Text style={{ color: colors.faint, fontSize: 11 }}>
            {user.unlockedBadgeCount} of {user.badges.length} unlocked
          </Text>
        </View>
        <View style={[styles.badgeGrid, { borderTopColor: colors.border }]}>
          {user.badges.map((badge) => (
            <View key={badge.id} style={{ width: '48%' }}>
              <BadgeTile badge={badge} />
            </View>
          ))}
        </View>
      </Panel>

      <Panel>
        <View style={styles.sectionHead}>
          <SectionTitle>History ({selectedCategory.name})</SectionTitle>
          <Text style={{ color: colors.faint, fontSize: 11 }}>
            {user.sessionCount > 0 ? `last logged ${daysAgo(user.lastResult?.date)}` : 'nothing logged yet'}
          </Text>
        </View>
        {history.length === 0 ? (
          <Text style={[styles.emptyHistory, { color: colors.muted, borderTopColor: colors.border }]}>
            No {selectedCategory.name.toLowerCase()} results recorded yet for {user.name}.
          </Text>
        ) : (
          visibleHistory.map((s, i) => (
            <View key={s.id} style={[styles.historyRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontVariant: ['tabular-nums'] }}>{formatDate(s.date)}</Text>
                {s.note ? <Text style={{ color: colors.faint, fontSize: 11 }}>{s.note}</Text> : null}
              </View>
              <Text style={[styles.historyNum, { color: colors.text }]}>{s.reps}</Text>
              <Text style={[styles.historyNum, { color: colors.muted }]}>{formatKg(s.weightKg)}</Text>
              <Text style={[styles.historyNum, { color: colors.accent, fontWeight: '700' }]}>{formatScore(s.normalized)}</Text>
              <TouchableOpacity onPress={() => void removeAttempt(s.id)}>
                <Text style={{ color: colors.faint, fontSize: 14 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
        {history.length > 8 ? (
          <TouchableOpacity onPress={() => setShowAll((v) => !v)} style={[styles.showAll, { borderTopColor: colors.border }]}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{showAll ? 'Show less' : `Show all ${history.length}`}</Text>
          </TouchableOpacity>
        ) : null}
      </Panel>

      <Text style={[styles.footnote, { color: colors.faint }]}>
        Normalized uses the bodyweight recorded on the day, against the office median of {formatKg(medianKg)}.
      </Text>

      <AttemptFormModal
        visible={logOpen}
        user={user}
        medianMassKg={medianKg}
        initialCategory={selectedCategory}
        onClose={() => setLogOpen(false)}
      />
      <UserFormModal visible={editOpen} user={user} onClose={() => setEditOpen(false)} />
      <ImportModal
        visible={importOpen}
        user={user}
        initialCategory={selectedCategory}
        onClose={() => setImportOpen(false)}
      />
      <ConfirmDialog
        visible={deleteOpen}
        title={`Remove ${user.name}?`}
        message={`This deletes ${user.name} and every logged result. Everyone else's normalized score shifts too.`}
        confirmLabel="Remove"
        busy={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void removeUser()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  loading: { flex: 1, padding: 16, gap: 12 },
  back: { marginBottom: 4 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  selectorWrapper: { marginVertical: 2 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  chartHead: { gap: 10, marginBottom: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderTopWidth: 1 },
  emptyHistory: { padding: 24, textAlign: 'center', borderTopWidth: 1, fontSize: 13 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  historyNum: { width: 44, textAlign: 'right', fontSize: 13, fontVariant: ['tabular-nums'] },
  showAll: { padding: 12, borderTopWidth: 1, alignItems: 'center' },
  footnote: { fontSize: 11, lineHeight: 16 },
});
