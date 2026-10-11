import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, ApiError } from '../api';
import { db } from '../core/db';
import { resolveCategory } from '../core/service';
import { Card, CardHead, EmptyState, Skeleton } from '../components/Bits';
import { IconButton } from '../components/Button';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { BadgeMedal, LevelRing, XpProgress } from '../components/Game';
import { CornerGlow } from '../components/Gradient';
import { ChevronLeftIcon, MoreIcon, PencilIcon, PlusIcon, TrashIcon, UploadIcon } from '../components/Icons';
import { ImportModal } from '../components/ImportModal';
import { ConfirmDialog } from '../components/Modal';
import { Screen } from '../components/Screen';
import { ScoreChart } from '../components/ScoreChart';
import { SegmentedControl } from '../components/SegmentedControl';
import { useToast } from '../components/Toast';
import { UserFormModal } from '../components/UserFormModal';
import { useAsync } from '../lib/hooks';
import { daysAgo, formatDate, formatDateShort, formatKg } from '../lib/format';
import { useLogSheet } from '../lib/LogSheet';
import { invalidate, useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import type { ExerciseCategory } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Series = 'normalized' | 'absolute' | 'weight';

export function UserDetailScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'UserDetail'>>();
  const id = params.id;
  const version = useDataVersion();
  const toast = useToast();
  const log = useLogSheet();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>(() => resolveCategory(params.category));

  const lastParamCategory = useRef(params.category);
  useEffect(() => {
    if (params.category && params.category !== lastParamCategory.current) {
      lastParamCategory.current = params.category;
      const found = db.category(params.category);
      if (found) setSelectedCategory(found);
    }
  }, [params.category]);

  const handleSelectCategory = (cat: ExerciseCategory) => {
    lastParamCategory.current = cat.slug;
    setSelectedCategory(cat);
    navigation.setParams({ category: cat.slug });
  };

  const { data, loading, error } = useAsync(
    () =>
      Promise.all([api.user(id, selectedCategory.slug), api.board(selectedCategory.slug, 'best')]).then(
        ([user, board]) => ({ user, board }),
      ),
    [id, selectedCategory.slug, version],
  );

  const [series, setSeries] = useState<Series>('normalized');
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  /** Sessions that were a new best at the time (reps above everything before, never the very first result). */
  const pbIds = useMemo(() => {
    const ids = new Set<string>();
    if (!user) return ids;
    let best = 0;
    let first = true;
    for (const s of user.sessions) {
      if (!first && s.reps > best) ids.add(s.id);
      if (s.reps > best) best = s.reps;
      first = false;
    }
    return ids;
  }, [user]);

  const badges = useMemo(
    () => (user ? [...user.badges].sort((a, b) => Number(b.unlocked) - Number(a.unlocked)) : []),
    [user],
  );

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
      setDeleteOpen(false);
      navigation.goBack();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove this athlete.');
    } finally {
      setBusy(false);
    }
  }

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs'));
  const exerciseName = (db.category(selectedCategory.slug) ?? selectedCategory).name; // fresh after a rename
  const multiCategory = db.categories().length > 1;

  const topBar = (
    <View style={styles.bar}>
      <IconButton label="Back" onPress={goBack}>
        <ChevronLeftIcon size={20} strokeWidth={2.2} color={colors.text} />
      </IconButton>
      {multiCategory ? (
        <ExerciseSelector selected={selectedCategory} onSelect={handleSelectCategory} />
      ) : (
        <Text style={[styles.barTitle, { color: colors.text }]}>Profile</Text>
      )}
      <IconButton label="More" onPress={() => setMenuOpen(true)} style={{ opacity: user ? 1 : 0.4 }}>
        <MoreIcon size={20} color={colors.text} />
      </IconButton>
    </View>
  );

  if (loading && !data) {
    return (
      <Screen bottom="safe">
        {topBar}
        <View style={{ gap: 12, marginTop: 14 }}>
          <Skeleton height={200} />
          <Skeleton height={50} />
          <Skeleton height={220} />
        </View>
      </Screen>
    );
  }

  if (error || !data || !user) {
    return (
      <Screen bottom="safe">
        {topBar}
        <View style={{ marginTop: 14 }}>
          <EmptyState title="Athlete not found" message={error ?? 'That person is no longer on the board.'} />
        </View>
      </Screen>
    );
  }

  const noData = user.sessionCount === 0;
  const medianKg = data.user.medianMassKg;
  const seriesMeta = {
    normalized: { unit: 'pts', decimals: 2, color: colors.accent },
    absolute: { unit: selectedCategory.unit, decimals: 0, color: colors.text },
    weight: { unit: 'kg', decimals: 1, color: colors.muted },
  } as const;
  const active = seriesMeta[series];

  const stats: { value: string; label: string; hi?: boolean }[] = [
    { value: noData ? '–' : user.pbNormalized.toFixed(2), label: 'Normalized PB', hi: !noData },
    { value: noData ? '–' : String(user.pbAbsolute), label: `PB ${exerciseName.toLowerCase()}` },
    { value: String(user.totalReps), label: 'Total reps' },
    { value: String(user.sessionCount), label: 'Sessions' },
    { value: user.improvement === null ? '–' : `${user.improvement > 0 ? '+' : ''}${user.improvement}%`, label: 'Since first' },
    { value: user.lastResult?.date ? formatDateShort(user.lastResult.date) : '–', label: 'Last logged' },
  ];

  return (
    <Screen bottom="safe">
      {topBar}

      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <CornerGlow color={colors.accent} opacity={0.13} />
        <View style={styles.heroRow}>
          <LevelRing name={user.name} userId={user.id} level={user.level} ringBg={colors.surface} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
              {user.name}
            </Text>
            <View style={styles.tags}>
              {user.age ? <Tag label={`${user.age} y`} /> : null}
              <Tag label={formatKg(user.weightKg)} />
              <Tag label={`×${user.multiplier.toFixed(2)}`} />
              {normRank ? <Tag label={`Rank #${normRank} of ${total}`} tone="gold" /> : null}
            </View>
          </View>
        </View>
        {user.level ? <XpProgress level={user.level} streaks={user.streaks} /> : null}
      </View>

      {/* Actions */}
      <View style={styles.acts}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => log.open({ userId: user.id, category: selectedCategory })}
          style={[styles.logBtn, { backgroundColor: colors.accent }]}
          accessibilityLabel={`Log ${exerciseName}`}
        >
          <PlusIcon size={20} strokeWidth={2.6} color={colors.accentInk} />
          <Text style={[styles.logBtnText, { color: colors.accentInk }]} numberOfLines={1}>
            Log {exerciseName}
          </Text>
        </TouchableOpacity>
        <IconButton label="Import results" size={50} style={styles.sq} onPress={() => setImportOpen(true)}>
          <UploadIcon size={20} strokeWidth={2} color={colors.text} />
        </IconButton>
        <IconButton label="Edit athlete" size={50} style={styles.sq} onPress={() => setEditOpen(true)}>
          <PencilIcon size={19} strokeWidth={2} color={colors.text} />
        </IconButton>
      </View>

      {/* Career numbers */}
      <View style={styles.stats}>
        {stats.map((s) => (
          <View
            key={s.label}
            style={[
              styles.st,
              { backgroundColor: s.hi ? colors.accentSoft : colors.surface, borderColor: s.hi ? colors.accentLine : colors.border },
            ]}
          >
            <Text style={[styles.stValue, { color: s.hi ? colors.accent : colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {s.value}
            </Text>
            <Text style={[styles.stLabel, { color: colors.muted }]} numberOfLines={1}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Progress */}
      <Card style={styles.card}>
        <CardHead title="Progress" caption={exerciseName} />
        <View style={{ marginBottom: 8 }}>
          <SegmentedControl
            options={[
              { id: 'normalized' as const, label: 'Normalized' },
              { id: 'absolute' as const, label: exerciseName },
              { id: 'weight' as const, label: 'Bodyweight' },
            ]}
            value={series}
            onChange={setSeries}
          />
        </View>
        <ScoreChart points={chartPoints} unit={active.unit} decimals={active.decimals} color={active.color} />
      </Card>

      {/* Badges */}
      <Card style={styles.card}>
        <CardHead title="Badges" caption={`${user.unlockedBadgeCount} of ${user.badges.length} unlocked`} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4, gap: 12 }}
        >
          {badges.map((b) => (
            <BadgeMedal key={b.id} badge={b} />
          ))}
        </ScrollView>
      </Card>

      {/* History */}
      <Card style={styles.card}>
        <CardHead
          title="History"
          caption={user.sessionCount > 0 ? `last logged ${daysAgo(user.lastResult?.date)}` : 'nothing logged yet'}
        />
        {history.length === 0 ? (
          <Text style={[styles.emptyHistory, { color: colors.muted }]}>
            No {exerciseName.toLowerCase()} results recorded yet for {user.name}.
          </Text>
        ) : (
          <>
            <View style={[styles.hrow, { borderTopWidth: 0, paddingTop: 0, paddingBottom: 8 }]}>
              <Text style={[styles.hHead, { color: colors.faint, flex: 1, textAlign: 'left' }]}>Date</Text>
              <Text style={[styles.hHead, styles.cReps, { color: colors.faint }]}>Reps</Text>
              <Text style={[styles.hHead, styles.cKg, { color: colors.faint }]}>Weight</Text>
              <Text style={[styles.hHead, styles.cSc, { color: colors.faint }]}>Score</Text>
              <View style={styles.cDel} />
            </View>
            {visibleHistory.map((s) => (
              <View key={s.id} style={[styles.hrow, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: colors.text, fontSize: 13.5, fontVariant: ['tabular-nums'] }}>
                      {formatDateShort(s.date)}
                    </Text>
                    {pbIds.has(s.id) ? (
                      <View style={[styles.pbt, { backgroundColor: colors.accentSoft }]}>
                        <Text style={{ color: colors.accent, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 }}>PB</Text>
                      </View>
                    ) : null}
                  </View>
                  {s.note ? (
                    <Text style={{ color: colors.faint, fontSize: 11 }} numberOfLines={1}>
                      {s.note}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.hCell, styles.cReps, { color: colors.text }]}>{s.reps}</Text>
                <Text style={[styles.hCell, styles.cKg, { color: colors.muted }]}>{formatKg(s.weightKg)}</Text>
                <Text style={[styles.hCell, styles.cSc, { color: colors.accent, fontWeight: '800' }]}>
                  {s.normalized.toFixed(2)}
                </Text>
                <TouchableOpacity
                  style={styles.cDel}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  accessibilityLabel={`Delete the result from ${formatDate(s.date)}`}
                  onPress={() => void removeAttempt(s.id)}
                >
                  <TrashIcon size={15} strokeWidth={2} color={colors.faint} />
                </TouchableOpacity>
              </View>
            ))}
            {history.length > 8 ? (
              <TouchableOpacity onPress={() => setShowAll((v) => !v)} style={[styles.showAll, { borderTopColor: colors.border }]}>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>
                  {showAll ? 'Show less' : `Show all ${history.length}`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </Card>

      <Text style={[styles.foot, { color: colors.faint }]}>
        Normalized uses the bodyweight recorded on the day, against the office median of {formatKg(medianKg)}.
      </Text>

      <UserFormModal visible={editOpen} user={user} onClose={() => setEditOpen(false)} />
      <ImportModal
        visible={importOpen}
        user={user}
        initialCategory={selectedCategory}
        onClose={() => setImportOpen(false)}
      />

      {/* ⋯ menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)}>
          <View
            style={[
              styles.menu,
              { top: insets.top + 56, backgroundColor: colors.sheet, borderColor: colors.borderStrong },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                setTimeout(() => setDeleteOpen(true), 250);
              }}
            >
              <TrashIcon size={17} strokeWidth={2} color={colors.danger} />
              <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 14.5 }}>Remove athlete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={deleteOpen}
        title={`Remove ${user.name}?`}
        message={`This deletes ${user.name} and every logged result. Everyone else's normalized score shifts too.`}
        confirmLabel="Remove"
        busy={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void removeUser()}
      />
    </Screen>
  );
}

function Tag({ label, tone }: { label: string; tone?: 'gold' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: tone === 'gold' ? colors.goldSoft : colors.surface3 }]}>
      <Text style={{ color: tone === 'gold' ? colors.gold : colors.muted, fontSize: 11.5, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  barTitle: { fontSize: 16, fontWeight: '700' },
  hero: { marginTop: 14, padding: 18, paddingTop: 20, borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  tag: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 99 },
  acts: { flexDirection: 'row', gap: 8, marginTop: 14 },
  logBtn: { flex: 1, height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  logBtnText: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  sq: { borderRadius: 16 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  st: { width: '31.6%', flexGrow: 1, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1 },
  stValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.8, lineHeight: 28, fontVariant: ['tabular-nums'] },
  stLabel: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  card: { marginTop: 14 },
  emptyHistory: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  hrow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1, gap: 4 },
  hHead: { fontSize: 11, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase', textAlign: 'right' },
  hCell: { fontSize: 13.5, textAlign: 'right', fontVariant: ['tabular-nums'] },
  cReps: { width: 40 },
  cKg: { width: 62 },
  cSc: { width: 56 },
  cDel: { width: 30, alignItems: 'flex-end' },
  pbt: { marginLeft: 6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  showAll: { paddingTop: 12, marginTop: 4, borderTopWidth: 1, alignItems: 'center' },
  foot: { fontSize: 11, lineHeight: 16, marginTop: 18, marginHorizontal: 4 },
  menu: { position: 'absolute', right: 18, minWidth: 190, borderRadius: 16, borderWidth: 1, padding: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 11 },
});
