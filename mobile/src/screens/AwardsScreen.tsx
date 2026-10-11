import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { Avatar, Card, CardHead, EmptyState, PageHeader, Skeleton } from '../components/Bits';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { InfoIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import { useAsync } from '../lib/hooks';
import { formatWeekRange, pluralize } from '../lib/format';
import { useDataVersion } from '../lib/store';
import { useTheme } from '../lib/ThemeContext';
import { tierColor } from '../lib/theme';
import type { Award, ExerciseCategory } from '../types';
import type { RootStackParamList } from '../navigation/types';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

function AwardCard({ award }: { award: Award }) {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const w = award.winner;

  if (!w) {
    return (
      <View style={[styles.aw, { borderColor: colors.borderStrong, borderStyle: 'dashed' }]}>
        <Text style={[styles.awEmoji, { opacity: 0.35 }]}>{award.emoji}</Text>
        <Text style={[styles.awTitle, { color: colors.text }]}>{award.title}</Text>
        <Text style={{ color: colors.faint, fontSize: 11.5, lineHeight: 15, marginTop: 6 }}>{award.how}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.aw, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={styles.awEmoji}>{award.emoji}</Text>
      <Text style={[styles.awTitle, { color: colors.text }]}>{award.title}</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.navigate('UserDetail', { id: w.userId })}
        style={styles.awWinner}
      >
        <Avatar name={w.name} size={30} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>
            {firstName(w.name)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
            {w.detail}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export function AwardsScreen() {
  const version = useDataVersion();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const { data, loading, error } = useAsync(() => api.office(selectedCategory?.slug), [version, selectedCategory?.slug]);
  const exerciseLabel = data?.category?.name ?? selectedCategory?.name ?? 'this exercise';
  const topXp = data?.xpThisWeek[0]?.xp || 1;

  const openProfile = (userId: string) => navigation.navigate('UserDetail', { id: userId });

  return (
    <Screen>
      <PageHeader
        eyebrow={data ? formatWeekRange(data.week.start, data.week.end) : 'This week'}
        title="Awards"
        right={<ExerciseSelector selected={selectedCategory} onSelect={setSelectedCategory} />}
      />
      <Text style={[styles.blurb, { color: colors.muted }]}>
        {data && data.userCount > 0
          ? `${exerciseLabel} · ${data.participants} of ${pluralize(data.userCount, 'athlete')} logged a result · resets Monday`
          : data
            ? 'Add athletes to start handing out prizes'
            : 'Fresh prizes every week'}
      </Text>

      {error ? <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text> : null}

      {loading && !data ? (
        <View style={styles.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={132} style={{ width: '48.5%', borderRadius: 20 }} />
          ))}
        </View>
      ) : data ? (
        <View style={{ opacity: loading ? 0.55 : 1 }}>
          {data.participants === 0 ? (
            <View style={{ marginTop: 16 }}>
              <EmptyState
                title="Nothing to award yet this week"
                message="Once anyone logs a result, the prizes below start filling in. They reset every Monday and are worked out from that week's results only."
              />
            </View>
          ) : null}

          <View style={styles.grid}>
            {data.awards.map((award) => (
              <AwardCard key={award.id} award={award} />
            ))}
          </View>

          {/* XP race */}
          <Card style={styles.card}>
            <CardHead title="XP this week" caption="1 XP per rep + bonuses" />
            {data.xpThisWeek.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13 }}>No XP earned yet this week.</Text>
            ) : (
              data.xpThisWeek.map((row, i) => (
                <TouchableOpacity
                  key={row.userId}
                  activeOpacity={0.7}
                  onPress={() => openProfile(row.userId)}
                  style={[styles.xr, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                >
                  <Avatar name={row.name} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.xrName, { color: colors.text }]} numberOfLines={1}>
                      {firstName(row.name)}
                    </Text>
                    <View style={[styles.tr, { backgroundColor: colors.surface3 }]}>
                      <View style={[styles.trFill, { width: `${Math.round((row.xp / topXp) * 100)}%`, backgroundColor: colors.accent }]} />
                    </View>
                  </View>
                  <Text style={[styles.xrNum, { color: colors.text }]}>{row.xp}</Text>
                </TouchableOpacity>
              ))
            )}
          </Card>

          {/* Levels */}
          <Card style={styles.card}>
            <CardHead title="Levels" caption="XP never changes your score" />
            {data.leaderboard.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13 }}>No athletes yet.</Text>
            ) : (
              data.leaderboard.map((row, i) => (
                <TouchableOpacity
                  key={row.id}
                  activeOpacity={0.7}
                  onPress={() => openProfile(row.id)}
                  style={[styles.xr, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                >
                  <Avatar name={row.name} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1}>
                      <Text style={[styles.xrName, { color: colors.text }]}>{row.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11.5 }}>{`  · ${row.level.title}`}</Text>
                    </Text>
                    <View style={[styles.tr, { backgroundColor: colors.surface3 }]}>
                      <View style={[styles.trFill, { width: `${Math.min(100, row.level.progress)}%`, backgroundColor: colors.gold }]} />
                    </View>
                  </View>
                  <View style={[styles.lv, { backgroundColor: colors.goldSoft }]}>
                    <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '700' }}>L{row.level.level}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </Card>

          {/* Badge wall */}
          <Card style={styles.card}>
            <CardHead title="All badges" caption="Grey ones are still up for grabs" />
            <View style={styles.wall}>
              {data.badges.map((badge) => {
                const held = badge.holders > 0;
                const tint = tierColor(badge.tier, colors);
                return (
                  <View
                    key={badge.id}
                    style={[
                      styles.wallItem,
                      {
                        borderColor: held ? colors.border : colors.borderStrong,
                        borderStyle: held ? 'solid' : 'dashed',
                        backgroundColor: held ? colors.surface2 : 'transparent',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.wallIcon,
                        {
                          borderColor: held ? tint : colors.borderStrong,
                          backgroundColor: held ? colors.surface : 'transparent',
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 15, opacity: held ? 1 : 0.4 }}>{badge.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: held ? colors.text : colors.muted, fontSize: 11.5, fontWeight: '700' }} numberOfLines={1}>
                        {badge.name}
                      </Text>
                      <Text style={{ color: colors.faint, fontSize: 10.5 }} numberOfLines={2}>
                        {badge.holders === 0
                          ? badge.how
                          : badge.names.length <= 3
                            ? badge.names.join(', ')
                            : `${badge.names.slice(0, 2).join(', ')} +${badge.names.length - 2}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* How it works */}
          <Card style={styles.card}>
            <InfoTitle>How XP works</InfoTitle>
            <View style={{ gap: 6, marginTop: 12 }}>
              <Text style={[styles.rule, { color: colors.muted }]}>
                <Num>{data.xpRules.perRep} XP</Num> for every {exerciseLabel.toLowerCase()} rep you complete.
              </Text>
              <Text style={[styles.rule, { color: colors.muted }]}>
                <Num>+{data.xpRules.newAbsolutePb} XP</Num> for a new personal best, <Num>+{data.xpRules.newNormalizedPb} XP</Num> for beating
                your best score.
              </Text>
              <Text style={[styles.rule, { color: colors.muted }]}>
                <Num>+{data.xpRules.enterTop3} XP</Num> for ending a day on the podium, <Num>+{data.xpRules.reachNumberOne} XP</Num> for ending a
                day at number one.
              </Text>
            </View>
            <View style={styles.levelList}>
              {data.levels.map((l) => (
                <Text key={l.level} style={{ color: colors.faint, fontSize: 12 }}>
                  {l.level} {l.title}
                </Text>
              ))}
            </View>
          </Card>

          <Text style={[styles.foot, { color: colors.faint }]}>
            Prizes are recalculated from the week's results every time you open this page — no voting, no arguments. Badges
            unlock once and stay on your profile. Streaks survive until a full week passes without a result.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

function InfoTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <InfoIcon size={15} color={colors.muted} />
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{children}</Text>;
}

const styles = StyleSheet.create({
  blurb: { fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: 16 },
  aw: { width: '48.5%', minHeight: 132, padding: 14, borderRadius: 20, borderWidth: 1 },
  awEmoji: { fontSize: 28, lineHeight: 34 },
  awTitle: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  awWinner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 12 },
  card: { marginTop: 14 },
  xr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  xrName: { fontSize: 14, fontWeight: '700' },
  tr: { height: 6, borderRadius: 9, marginTop: 6, overflow: 'hidden' },
  trFill: { height: '100%', borderRadius: 9 },
  xrNum: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lv: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  wall: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  wallItem: { width: '48.5%', flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 14, padding: 8, alignItems: 'center' },
  wallIcon: { width: 30, height: 30, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rule: { fontSize: 13, lineHeight: 19 },
  levelList: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 14 },
  foot: { fontSize: 11, lineHeight: 16, marginTop: 18, marginHorizontal: 4 },
});
