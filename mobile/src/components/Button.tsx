import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

type Variant = 'primary' | 'default' | 'quiet' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'default',
  disabled,
  loading,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'quiet'
          ? colors.surface2
          : colors.surface2;
  const fg =
    variant === 'primary' ? colors.accentInk : variant === 'danger' ? '#fff' : colors.text;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        small && styles.small,
        { backgroundColor: bg, borderColor: colors.border, opacity: disabled || loading ? 0.6 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg, fontSize: small ? 13 : 14 }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function IconButton({
  label,
  onPress,
  color,
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.iconBtn, { borderColor: colors.border }]}
    >
      <Text style={{ fontSize: 16, color: color ?? colors.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { paddingHorizontal: 10, paddingVertical: 6 },
  label: { fontWeight: '600' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
