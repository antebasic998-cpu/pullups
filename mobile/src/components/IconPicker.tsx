import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EXERCISE_ICONS } from '../lib/categoryUtils';
import { useTheme } from '../lib/ThemeContext';

const COLUMNS = 8;
const GAP = 6;

/** Grid of emoji to choose an exercise icon from. */
export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  // Exact pixel size so eight cells plus the gaps always fill the row.
  const cell = width > 0 ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0;

  return (
    <View style={styles.grid} accessibilityRole="radiogroup" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {cell > 0
        ? EXERCISE_ICONS.map((icon) => {
            const active = value === icon;
            return (
              <TouchableOpacity
                key={icon}
                activeOpacity={0.7}
                onPress={() => onChange(icon)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Icon ${icon}`}
                style={[
                  styles.cell,
                  {
                    width: cell,
                    height: cell,
                    backgroundColor: active ? colors.accentSoft : colors.surface2,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text style={styles.emoji}>{icon}</Text>
              </TouchableOpacity>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, minHeight: 40 },
  cell: { borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 21 },
});
