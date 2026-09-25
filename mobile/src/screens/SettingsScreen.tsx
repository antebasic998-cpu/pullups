import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '../api';
import { Card, Muted, Panel, SectionTitle } from '../components/Bits';
import { Button } from '../components/Button';
import { ExerciseFormModal } from '../components/ExerciseFormModal';
import { exerciseEmoji } from '../lib/categoryUtils';
import { useSettings } from '../lib/SettingsContext';
import { useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import type { ExerciseCategory } from '../types';

export function SettingsScreen() {
  const { colors } = useTheme();
  const { celebrationsEnabled, setCelebrationsEnabled } = useSettings();
  const version = useDataVersion();
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);

  useEffect(() => {
    void api.categories().then(setCategories);
  }, [version]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      <Muted>Personal preferences and board configuration.</Muted>

      <Card style={styles.card}>
        <SectionTitle>Exercises</SectionTitle>
        <Muted style={{ marginBottom: 8 }}>
          Add new exercise types for the whole office. They appear in the leaderboard and log form for everyone.
        </Muted>
        <Panel style={{ paddingVertical: 4 }}>
          {categories.map((cat, i) => (
            <View
              key={cat.id}
              style={[
                styles.exerciseRow,
                i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            >
              <Text style={styles.exerciseIcon}>{exerciseEmoji(cat.iconKey, cat.slug)}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
                  {cat.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                  {cat.slug} · bodyweight-normalized reps
                </Text>
              </View>
            </View>
          ))}
        </Panel>
        <Button label="Add exercise" variant="primary" small onPress={() => setAddExerciseOpen(true)} />
      </Card>

      <Card style={styles.card}>
        <SectionTitle>Gamification</SectionTitle>
        <View style={[styles.row, { borderTopColor: colors.border }]}>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.text }]}>XP & achievement animations</Text>
            <Text style={[styles.hint, { color: colors.muted }]}>
              Show the full-screen celebration when you log a result, earn XP, level up, or unlock a badge.
            </Text>
          </View>
          <Switch
            value={celebrationsEnabled}
            onValueChange={setCelebrationsEnabled}
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

      <ExerciseFormModal visible={addExerciseOpen} onClose={() => setAddExerciseOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { padding: 14, gap: 10, marginTop: 4 },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exerciseIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  exerciseName: { fontWeight: '600', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  copy: { flex: 1, gap: 4 },
  label: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17 },
  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 2 },
});
