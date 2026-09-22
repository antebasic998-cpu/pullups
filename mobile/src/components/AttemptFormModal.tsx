import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { todayISO } from '../lib/format';
import { invalidate } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import { useToast } from './Toast';
import { AppModal } from './Modal';
import { Button } from './Button';
import { TextField } from './TextField';
import { ExerciseSelector } from './ExerciseSelector';
import { db } from '../core/db';
import type { ExerciseCategory, UserSummary } from '../types';

export function AttemptFormModal({
  visible,
  onClose,
  user,
  medianMassKg,
  initialCategory,
}: {
  visible: boolean;
  onClose: () => void;
  user: UserSummary;
  medianMassKg: number;
  initialCategory?: ExerciseCategory | null;
}) {
  const toast = useToast();
  const { colors } = useTheme();
  const [category, setCategory] = useState<ExerciseCategory>(
    initialCategory ?? user.category ?? db.defaultCategory()
  );
  const [reps, setReps] = useState('');
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCategory(initialCategory ?? user.category ?? db.defaultCategory());
    setReps('');
    setDate(todayISO());
    setWeight(String(user.weightKg));
    setNote('');
    setError(null);
    setBusy(false);
  }, [visible, user, initialCategory]);

  const repsNum = Number(reps);
  const weightNum = Number(weight.replace(',', '.'));
  const exponent = category.normalizationExponent ?? 0.67;
  const preview =
    Number.isFinite(repsNum) && repsNum > 0 && Number.isFinite(weightNum) && weightNum > 0 && medianMassKg > 0
      ? repsNum * (weightNum / medianMassKg) ** exponent
      : null;

  async function submit() {
    setError(null);
    if (!reps.trim()) return setError(`How many ${category.name.toLowerCase()}?`);
    setBusy(true);
    try {
      await api.addAttempt(user.id, {
        categoryId: category.id,
        reps,
        date,
        weightKg: weight,
        note: note.trim(),
      });
      invalidate();
      toast.success(`Logged ${Math.round(Number(reps))} ${category.unit} for ${user.name}.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this attempt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppModal
      visible={visible}
      title={`Log result — ${user.name}`}
      subtitle={`Normalized against office median of ${medianMassKg} kg`}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Cancel" onPress={onClose} disabled={busy} />
          <Button label={busy ? 'Saving…' : 'Save result'} variant="primary" onPress={submit} disabled={busy} loading={busy} />
        </View>
      }
    >
      <View style={styles.form}>
        <View>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Exercise</Text>
          <ExerciseSelector selected={category} onSelect={setCategory} size="normal" />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField
              label={`${category.name} completed`}
              value={reps}
              onChangeText={(v) => setReps(v.replace(/[^\d]/g, ''))}
              keyboardType="numeric"
              placeholder="12"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder={todayISO()} />
          </View>
        </View>

        <TextField
          label="Bodyweight that day (kg)"
          value={weight}
          onChangeText={(v) => setWeight(v.replace(/[^\d.,]/g, ''))}
          keyboardType="decimal-pad"
        />
        <Text style={{ color: colors.faint, fontSize: 11 }}>
          Pre-filled with {user.name}'s current weight — adjust if you know it differed.
        </Text>

        <TextField
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Strict form, dead hang, full ROM"
        />

        <View style={[styles.preview, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Normalized score</Text>
            {preview !== null ? (
              <Text style={{ color: colors.faint, fontSize: 11, marginTop: 2 }}>
                {Math.round(repsNum)} reps · {weightNum} kg · median {medianMassKg} kg
              </Text>
            ) : (
              <Text style={{ color: colors.faint, fontSize: 11, marginTop: 2 }}>
                Calculated live from reps & bodyweight
              </Text>
            )}
          </View>
          <Text style={{ color: colors.accent, fontSize: 20, fontWeight: '800' }}>
            {preview === null ? '–' : `${preview.toFixed(2)} pts`}
          </Text>
        </View>

        {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, paddingBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
