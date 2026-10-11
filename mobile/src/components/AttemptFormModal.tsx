import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api, ApiError } from '../api';
import { db } from '../core/db';
import { formatDate, formatKg, todayISO } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { getLastAthlete, setLastAthlete } from '../lib/lastAthlete';
import { previewLog } from '../lib/preview';
import { useSettings } from '../lib/SettingsContext';
import { invalidate, useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import type { ExerciseCategory } from '../types';
import { Avatar, Skeleton } from './Bits';
import { Button } from './Button';
import { useCelebration } from './Celebration';
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  MinusIcon,
  PlusIcon,
  ScaleIcon,
} from './Icons';
import { SheetHeader, SheetModal } from './Modal';
import { SegmentedControl } from './SegmentedControl';
import { useToast } from './Toast';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Athlete to pre-select. Falls back to the last athlete logged for, then the first on the board. */
  userId?: string | null;
  category?: ExerciseCategory | null;
  /** Shown when the roster is empty. */
  onAddAthlete?: () => void;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function shiftDay(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const next = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta);
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${next.getFullYear()}-${mm}-${dd}`;
}

/**
 * The Log sheet. Bodyweight is snapshotted with the attempt, so a bulking (or
 * cutting) phase does not retroactively change old scores. The athlete is
 * switchable inside the sheet, which lets the big "+" in the tab bar log for anyone.
 */
export function AttemptFormModal({ visible, onClose, userId, category, onAddAthlete }: Props) {
  const toast = useToast();
  const { celebrate } = useCelebration();
  const { celebrationsEnabled } = useSettings();
  const { colors } = useTheme();
  const version = useDataVersion();

  const [activeCategory, setActiveCategory] = useState<ExerciseCategory>(category ?? db.defaultCategory());
  const [selectedId, setSelectedId] = useState<string | null>(userId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [reps, setReps] = useState('');
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wasVisible = useRef(false);

  // Reset every time the sheet opens.
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setActiveCategory(category ?? db.defaultCategory());
      setSelectedId(userId ?? null);
      setPickerOpen(false);
      setDateOpen(false);
      setReps('');
      setDate(todayISO());
      setNote('');
      setError(null);
      setBusy(false);
    }
    wasVisible.current = visible;
  }, [visible, category, userId]);

  // The board doubles as the athlete list, the office median and the "where does this land" data.
  const { data: board, loading: boardLoading } = useAsync(
    () => (visible ? api.board(activeCategory.slug, 'best') : Promise.resolve(null)),
    [visible, activeCategory.slug, version],
  );
  const rows = board?.rows ?? [];
  const medianMassKg = board?.medianMassKg ?? 0;

  // Settle on an athlete once the roster is known.
  useEffect(() => {
    if (!visible || rows.length === 0) return;
    if (selectedId && rows.some((r) => r.id === selectedId)) return;
    const last = getLastAthlete();
    const pick = rows.find((r) => r.id === userId) ?? rows.find((r) => r.id === last) ?? rows[0];
    setSelectedId(pick.id);
  }, [visible, rows, selectedId, userId]);

  const user = rows.find((r) => r.id === selectedId) ?? null;

  // Pre-fill bodyweight with the chosen athlete's current weight.
  useEffect(() => {
    if (user) setWeight(String(user.weightKg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const repsNum = Number(reps) || 0;
  const weightNum = Number(weight.replace(',', '.'));
  const exponent = activeCategory.normalizationExponent ?? 0.67;
  const score =
    repsNum > 0 && Number.isFinite(weightNum) && weightNum > 0 && medianMassKg > 0
      ? repsNum * (weightNum / medianMassKg) ** exponent
      : null;
  const preview = user && score !== null ? previewLog(user, rows, repsNum, score) : null;
  const exerciseName = activeCategory.name.toLowerCase();
  const today = todayISO();

  const setRepsClamped = (n: number) => setReps(n <= 0 ? '' : String(Math.min(500, n)));

  async function submit() {
    if (!user) return;
    setError(null);
    if (repsNum < 1) return setError(`How many ${exerciseName}?`);
    if (!ISO.test(date)) return setError('Use the date format YYYY-MM-DD.');
    setBusy(true);
    try {
      const res = await api.addAttempt(user.id, {
        categoryId: activeCategory.id,
        reps,
        date,
        weightKg: weight,
        note: note.trim(),
      });
      setLastAthlete(user.id);
      invalidate();
      onClose();
      if (res.celebration && res.celebration.xpGained > 0 && celebrationsEnabled) {
        setTimeout(() => celebrate(res.celebration!), 300);
      } else {
        toast.success(`Logged ${Math.round(repsNum)} ${exerciseName} for ${user.name}.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this attempt.');
    } finally {
      setBusy(false);
    }
  }

  const noAthletes = !!board && rows.length === 0;
  const categories = db.categories();

  const headline = !preview
    ? null
    : preview.isFirst
      ? 'First result'
      : preview.isPb
        ? 'New personal best'
        : `${preview.below.toFixed(2)} pts below your best`;

  let rankLine = '';
  if (preview) {
    const verb =
      preview.rankBefore === null ? 'Enters at' : preview.rankAfter < preview.rankBefore ? 'Climbs to' : 'Stays';
    rankLine = `${verb} #${preview.rankAfter}`;
    if (preview.neighbour) {
      rankLine += `, ${preview.neighbour.gap.toFixed(2)} pts ${preview.neighbour.ahead ? 'behind' : 'clear of'} ${preview.neighbour.name}`;
    }
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <SheetHeader title="Log result" onClose={onClose} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 6 }}
      >
        {noAthletes ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>No athletes yet</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
              Add someone with their name, age and bodyweight, then come back to log their first result.
            </Text>
            <Button label="Add athlete" variant="primary" onPress={() => onAddAthlete?.()} />
          </View>
        ) : (
          <>
            {/* Who */}
            {user ? (
              <>
                <TouchableOpacity
                  activeOpacity={rows.length > 1 ? 0.75 : 1}
                  onPress={() => rows.length > 1 && setPickerOpen((v) => !v)}
                  accessibilityLabel={`Athlete: ${user.name}`}
                  style={[styles.who, { backgroundColor: colors.surface2 }]}
                >
                  <Avatar name={user.name} userId={user.id} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.whoName, { color: colors.text }]} numberOfLines={1}>
                      {user.name}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                      {user.sessionCount > 0
                        ? `PB ${user.pbAbsolute} · ${user.pbNormalized.toFixed(2)} pts · ×${user.multiplier.toFixed(2)}`
                        : `No results yet · ×${user.multiplier.toFixed(2)}`}
                    </Text>
                  </View>
                  {rows.length > 1 ? (
                    <View style={{ transform: [{ rotate: pickerOpen ? '180deg' : '0deg' }] }}>
                      <ChevronDownIcon size={18} strokeWidth={2.2} color={colors.muted} />
                    </View>
                  ) : null}
                </TouchableOpacity>

                {pickerOpen ? (
                  <View style={[styles.menu, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                      {rows.map((r) => {
                        const on = r.id === user.id;
                        return (
                          <TouchableOpacity
                            key={r.id}
                            onPress={() => {
                              setSelectedId(r.id);
                              setPickerOpen(false);
                            }}
                            style={[styles.menuRow, on && { backgroundColor: colors.surface3 }]}
                          >
                            <Avatar name={r.name} userId={r.id} size={30} />
                            <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: on ? '700' : '500' }}>
                              {r.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={[styles.who, { backgroundColor: colors.surface2 }]}>
                <Skeleton height={40} style={{ width: 40, borderRadius: 20, marginVertical: 0 }} />
                <View style={{ flex: 1 }}>
                  <Skeleton height={14} style={{ width: '55%', marginVertical: 0 }} />
                  <Skeleton height={11} style={{ width: '75%', marginTop: 8, marginBottom: 0 }} />
                </View>
              </View>
            )}

            {categories.length > 1 ? (
              <SegmentedControl
                options={categories.map((c) => ({ id: c.id, label: c.name }))}
                value={activeCategory.id}
                onChange={(id) => {
                  const next = categories.find((c) => c.id === id);
                  if (next) setActiveCategory(next);
                }}
              />
            ) : null}

            {/* Reps */}
            <View style={[styles.step, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <TouchableOpacity
                accessibilityLabel="One less"
                onPress={() => setRepsClamped(repsNum - 1)}
                style={[styles.roundBtn, { backgroundColor: colors.surface3, borderColor: colors.border, borderWidth: 1 }]}
              >
                <MinusIcon size={26} strokeWidth={2.4} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.stepCenter}>
                <TextInput
                  accessibilityLabel={`${exerciseName} completed`}
                  value={reps}
                  onChangeText={(v) => setReps(v.replace(/[^\d]/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.faint}
                  selectTextOnFocus
                  maxLength={3}
                  style={[styles.stepInput, { color: colors.text }]}
                />
                <Text style={[styles.stepCaption, { color: colors.muted }]} numberOfLines={1}>
                  {exerciseName}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="One more"
                onPress={() => setRepsClamped(repsNum + 1)}
                style={[styles.roundBtn, { backgroundColor: colors.accent }]}
              >
                <PlusIcon size={26} strokeWidth={2.6} color={colors.accentInk} />
              </TouchableOpacity>
            </View>

            <View style={styles.two}>
              <View style={[styles.fld, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fldLabel, { color: colors.muted }]}>Bodyweight</Text>
                  <View style={styles.weightRow}>
                    <TextInput
                      accessibilityLabel="Bodyweight in kilograms"
                      value={weight}
                      onChangeText={(v) => setWeight(v.replace(/[^\d.,]/g, ''))}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      style={[styles.fldValue, { color: colors.text, minWidth: 28 }]}
                    />
                    <Text style={[styles.fldValue, { color: colors.text }]}>kg</Text>
                  </View>
                </View>
                <ScaleIcon size={18} strokeWidth={2} color={colors.muted} />
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityLabel="Change date"
                onPress={() => setDateOpen((v) => !v)}
                style={[
                  styles.fld,
                  {
                    backgroundColor: colors.surface2,
                    borderColor: dateOpen ? colors.accentLine : colors.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fldLabel, { color: colors.muted }]}>Date</Text>
                  <Text style={[styles.fldValue, { color: colors.text }]} numberOfLines={1}>
                    {date === today ? 'Today' : ISO.test(date) ? formatDate(date) : date}
                  </Text>
                </View>
                <CalendarIcon size={18} strokeWidth={2} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {dateOpen ? (
              <View style={[styles.dateRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                <TouchableOpacity
                  accessibilityLabel="Previous day"
                  onPress={() => ISO.test(date) && setDate(shiftDay(date, -1))}
                  style={[styles.dateBtn, { backgroundColor: colors.surface3 }]}
                >
                  <ChevronLeftIcon size={18} strokeWidth={2.4} color={colors.text} />
                </TouchableOpacity>
                <TextInput
                  accessibilityLabel="Date (YYYY-MM-DD)"
                  value={date}
                  onChangeText={(v) => setDate(v.replace(/[^\d-]/g, '').slice(0, 10))}
                  keyboardType="numbers-and-punctuation"
                  placeholder={today}
                  placeholderTextColor={colors.faint}
                  style={[styles.dateInput, { color: colors.text }]}
                />
                <TouchableOpacity
                  accessibilityLabel="Next day"
                  disabled={!ISO.test(date) || date >= today}
                  onPress={() => setDate(shiftDay(date, 1))}
                  style={[styles.dateBtn, { backgroundColor: colors.surface3, opacity: !ISO.test(date) || date >= today ? 0.35 : 1 }]}
                >
                  <View style={{ transform: [{ rotate: '180deg' }] }}>
                    <ChevronLeftIcon size={18} strokeWidth={2.4} color={colors.text} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setDate(today);
                    setDateOpen(false);
                  }}
                  style={[styles.todayBtn, { backgroundColor: colors.accentSoft, borderColor: colors.accentLine }]}
                >
                  <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12.5 }}>Today</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <TextInput
              accessibilityLabel="Note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (strict, dead hang, no kipping)"
              placeholderTextColor={colors.faint}
              maxLength={200}
              style={[styles.note, { color: colors.text, backgroundColor: colors.surface2, borderColor: colors.border }]}
            />

            {/* Live preview */}
            <View style={[styles.prev, { backgroundColor: colors.accentSoft, borderColor: colors.accentLine }]}>
              <Text style={[styles.prevBig, { color: colors.accent }]}>
                {score === null ? '–' : score.toFixed(2)}
                <Text style={[styles.prevPts, { color: colors.muted }]}> pts</Text>
              </Text>
              <Text style={[styles.prevText, { color: colors.muted }]}>
                {preview && headline ? (
                  <>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{headline}</Text>
                    {` · +${preview.xp} XP\n${rankLine}`}
                  </>
                ) : (
                  `Enter your reps to see where this lands on the board${medianMassKg > 0 ? ` (office median ${formatKg(medianMassKg)}).` : '.'}`
                )}
              </Text>
            </View>

            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

            <Button
              label={busy ? 'Saving…' : 'Save result'}
              variant="primary"
              big
              onPress={() => void submit()}
              disabled={busy || !user || (boardLoading && !user)}
              loading={busy}
              style={{ marginTop: 14 }}
            />
          </>
        )}
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  empty: { borderWidth: 1, borderRadius: 20, padding: 24, marginTop: 8, alignItems: 'center', gap: 10 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 12, padding: 10, paddingHorizontal: 12, borderRadius: 16 },
  whoName: { fontSize: 15, fontWeight: '700' },
  menu: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginTop: -4, marginBottom: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 12 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 12,
  },
  roundBtn: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  stepCenter: { flex: 1, alignItems: 'center' },
  stepInput: {
    width: '100%',
    height: 88,
    fontSize: 78,
    fontWeight: '800',
    letterSpacing: -3,
    textAlign: 'center',
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  stepCaption: { fontSize: 11.5, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 2 },
  two: { flexDirection: 'row', gap: 10, marginTop: 10 },
  fld: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  fldLabel: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  fldValue: { fontSize: 17, fontWeight: '700', padding: 0 },
  weightRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 16, borderWidth: 1, marginTop: 10 },
  dateBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateInput: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center', padding: 0 },
  todayBtn: { height: 38, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14.5 },
  prev: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  prevBig: { fontSize: 30, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  prevPts: { fontSize: 12, fontWeight: '600', letterSpacing: 0 },
  prevText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  error: { fontSize: 13, marginTop: 10 },
});
