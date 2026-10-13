import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';

interface CategoryFilterProps {
  /** Kategori, sebaiknya sudah diurutkan dari yang terbanyak. */
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  /** Label untuk tombol "semua kategori". */
  allLabel?: string;
  /** Jumlah kategori yang tampil sebelum diringkas. */
  maxVisible?: number;
}

export function CategoryFilter({
  categories,
  selected,
  onSelect,
  allLabel = 'Semua',
  maxVisible = 8,
}: CategoryFilterProps) {
  const { isTV } = useResponsive();
  const [expanded, setExpanded] = useState(false);

  if (categories.length === 0) return null;

  const limited = expanded ? categories : categories.slice(0, maxVisible);
  const visible =
    selected && !limited.includes(selected) ? [selected, ...limited] : limited;
  const hiddenCount = categories.length - limited.length;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <Chip
        label={allLabel}
        active={selected === null}
        isTV={isTV}
        onPress={() => onSelect(null)}
      />
      {visible.map((category) => (
        <Chip
          key={category}
          label={category}
          active={selected === category}
          isTV={isTV}
          onPress={() => onSelect(category)}
        />
      ))}
      {hiddenCount > 0 ? (
        <Chip
          label={expanded ? 'Ringkas' : `+${hiddenCount} lagi`}
          active={false}
          isTV={isTV}
          onPress={() => setExpanded((value) => !value)}
        />
      ) : null}
    </ScrollView>
  );
}

interface ChipProps {
  label: string;
  active: boolean;
  isTV: boolean;
  onPress: () => void;
}

function Chip({ label, active, isTV, onPress }: ChipProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      focusable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.chip,
        isTV && styles.chipTV,
        active && styles.chipActive,
        focused && !active && styles.chipFocused,
      ]}
    >
      <Text
        style={[
          styles.label,
          { fontSize: isTV ? fontSize.md : fontSize.sm },
          active && styles.labelActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipTV: {
    minHeight: 56,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipFocused: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderFocus,
  },
  label: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.primary,
  },
});
