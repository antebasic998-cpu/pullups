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
import type { UserSummary } from '../types';

export function UserFormModal({
  visible,
  onClose,
  user,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  user?: UserSummary | null;
  onSaved?: (user: UserSummary) => void;
}) {
  const toast = useToast();
  const { colors } = useTheme();
  const editing = Boolean(user);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [pb, setPb] = useState('');
  const [pbDate, setPbDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setBusy(false);
    setName(user?.name ?? '');
    setAge(user?.age ? String(user.age) : '');
    setWeight(user ? String(user.weightKg) : '');
    setNote(user?.note ?? '');
    setPb('');
    setPbDate(todayISO());
  }, [visible, user]);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Please enter a name.');
    if (!weight.trim()) return setError('Please enter a bodyweight in kilograms.');
    setBusy(true);
    try {
      const payload = { name: name.trim(), age: age || null, weightKg: weight.replace(',', '.'), note: note.trim() };
      const res =
        editing && user
          ? await api.updateUser(user.id, payload)
          : await api.createUser({ ...payload, pbAbsolute: pb || null, pbDate });
      invalidate();
      toast.success(editing ? `${payload.name} updated.` : `${payload.name} joined the board.`);
      onSaved?.(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppModal
      visible={visible}
      title={editing ? `Edit ${user?.name}` : 'Add an athlete'}
      subtitle={
        editing
          ? 'Changing bodyweight re-scores every result in normalized mode.'
          : 'Name, age and bodyweight are all the board needs to score fairly.'
      }
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Cancel" onPress={onClose} disabled={busy} />
          <Button
            label={busy ? 'Saving…' : editing ? 'Save changes' : 'Add athlete'}
            variant="primary"
            onPress={submit}
            disabled={busy}
            loading={busy}
          />
        </View>
      }
    >
      <View style={styles.form}>
        <TextField label="Full name" value={name} onChangeText={setName} placeholder="e.g. Marta Kowalska" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField label="Age" value={age} onChangeText={(v) => setAge(v.replace(/[^\d]/g, ''))} keyboardType="numeric" placeholder="29" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Bodyweight (kg)" value={weight} onChangeText={(v) => setWeight(v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="72.5" />
          </View>
        </View>
        {!editing ? (
          <View style={[styles.hint, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={[styles.hintText, { color: colors.muted }]}>
              Already have a personal best? Optional — record it now so the leaderboard is complete from day one.
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextField label="Pull-ups (PB)" value={pb} onChangeText={(v) => setPb(v.replace(/[^\d]/g, ''))} keyboardType="numeric" placeholder="optional" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Date set (YYYY-MM-DD)" value={pbDate} onChangeText={setPbDate} placeholder={todayISO()} />
              </View>
            </View>
          </View>
        ) : null}
        <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="Runs the morning run club" />
        {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, paddingBottom: 16 },
  row: { flexDirection: 'row', gap: 10 },
  hint: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  hintText: { fontSize: 12, lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
