import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { invalidate } from '../lib/store';
import { exerciseEmoji, inferCategoryIconKey, slugifyCategoryName } from '../lib/categoryUtils';
import { useTheme } from '../lib/ThemeContext';
import { useToast } from './Toast';
import { AppModal } from './Modal';
import { Button } from './Button';
import { IconPicker } from './IconPicker';
import { TextField } from './TextField';
import type { ExerciseCategory } from '../types';

export function ExerciseFormModal({
  visible,
  onClose,
  category,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  /** Pass an exercise to rename it / change its icon; leave empty to add a new one. */
  category?: ExerciseCategory | null;
  onSaved?: (category: ExerciseCategory) => void;
}) {
  const toast = useToast();
  const { colors } = useTheme();
  const editing = Boolean(category);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('💪');
  // While adding, the icon follows the name ("chin" → 🤸) until the user picks one themselves.
  const [iconPicked, setIconPicked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
    setIcon(category ? exerciseEmoji(category.iconKey, category.slug) : '💪');
    setIconPicked(Boolean(category));
    setError(null);
    setBusy(false);
  }, [visible, category]);

  function onNameChange(value: string) {
    setName(value);
    if (!iconPicked) {
      const slug = slugifyCategoryName(value);
      setIcon(exerciseEmoji(inferCategoryIconKey(slug, value.trim()), slug));
    }
  }

  const previewSlug = !editing && name.trim() ? slugifyCategoryName(name) : '';

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Enter a name for the exercise.');
    setBusy(true);
    try {
      const input = { name: name.trim(), description: description.trim(), iconKey: icon };
      const saved = category ? await api.updateCategory(category.id, input) : await api.createCategory(input);
      invalidate();
      toast.success(editing ? `${saved.name} updated.` : `${saved.name} added to the board.`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : editing ? 'Could not save this exercise.' : 'Could not add this exercise.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppModal
      visible={visible}
      title={editing ? `Edit ${category?.name}` : 'Add exercise'}
      subtitle={
        editing
          ? 'Results stay exactly as they are — only the name and icon change, for everyone.'
          : 'New exercises sync to everyone on the board automatically.'
      }
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Cancel" onPress={onClose} disabled={busy} />
          <Button
            label={busy ? 'Saving…' : editing ? 'Save changes' : 'Add exercise'}
            variant="primary"
            onPress={submit}
            disabled={busy}
            loading={busy}
          />
        </View>
      }
    >
      <View style={styles.form}>
        <TextField label="Exercise name" value={name} onChangeText={onNameChange} placeholder="Assisted Chin-up" />
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: colors.muted }]}>Icon</Text>
          <IconPicker
            value={icon}
            onChange={(next) => {
              setIcon(next);
              setIconPicked(true);
            }}
          />
        </View>
        <TextField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Band-assisted, strict form"
        />
        {previewSlug ? (
          <View style={[styles.preview, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={{ fontSize: 22 }}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{name.trim()}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>slug: {previewSlug}</Text>
            </View>
          </View>
        ) : null}
        {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, paddingBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
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
