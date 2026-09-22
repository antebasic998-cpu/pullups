import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { Avatar, Card, EmptyState, Muted, Panel, SectionTitle, Skeleton } from '../components/Bits';
import { useAsync } from '../lib/hooks';
import { formatDate, pluralize } from '../lib/format';
import { useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import { tierColor } from '../lib/theme';
import type { Award } from '../types';
import type { RootStackParamList } from '../navigation/types';

function AwardCard({ award }: { award: Award }) {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const won = Boolean(award.winner);
  return (
    <View
      style={[
        styles.award,
        {
          borderColor: colors.border,
          borderStyle: won ? 'solid' : 'dashed',
          backgroundColor: won ? colors.surface2 : 'transparent',
        },
      ]}
    >
      <View style={styles.awardHead}>
        <Text style={{ fontSize: 18, opacity: won ? 1 : 0.4 }}>{award.emoji}</Text>
        <Text style={[styles.awardTitle, { color: colors.text }]}>{award.title}</Text>
      </View>
      {award.winner ? (
        <TouchableOpacity onPress={() => navigation.navigate('UserDetail', { id: award.winner!.userId })}>
          <View style={styles.awardWinner}>
            <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
              {award.winner.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{award.winner.detail}</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <Text style={{ color: colors.faint, fontSize: 11 }}>{award.how}</Text>
      )}
    </View>
  );
}

export function AwardsScreen() {
  const version = useDataVersion();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, loading, error } = useAsync(() => api.office(), [version]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Office awards</Text>
      <Muted>
        {data && data.userCount > 0 ? (
          <>
            Week of {formatDate(data.week.start)} to {formatDate(data.week.end)} · {data.participants} of{' '}
            {pluralize(data.userCount, 'athlete')} logged a result
          </>
        ) : data ? (
          'Add athletes to start handing out prizes'
        ) : (
          'Fresh prizes every week'
        )}
      </Muted>

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      {loading && !data ? (
        <View style={styles.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={96} />
          ))}
        </View>
      ) : data ? (
        <>
          {data.participants === 0 ? (
            <EmptyState
              title="Nothing to award yet this week"
              message="Once anyone logs a result, the prizes below start filling in. They reset every Monday."
            />
          ) : null}

          <View style={styles.grid}>
            {data.awards.map((award) => (
              <AwardCard key={award.id} award={award} />
            ))}
          </View>

          <Panel style={{ marginTop: 8 }}>
            <View style={styles.sectionHead}>
              <SectionTitle>XP this week</SectionTitle>
              <Text style={{ color: colors.faint, fontSize: 11 }}>1 XP per rep + bonuses</Text>
            </View>
            {data.xpThisWeek.length === 0 ? (
              <Text style={[styles.emptyRow, { color: colors.muted, borderTopColor: colors.border }]}>No XP earned yet this week.</Text>
            ) : (
              data.xpThisWeek.map((row, i) => {
                const top = data.xpThisWeek[0].xp || 1;
                return (
                  <TouchableOpacity
                    key={row.userId}
                    onPress={() => navigation.navigate('UserDetail', { id: row.userId })}
                    style={[styles.xpRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                  >
                    <Avatar name={row.name} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <View style={[styles.bar, { backgroundColor: colors.surface3 }]}>
                        <View style={[styles.barFill, { width: `${Math.round((row.xp / top) * 100)}%`, backgroundColor: colors.accent }]} />
                      </View>
                    </View>
                    <Text style={{ color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{row.xp}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </Panel>

          <Panel style={{ marginTop: 12 }}>
            <View style={styles.sectionHead}>
              <SectionTitle>Levels</SectionTitle>
              <Text style={{ color: colors.faint, fontSize: 11 }}>XP never changes your score</Text>
            </View>
            {data.leaderboard.map((row, i) => (
              <TouchableOpacity
                key={row.id}
                onPress={() => navigation.navigate('UserDetail', { id: row.id })}
                style={[styles.levelRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <Avatar name={row.name} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{row.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Level {row.level.level} · {row.level.title}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {row.xp} XP · {row.level.isMax ? 'maxed' : `${row.level.xpToNext} to next`}
                </Text>
              </TouchableOpacity>
            ))}
          </Panel>

          <Panel style={{ marginTop: 12 }}>
            <View style={styles.sectionHead}>
              <SectionTitle>All badges</SectionTitle>
              <Text style={{ color: colors.faint, fontSize: 11 }}>Grey ones are still up for grabs</Text>
            </View>
            <View style={[styles.badgeGrid, { borderTopColor: colors.border }]}>
              {data.badges.map((badge) => (
                <View
                  key={badge.id}
                  style={[
                    styles.badgeItem,
                    {
                      borderColor: colors.border,
                      borderStyle: badge.holders > 0 ? 'solid' : 'dashed',
                      backgroundColor: badge.holders > 0 ? colors.surface2 : 'transparent',
                      opacity: badge.holders > 0 ? 1 : 0.6,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badgeIcon,
                      {
                        borderColor: badge.holders > 0 ? tierColor(badge.tier, colors) : colors.border,
                        backgroundColor: badge.holders > 0 ? colors.surface : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ opacity: badge.holders > 0 ? 1 : 0.4 }}>{badge.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                      {badge.name}
                    </Text>
                    <Text style={{ color: colors.faint, fontSize: 10 }} numberOfLines={1}>
                      {badge.holders === 0
                        ? badge.how
                        : badge.names.length <= 2
                          ? badge.names.join(', ')
                          : `${badge.names.slice(0, 2).join(', ')} +${badge.names.length - 2}`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Panel>

          <Card style={{ marginTop: 12 }}>
            <SectionTitle>How XP works</SectionTitle>
            <Text style={[styles.rule, { color: colors.muted }]}>
              {data.xpRules.perRep} XP for every pull-up, +{data.xpRules.newAbsolutePb} for a new PB, +{data.xpRules.newNormalizedPb} for beating your best score.
            </Text>
            <View style={styles.levelList}>
              {data.levels.map((l) => (
                <Text key={l.level} style={{ color: colors.faint, fontSize: 11 }}>
                  {l.level} {l.title}
                </Text>
              ))}
            </View>
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  title: { fontSize: 22, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  award: { width: '48%', borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  awardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  awardTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  awardWinner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  emptyRow: { padding: 14, borderTopWidth: 1, fontSize: 13 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  bar: { height: 4, borderRadius: 999, marginTop: 4, overflow: 'hidden', width: 96 },
  barFill: { height: '100%', borderRadius: 999 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderTopWidth: 1 },
  badgeItem: { width: '48%', flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 10, padding: 8 },
  badgeIcon: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rule: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  levelList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
});
