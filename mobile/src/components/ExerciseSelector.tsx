import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { db } from '../core/db';
import { exerciseEmoji } from '../lib/categoryUtils';
import { CheckIcon, ChevronDownIcon, XIcon } from './Icons';
import type { ExerciseCategory } from '../types';

interface ExerciseSelectorProps {
  selected: ExerciseCategory | null;
  onSelect: (category: ExerciseCategory) => void;
  categories?: ExerciseCategory[];
  size?: 'compact' | 'normal';
}

/** The exercise pill that sits top-right on Board / Awards / Profile, with a picker sheet. */
export function ExerciseSelector({ selected, onSelect, categories, size = 'normal' }: ExerciseSelectorProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const available = categories && categories.length > 0 ? categories : db.categories();
  // `selected` is a snapshot held by the screen; look it up again so renames and new icons show immediately.
  const activeCategory =
    available.find((c) => c.id === selected?.id || c.slug === selected?.slug) ?? selected ?? available[0] ?? db.defaultCategory();
  const compact = size === 'compact';

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Exercise: ${activeCategory.name}`}
        style={[
          styles.trigger,
          compact && styles.triggerCompact,
          { backgroundColor: colors.surface2, borderColor: colors.border },
        ]}
      >
        <Text style={{ fontSize: compact ? 15 : 17 }} allowFontScaling={false}>
          {exerciseEmoji(activeCategory.iconKey, activeCategory.slug)}
        </Text>
        <Text style={[styles.label, compact && { fontSize: 13 }, { color: colors.text }]} numberOfLines={1}>
          {activeCategory.name}
        </Text>
        <ChevronDownIcon size={15} strokeWidth={2.4} color={colors.muted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.sheet, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Exercise</Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                accessibilityLabel="Close"
                style={[styles.closeBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
              >
                <XIcon size={18} strokeWidth={2.2} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {available.map((cat, idx) => {
                const isSelected = cat.id === activeCategory.id || cat.slug === activeCategory.slug;
                return (
                  <TouchableOpacity
                    key={cat.id || cat.slug}
                    onPress={() => {
                      onSelect(cat);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.item,
                      idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                      isSelected && { backgroundColor: colors.surface2 },
                    ]}
                  >
                    <Text style={{ fontSize: 20, width: 26, textAlign: 'center' }} allowFontScaling={false}>
                      {exerciseEmoji(cat.iconKey, cat.slug)}
                    </Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.itemName, { color: isSelected ? colors.accent : colors.text }]}>
                        {cat.name}
                      </Text>
                      <Text style={[styles.itemSub, { color: colors.muted }]}>
                        {cat.scoreType === 'bodyweight_normalized' ? `Bodyweight-normalized · ${cat.unit}` : cat.unit}
                      </Text>
                    </View>
                    {isSelected ? <CheckIcon size={18} strokeWidth={2.6} color={colors.accent} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
    maxWidth: 200,
  },
  triggerCompact: { height: 36, paddingHorizontal: 10, gap: 6, borderRadius: 12 },
  label: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 26,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, paddingLeft: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, gap: 12 },
  itemName: { fontSize: 15, fontWeight: '700' },
  itemSub: { fontSize: 12, marginTop: 2 },
});
