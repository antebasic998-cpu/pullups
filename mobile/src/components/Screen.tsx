import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';

export const PAGE_PADDING = 18;

/**
 * Scrolling page with the Arena gutters. `tabs` leaves room for the lime "+"
 * that rises above the tab bar; `safe` is for screens that sit above the tabs.
 */
export function Screen({
  children,
  bottom = 'tabs',
  contentStyle,
}: {
  children: React.ReactNode;
  bottom?: 'tabs' | 'safe';
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={[
          {
            paddingTop: insets.top + 6,
            paddingHorizontal: PAGE_PADDING,
            paddingBottom: bottom === 'tabs' ? 64 : insets.bottom + 40,
          },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {/* Content scrolls under the clock – keep the status bar area clean. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.bg }}
      />
    </View>
  );
}
