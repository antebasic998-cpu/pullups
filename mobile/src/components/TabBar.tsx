import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLogSheet } from '../lib/LogSheet';
import { useTheme } from '../lib/ThemeContext';
import { AwardIcon, PlusIcon, SlidersIcon, TrophyIcon, UsersIcon, type IconProps } from './Icons';

const TABS: Record<string, { label: string; Icon: (p: IconProps) => React.JSX.Element }> = {
  Leaderboard: { label: 'Board', Icon: TrophyIcon },
  Awards: { label: 'Awards', Icon: AwardIcon },
  Athletes: { label: 'Athletes', Icon: UsersIcon },
  Settings: { label: 'Settings', Icon: SlidersIcon },
};

/**
 * Arena bottom bar: Board · Awards · [ + ] · Athletes · Settings.
 * The lime "+" in the middle opens the Log sheet from anywhere.
 */
export function ArenaTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const log = useLogSheet();

  const renderTab = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;
    const meta = TABS[route.name];
    if (!meta) return null;
    const focused = state.index === index;
    const tint = focused ? colors.accent : colors.faint;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
    };
    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.item}
      >
        <meta.Icon size={23} strokeWidth={focused ? 2.2 : 1.8} color={tint} />
        <Text style={[styles.label, { color: tint }]}>{meta.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.navBg,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {renderTab(0)}
      {renderTab(1)}

      <View style={styles.fabSlot}>
        <View style={[styles.fabRing, { backgroundColor: colors.fabRing }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Log result"
            activeOpacity={0.85}
            onPress={() => log.open()}
            style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
          >
            <PlusIcon size={28} strokeWidth={2.6} color={colors.accentInk} />
          </TouchableOpacity>
        </View>
      </View>

      {renderTab(2)}
      {renderTab(3)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 9,
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    // let the FAB rise above the bar
    overflow: 'visible',
  },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingTop: 2, paddingBottom: 2 },
  label: { fontSize: 10.5, fontWeight: '600' },
  fabSlot: { flex: 1, alignItems: 'center', height: 44 },
  fabRing: {
    position: 'absolute',
    top: -46,
    width: 74,
    height: 74,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
});
