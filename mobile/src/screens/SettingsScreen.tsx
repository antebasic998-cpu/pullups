import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '../api';
import { Card, PageHeader } from '../components/Bits';
import { Button, IconButton } from '../components/Button';
import { ExerciseFormModal } from '../components/ExerciseFormModal';
import { MoonIcon, PencilIcon, SunIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import { exerciseEmoji } from '../lib/categoryUtils';
import { useSettings } from '../lib/SettingsContext';
import { useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import type { ExerciseCategory } from '../types';

export function SettingsScreen() {
  const { colors, mode, toggle } = useTheme();
  const { celebrationsEnabled, setCelebrationsEnabled } = useSettings();
  const version = useDataVersion();
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseCategory | null>(null);

  useEffect(() => {
    void api.categories().then(setCategories);
  }, [version]);

  const light = mode === 'light';
  const ThemeIcon = light ? SunIcon : MoonIcon;

  return (
    <Screen>
      <PageHeader eyebrow="Preferences" title="Settings" />
      <Text style={[styles.blurb, { color: colors.muted }]}>
        Personal preferences and board configuration shared with everyone.
      </Text>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Appearance</Text>
        <View style={styles.row}>
          <View style={styles.copy}>
            <View style={styles.labelRow}>
              <ThemeIcon size={16} strokeWidth={2} color={colors.muted} />
              <Text style={[styles.label, { color: colors.text }]}>Light theme</Text>
            </View>
            <Text style={[styles.hint, { color: colors.muted }]}>
              Switch between the dark Arena look and a light one.
            </Text>
          </View>
          <Switch
            value={light}
            onValueChange={toggle}
            accessibilityLabel="Light theme"
            trackColor={{ false: colors.surface3, true: colors.accent }}
            thumbColor={light ? colors.accentInk : colors.muted}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Exercises</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Add exercise types for the whole office, or tap the pencil to rename one or change its icon. Changes show up for everyone.
        </Text>
        <View style={[styles.list, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          {categories.map((cat, i) => (
            <View
              key={cat.id}
              style={[styles.exerciseRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <Text style={styles.exerciseIcon}>{exerciseEmoji(cat.iconKey, cat.slug)}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
                  {cat.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 1 }} numberOfLines={1}>
                  {cat.slug} · bodyweight-normalized reps
                </Text>
              </View>
              <IconButton label={`Edit ${cat.name}`} onPress={() => setEditingExercise(cat)} size={36}>
                <PencilIcon size={16} strokeWidth={2} color={colors.muted} />
              </IconButton>
            </View>
          ))}
        </View>
        <Button label="Add exercise" variant="primary" onPress={() => setAddExerciseOpen(true)} style={{ alignSelf: 'flex-start' }} />
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Gamification</Text>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.text }]}>XP & achievement animations</Text>
            <Text style={[styles.hint, { color: colors.muted }]}>
              Show the full-screen celebration when you log a result, earn XP, level up, or unlock a badge.
            </Text>
          </View>
          <Switch
            value={celebrationsEnabled}
            onValueChange={setCelebrationsEnabled}
            accessibilityLabel="XP and achievement animations"
            trackColor={{ false: colors.surface3, true: colors.accent }}
            thumbColor={celebrationsEnabled ? colors.accentInk : colors.muted}
          />
        </View>
      </Card>

      {!celebrationsEnabled ? (
        <Text style={[styles.note, { color: colors.faint }]}>
          Celebrations are off — you'll get a short toast after logging instead.
        </Text>
      ) : null}

      <Text style={[styles.note, { color: colors.faint, marginTop: 18 }]}>
        score = reps × (bodyweight ÷ office median) ^ 0.67
      </Text>

      <ExerciseFormModal visible={addExerciseOpen} onClose={() => setAddExerciseOpen(false)} />
      <ExerciseFormModal
        visible={editingExercise !== null}
        category={editingExercise}
        onClose={() => setEditingExercise(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  blurb: { fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  card: { marginTop: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  copy: { flex: 1, gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12.5, lineHeight: 18 },
  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  exerciseIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  exerciseName: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
});
