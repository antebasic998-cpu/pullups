import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

type Variant = 'primary' | 'default' | 'quiet' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'default',
  disabled,
  loading,
  small,
  big,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  /** Tall full-width call to action ("Save result"). */
  big?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const bg = primary ? colors.accent : variant === 'danger' ? colors.danger : colors.surface2;
  const fg = primary ? colors.accentInk : variant === 'danger' ? '#fff' : colors.text;
  const fontSize = big ? 17 : small ? 13 : 14.5;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.btn,
        small && styles.small,
        big && styles.big,
        {
          backgroundColor: bg,
          borderColor: primary || variant === 'danger' ? bg : colors.border,
          opacity: disabled || loading ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: fg, fontSize }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Square icon button (back, more, upload, edit …). */
export function IconButton({
  label,
  onPress,
  children,
  size = 40,
  style,
}: {
  /** Accessibility label. */
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  size?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      style={[
        styles.iconBtn,
        { width: size, height: size, backgroundColor: colors.surface2, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { paddingHorizontal: 12, height: 36, borderRadius: 12 },
  big: { height: 56, borderRadius: 18, alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontWeight: '800' },
  iconBtn: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
