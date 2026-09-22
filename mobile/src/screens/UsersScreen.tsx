import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { Avatar, EmptyState, Muted, Panel, Skeleton } from '../components/Bits';
import { Button } from '../components/Button';
import { AttemptFormModal } from '../components/AttemptFormModal';
import { UserFormModal } from '../components/UserFormModal';
import { useAsync } from '../lib/hooks';
import { daysAgo, formatKg, pluralize, reps } from '../lib/format';
import { useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import type { UserSummary } from '../types';
import type { RootStackParamList } from '../navigation/types';

export function UsersScreen() {
  const version = useDataVersion();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, loading, error } = useAsync(() => api.users(), [version]);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [logging, setLogging] = useState<UserSummary | null>(null);

  const users = useMemo(() => {
    const list = (data?.users ?? []).filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase()));
    return [...list].sort((a, b) => b.pbNormalized - a.pbNormalized || a.name.localeCompare(b.name));
  }, [data, query]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Athletes</Text>
          <Muted>
            {data && data.userCount > 0
              ? `${pluralize(data.userCount, 'athlete')} · median ${formatKg(data.medianMassKg)}`
              : data
                ? 'Nobody on the board yet'
                : 'Personal bests'}
          </Muted>
        </View>
        <Button label="Add athlete" variant="primary" small onPress={() => setAddOpen(true)} />
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
        <Text style={{ color: colors.faint }}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={colors.faint}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      {loading && !data ? (
        <Panel style={{ padding: 8 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} />
          ))}
        </Panel>
      ) : users.length === 0 ? (
        <EmptyState
          title={query ? 'No match' : 'No athletes yet'}
          message={query ? 'Nothing matches that search.' : 'Add someone with their name, age and bodyweight.'}
          action={
            query ? (
              <Button label="Clear search" onPress={() => setQuery('')} />
            ) : (
              <Button label="Add athlete" variant="primary" onPress={() => setAddOpen(true)} />
            )
          }
        />
      ) : (
        <Panel>
          {users.map((user, i) => (
            <View key={user.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={styles.rowMain}
                onPress={() => navigation.navigate('UserDetail', { id: user.id })}
              >
                <Avatar name={user.name} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
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
                <Text style={[styles.score, { color: colors.text }]}>
                  {user.sessionCount > 0 ? user.pbNormalized.toFixed(2) : '–'}
                </Text>
              </TouchableOpacity>
              <View style={styles.actions}>
                {user.sessionCount > 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{reps(user.pbAbsolute)}</Text>
                ) : null}
                <Button label="Log" small variant="quiet" onPress={() => setLogging(user)} />
              </View>
            </View>
          ))}
        </Panel>
      )}

      <UserFormModal visible={addOpen} onClose={() => setAddOpen(false)} onSaved={(u) => navigation.navigate('UserDetail', { id: u.id })} />
      {logging && data ? (
        <AttemptFormModal visible user={logging} medianMassKg={data.medianMassKg} onClose={() => setLogging(null)} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontWeight: '600', fontSize: 15 },
  score: { fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' },
});
