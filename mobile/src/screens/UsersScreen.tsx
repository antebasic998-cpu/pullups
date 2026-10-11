import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { Avatar, EmptyState, PageHeader, Panel, Skeleton } from '../components/Bits';
import { Button } from '../components/Button';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { PlusIcon, SearchIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import { UserFormModal } from '../components/UserFormModal';
import { useAsync } from '../lib/hooks';
import { daysAgo, formatKg, pluralize, reps } from '../lib/format';
import { useLogSheet } from '../lib/LogSheet';
import { useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import type { ExerciseCategory } from '../types';
import type { RootStackParamList } from '../navigation/types';

/**
 * The roster: who is on the board and their normalized PB, with one action per
 * row (log a result). Editing, importing and removing live on the profile.
 */
export function UsersScreen() {
  const version = useDataVersion();
  const { colors } = useTheme();
  const log = useLogSheet();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const { data, loading, error } = useAsync(() => api.users(selectedCategory?.slug), [selectedCategory?.slug, version]);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const users = useMemo(() => {
    const list = (data?.users ?? []).filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase()));
    return [...list].sort((a, b) => b.pbNormalized - a.pbNormalized || a.name.localeCompare(b.name));
  }, [data, query]);

  return (
    <Screen>
      <PageHeader
        eyebrow="Personal bests"
        title="Athletes"
        right={<ExerciseSelector selected={selectedCategory} onSelect={setSelectedCategory} />}
      />
      <Text style={[styles.blurb, { color: colors.muted }]}>
        {loading && !data
          ? 'Updating athlete roster...'
          : data && data.userCount > 0
            ? `${pluralize(data.userCount, 'athlete')} · median ${formatKg(data.medianMassKg)}`
            : data
              ? 'Nobody on the board yet'
              : ''}
      </Text>

      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <SearchIcon size={17} strokeWidth={2} color={colors.faint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Search athletes"
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setAddOpen(true)}
          accessibilityLabel="Add athlete"
          style={[styles.add, { backgroundColor: colors.accent }]}
        >
          <PlusIcon size={22} strokeWidth={2.6} color={colors.accentInk} />
        </TouchableOpacity>
      </View>

      {error ? <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text> : null}

      {loading && !data ? (
        <Panel style={{ padding: 8, marginTop: 14 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={40} />
          ))}
        </Panel>
      ) : users.length === 0 ? (
        <View style={{ marginTop: 14 }}>
          <EmptyState
            title={query ? 'No match' : 'No athletes yet'}
            message={
              query
                ? 'Nothing matches that search.'
                : 'Add someone with their name, age and bodyweight. You can log a personal best right away, or import a history from a spreadsheet.'
            }
            action={
              query ? (
                <Button label="Clear search" onPress={() => setQuery('')} style={{ marginTop: 8 }} />
              ) : (
                <Button label="Add athlete" variant="primary" onPress={() => setAddOpen(true)} style={{ marginTop: 8 }} />
              )
            }
          />
        </View>
      ) : (
        <Panel style={{ marginTop: 14, opacity: loading ? 0.55 : 1 }}>
          {users.map((user, i) => (
            <View key={user.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.rowMain}
                onPress={() => navigation.navigate('UserDetail', { id: user.id, category: selectedCategory?.slug })}
              >
                <Avatar name={user.name} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 1 }} numberOfLines={1}>
                    {[
                      user.age ? `${user.age}y` : null,
                      formatKg(user.weightKg),
                      user.sessionCount > 0
                        ? `${pluralize(user.sessionCount, 'attempt')} · ${daysAgo(user.lastResult?.date)}`
                        : 'no attempts yet',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.score, { color: user.sessionCount > 0 ? colors.text : colors.faint }]}>
                    {user.sessionCount > 0 ? user.pbNormalized.toFixed(2) : '–'}
                    {user.sessionCount > 0 ? <Text style={[styles.unit, { color: colors.muted }]}> pts</Text> : null}
                  </Text>
                  {user.sessionCount > 0 ? (
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>{reps(user.pbAbsolute)}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => log.open({ userId: user.id, category: selectedCategory })}
                accessibilityLabel={`Log a result for ${user.name}`}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                style={[styles.plus, { backgroundColor: colors.surface3, borderColor: colors.border }]}
              >
                <PlusIcon size={18} strokeWidth={2.4} color={colors.accent} />
              </TouchableOpacity>
            </View>
          ))}
        </Panel>
      )}

      <Text style={[styles.foot, { color: colors.faint }]}>
        Open an athlete for their history, chart, and to edit, import or remove them.
      </Text>

      <UserFormModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(u) => navigation.navigate('UserDetail', { id: u.id })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  blurb: { fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderWidth: 1, borderRadius: 14 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  add: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 4, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700' },
  score: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 11, fontWeight: '600' },
  plus: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  foot: { fontSize: 11, lineHeight: 16, marginTop: 18, marginHorizontal: 4 },
});
