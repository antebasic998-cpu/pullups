import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { invalidate } from '../lib/store';
import { exerciseEmoji, inferCategoryIconKey, slugifyCategoryName } from '../lib/categoryUtils';
import { useTheme } from '../lib/ThemeContext';
import { useToast } from './Toast';
import { AppModal } from './Modal';
import { Button } from './Button';
import { TextField } from './TextField';
import type { ExerciseCategory } from '../types';

export function ExerciseFormModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: (category: ExerciseCategory) => void;
}) {
  const toast = useToast();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setDescription('');
    setError(null);
    setBusy(false);
  }, [visible]);

  const previewSlug = name.trim() ? slugifyCategoryName(name) : '';

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Enter a name for the exercise.');
    setBusy(true);
    try {
      const category = await api.createCategory({
        name: name.trim(),
        description: description.trim(),
      });
      invalidate();
      toast.success(`${category.name} added to the board.`);
      onSaved?.(category);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this exercise.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppModal
      visible={visible}
      title="Add exercise"
      subtitle="New exercises sync to everyone on the board automatically."
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Cancel" onPress={onClose} disabled={busy} />
          <Button
            label={busy ? 'Saving…' : 'Add exercise'}
            variant="primary"
            onPress={submit}
            disabled={busy}
            loading={busy}
          />
        </View>
      }
    >
      <View style={styles.form}>
        <TextField
          label="Exercise name"
          value={name}
          onChangeText={setName}
          placeholder="Assisted Chin-up"
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Band-assisted, strict form"
        />
        {previewSlug ? (
          <View style={[styles.preview, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={{ fontSize: 22 }}>
              {exerciseEmoji(inferCategoryIconKey(previewSlug, name.trim()), previewSlug)}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{name.trim()}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>slug: {previewSlug}</Text>
            </View>
          </View>
        ) : null}
        <Text style={{ color: colors.faint, fontSize: 11, lineHeight: 16 }}>
          Scored like pull-ups and chin-ups — reps with bodyweight-normalized points. Names containing
          “assisted”, “chin”, or “pull” pick the right icon automatically.
        </Text>
        {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, paddingBottom: 16 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
