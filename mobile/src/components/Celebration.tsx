import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { tierColor } from '../lib/theme';
import type { CelebrationData } from '../types';

interface CelebrationContextValue {
  celebrate: (data: CelebrationData) => void;
  dismiss: () => void;
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

export function useCelebration() {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebration must be used within CelebrationProvider');
  return ctx;
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CelebrationData | null>(null);
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => setData(null), 300);
  }, []);

  const celebrate = useCallback((celebrationData: CelebrationData) => {
    setData(celebrationData);
    setVisible(true);
  }, []);

  return (
    <CelebrationContext.Provider value={{ celebrate, dismiss }}>
      {children}
      {data && <CelebrationModal visible={visible} data={data} onDismiss={dismiss} />}
    </CelebrationContext.Provider>
  );
}

function CelebrationModal({
  visible,
  data,
  onDismiss,
}: {
  visible: boolean;
  data: CelebrationData;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();

  // Animations
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.75)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(Math.max(0, Math.min(1, (data.oldProgress || 0) / 100)))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Real-time ticking counter for XP
  const [displayXp, setDisplayXp] = useState(0);
  const xpAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0.85, duration: 200, useNativeDriver: true }),
      ]).start();
      return;
    }

    // Reset values
    backdropOpacity.setValue(0);
    cardScale.setValue(0.75);
    cardOpacity.setValue(0);
    setDisplayXp(0);
    xpAnim.setValue(0);

    const initialProgress = Math.max(0, Math.min(1, (data.oldProgress || 0) / 100));
    progressAnim.setValue(initialProgress);

    // 1. Entrance animation
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. XP number tick-up listener
    const targetXp = data.xpGained;
    const listenerId = xpAnim.addListener(({ value }) => {
      setDisplayXp(Math.round(value * targetXp));
    });

    Animated.timing(xpAnim, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // 3. Progress bar animation
    const targetProgress = Math.max(0, Math.min(1, (data.newProgress || 0) / 100));
    if (data.leveledUp) {
      // First fill to 100%
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        // Pulse celebration
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 180, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]),
        // Reset to 0 and fill to new progress
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 80,
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: targetProgress,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.timing(progressAnim, {
        toValue: targetProgress,
        duration: 750,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    }

    // 4. Auto-dismiss timer (3.5s for level up or badges, 2.8s for regular XP gain)
    const timeoutDuration = data.leveledUp || data.newBadges.length > 0 ? 3800 : 2800;
    const timer = setTimeout(() => {
      onDismiss();
    }, timeoutDuration);

    return () => {
      clearTimeout(timer);
      xpAnim.removeListener(listenerId);
    };
  }, [visible, data]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onDismiss}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: data.leveledUp ? colors.gold : colors.border,
              transform: [{ scale: cardScale }],
              opacity: cardOpacity,
            },
          ]}
        >
              {/* Top Banner & Icon */}
              <View style={styles.header}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: data.leveledUp
                          ? 'rgba(226, 192, 105, 0.18)'
                          : 'rgba(201, 247, 80, 0.15)',
                        borderColor: data.leveledUp ? colors.gold : colors.accent,
                      },
                    ]}
                  >
                    <Text style={styles.heroEmoji}>
                      {data.leveledUp
                        ? '👑'
                        : data.newBadges.length > 0
                          ? data.newBadges[0].emoji
                          : '⚡'}
                    </Text>
                  </View>
                </Animated.View>

                {data.leveledUp ? (
                  <View style={[styles.pill, { backgroundColor: colors.gold }]}>
                    <Text style={[styles.pillText, { color: '#0f1305' }]}>LEVEL UP!</Text>
                  </View>
                ) : data.newBadges.length > 0 ? (
                  <View style={[styles.pill, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.pillText, { color: colors.accentInk }]}>
                      ACHIEVEMENT UNLOCKED!
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.pill, { backgroundColor: colors.surface2 }]}>
                    <Text style={[styles.pillText, { color: colors.accent }]}>
                      RESULT RECORDED
                    </Text>
                  </View>
                )}

                <Text style={[styles.title, { color: colors.text }]}>
                  {data.leveledUp
                    ? `Level ${data.newLevel?.level ?? ''} · ${data.newLevel?.title ?? ''}`
                    : `+${displayXp} XP`}
                </Text>

                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  {data.leveledUp
                    ? `Promoted from ${data.oldLevel?.title ?? 'previous level'}!`
                    : `${data.reps} ${data.categoryName} logged for ${data.userName}`}
                </Text>
              </View>

              {/* XP Gain Highlight if leveled up */}
              {data.leveledUp && (
                <View style={[styles.xpGainBanner, { backgroundColor: colors.surface2 }]}>
                  <Text style={[styles.xpGainText, { color: colors.accent }]}>
                    +{displayXp} XP Earned
                  </Text>
                </View>
              )}

              {/* Level Progress Bar */}
              <View style={[styles.progressCard, { backgroundColor: colors.surface2 }]}>
                <View style={styles.progressRow}>
                  <Text style={[styles.levelLabel, { color: colors.text }]}>
                    Level {data.newLevel?.level ?? 1} · {data.newLevel?.title}
                  </Text>
                  <Text style={[styles.xpTotal, { color: colors.muted }]}>
                    {data.newLevel?.isMax
                      ? `${data.newXp} XP (Max)`
                      : `${data.newLevel?.xpIntoLevel ?? 0} / ${data.newLevel?.xpForLevel ?? 0} XP`}
                  </Text>
                </View>

                <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
                  <Animated.View
                    style={[
                      styles.fill,
                      {
                        width: progressWidth,
                        backgroundColor: data.leveledUp ? colors.gold : colors.accent,
                      },
                    ]}
                  />
                </View>

                <View style={styles.progressSubRow}>
                  <Text style={[styles.xpToNext, { color: colors.faint }]}>
                    {data.newLevel?.isMax
                      ? 'Office Legend · Top rank'
                      : `${data.newLevel?.xpToNext ?? 0} XP to ${data.newLevel?.nextTitle}`}
                  </Text>
                  <Text style={[styles.percentText, { color: colors.muted }]}>
                    {Math.round(data.newProgress)}%
                  </Text>
                </View>
              </View>

              {/* Newly Unlocked Badges */}
              {data.newBadges.length > 0 && (
                <View style={styles.badgesSection}>
                  <Text style={[styles.sectionTitle, { color: colors.muted }]}>
                    {data.newBadges.length === 1 ? 'NEW BADGE' : 'NEW BADGES'}
                  </Text>
                  {data.newBadges.map((badge) => {
                    const color = tierColor(badge.tier, colors);
                    return (
                      <View
                        key={badge.id}
                        style={[
                          styles.badgeRow,
                          {
                            backgroundColor: colors.surface2,
                            borderColor: color,
                          },
                        ]}
                      >
                        <View style={[styles.badgeIconBox, { backgroundColor: colors.surface, borderColor: color }]}>
                          <Text style={{ fontSize: 18 }}>{badge.emoji}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.badgeTitle, { color: colors.text }]}>
                              {badge.name}
                            </Text>
                            <View style={[styles.tierTag, { backgroundColor: color }]}>
                              <Text style={styles.tierTagText}>{badge.tier.toUpperCase()}</Text>
                            </View>
                          </View>
                          <Text style={[styles.badgeHow, { color: colors.faint }]} numberOfLines={2}>
                            {badge.how}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Bottom dismiss button */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.button,
                  {
                    backgroundColor: data.leveledUp ? colors.gold : colors.accent,
                  },
                ]}
                onPress={onDismiss}
              >
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color: data.leveledUp ? '#0f1305' : colors.accentInk,
                    },
                  ]}
                >
                  {data.leveledUp ? 'Awesome! 🏆' : 'Nice! 🔥'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7} onPress={onDismiss}>
                <Text style={[styles.skipHint, { color: colors.faint }]}>
                  Tap anywhere to skip
                </Text>
              </TouchableOpacity>
            </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroEmoji: {
    fontSize: 32,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  xpGainBanner: {
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  xpGainText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  progressCard: {
    width: '100%',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  xpTotal: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  progressSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpToNext: {
    fontSize: 11,
  },
  percentText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  badgesSection: {
    width: '100%',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  tierTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  tierTagText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  badgeHow: {
    fontSize: 11,
    marginTop: 2,
  },
  button: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  skipHint: {
    fontSize: 11,
    marginTop: 10,
    textAlign: 'center',
  },
});
