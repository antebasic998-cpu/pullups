import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { invalidate } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import { useToast } from './Toast';
import { AppModal } from './Modal';
import { Button } from './Button';
import { TextField } from './TextField';
import { ExerciseSelector } from './ExerciseSelector';
import { db } from '../core/db';
import type { ExerciseCategory, UserSummary } from '../types';

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const TEMPLATE = `date,reps,weight
${isoDaysAgo(14)},10,72
${isoDaysAgo(7)},12,72
${isoDaysAgo(2)},13,71.5`;

export function ImportModal({
  visible,
  onClose,
  user,
  initialCategory,
}: {
  visible: boolean;
  onClose: () => void;
  user: UserSummary;
  initialCategory?: ExerciseCategory | null;
}) {
  const toast = useToast();
  const { colors } = useTheme();
  const [category, setCategory] = useState<ExerciseCategory>(
    initialCategory ?? user.category ?? db.defaultCategory()
  );
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setCategory(initialCategory ?? user.category ?? db.defaultCategory());
    setCsv('');
    setErrors([]);
    setBusy(false);
  }, [visible, user, initialCategory]);

  async function submit() {
    if (!csv.trim()) {
      setErrors(['Paste some rows first.']);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const res = await api.importCsv(user.id, csv, category.id);
      invalidate();
      toast.success(`Imported ${res.imported} result${res.imported === 1 ? '' : 's'} for ${category.name}.`);
      if (res.errors.length) setErrors(res.errors);
      else onClose();
    } catch (err) {
      setErrors([err instanceof ApiError ? err.message : 'Import failed.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppModal
      visible={visible}
      title={`Import history — ${user.name}`}
      subtitle={`Paste CSV rows to import for ${category.name}`}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Use template" onPress={() => setCsv(TEMPLATE)} disabled={busy} small />
          <Button label="Cancel" onPress={onClose} disabled={busy} />
          <Button label={busy ? 'Importing…' : 'Import'} variant="primary" onPress={submit} disabled={busy} loading={busy} />
        </View>
      }
    >
      <View style={styles.form}>
        <View>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Target Exercise</Text>
          <ExerciseSelector selected={category} onSelect={setCategory} size="normal" />
        </View>

        <TextField label="CSV data (date, reps, weight)" value={csv} onChangeText={setCsv} multiline placeholder={TEMPLATE} />
        {errors.map((e) => (
          <Text key={e} style={{ color: colors.danger, fontSize: 12 }}>
            {e}
          </Text>
        ))}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12, paddingBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
});
