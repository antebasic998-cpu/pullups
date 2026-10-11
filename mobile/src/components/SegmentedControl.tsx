import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

interface Option<T extends string> {
  id: T;
  label: string;
}

/**
 * `chips`: pill filters in one scrolling row (the board modes).
 * `seg`: equal-width tab control inside a tray (series tabs, exercise switch); scrolls when it overflows.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = 'seg',
  bleed = 18,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  variant?: 'chips' | 'seg';
  /** Horizontal page padding the chips row should bleed through, so it scrolls edge to edge. */
  bleed?: number;
}) {
  const { colors } = useTheme();

  if (variant === 'chips') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -bleed, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: bleed, gap: 8 }}
      >
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => onChange(opt.id)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.accent : colors.surface2,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: active ? colors.accentInk : colors.muted }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.tray, { backgroundColor: colors.surface2 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segRow}
      >
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => onChange(opt.id)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.segItem, { backgroundColor: active ? colors.surface3 : 'transparent' }]}
            >
              <Text
                numberOfLines={1}
                style={[styles.segLabel, { color: active ? colors.text : colors.muted }]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: 36, paddingHorizontal: 15, borderRadius: 99, borderWidth: 1, justifyContent: 'center' },
  chipLabel: { fontSize: 13.5, fontWeight: '600' },
  tray: { padding: 3, borderRadius: 12 },
  segRow: { flexGrow: 1 },
  segItem: { flexGrow: 1, height: 30, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segLabel: { fontSize: 12.5, fontWeight: '600' },
});
