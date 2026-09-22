import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { db } from '../core/db';
import type { ExerciseCategory } from '../types';

interface ExerciseSelectorProps {
  selected: ExerciseCategory | null;
  onSelect: (category: ExerciseCategory) => void;
  categories?: ExerciseCategory[];
  size?: 'compact' | 'normal';
}

function categoryIcon(slug: string): string {
  if (slug === 'chin-ups') return '🤸';
  if (slug === 'dips') return '⚡';
  if (slug === 'push-ups') return '💥';
  return '💪';
}

export function ExerciseSelector({
  selected,
  onSelect,
  categories,
  size = 'normal',
}: ExerciseSelectorProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const available = categories && categories.length > 0 ? categories : db.categories();
  const activeCategory = selected ?? available[0] ?? db.defaultCategory();

  const isCompact = size === 'compact';

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          isCompact ? styles.triggerCompact : styles.triggerNormal,
          {
            backgroundColor: colors.surface2,
            borderColor: colors.border,
          },
        ]}
        activeOpacity={0.7}
      >
        <Text style={isCompact ? styles.iconCompact : styles.iconNormal}>
          {categoryIcon(activeCategory.slug)}
        </Text>
        <Text
          style={[
            isCompact ? styles.labelCompact : styles.labelNormal,
            { color: colors.text },
          ]}
          numberOfLines={1}
        >
          {activeCategory.name}
        </Text>
        <Text style={[styles.caret, { color: colors.muted }]}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                Select Exercise
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.list}>
              {available.map((cat, idx) => {
                const isSelected = cat.id === activeCategory.id || cat.slug === activeCategory.slug;
                return (
                  <TouchableOpacity
                    key={cat.id || cat.slug}
                    onPress={() => {
                      onSelect(cat);
                      setOpen(false);
                    }}
                    style={[
                      styles.item,
                      idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                      isSelected && { backgroundColor: colors.surface2 },
                    ]}
                  >
                    <Text style={styles.itemIcon}>{categoryIcon(cat.slug)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.itemName,
                          { color: isSelected ? colors.accent : colors.text },
                        ]}
                      >
                        {cat.name}
                      </Text>
                      <Text style={[styles.itemSub, { color: colors.muted }]}>
                        {cat.scoreType === 'bodyweight_normalized'
                          ? `Bodyweight-normalized · ${cat.unit}`
                          : cat.unit}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Text style={[styles.checkmark, { color: colors.accent }]}>✓</Text>
                    ) : null}
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
    borderWidth: 1,
    borderRadius: 12,
  },
  triggerNormal: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  triggerCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  iconNormal: {
    fontSize: 18,
  },
  iconCompact: {
    fontSize: 14,
  },
  labelNormal: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  labelCompact: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  caret: {
    fontSize: 11,
    marginLeft: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  list: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  itemIcon: {
    fontSize: 22,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 17,
    fontWeight: '800',
  },
});
