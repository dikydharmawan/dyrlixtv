import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';

interface CategoryRailProps {
  /** Kategori, sebaiknya sudah diurutkan dari yang terbanyak. */
  categories: string[];
  counts: Record<string, number>;
  total: number;
  selected: string | null;
  onSelect: (category: string | null) => void;
  /** Label untuk entri "semua kategori". */
  allLabel?: string;
  /** Jumlah kategori yang tampil sebelum diringkas. */
  maxVisible?: number;
}

/**
 * Daftar kategori vertikal di sisi kiri channel list — pola khas OTT Navigator.
 * Dipakai pada layar lebar (TV/tablet/landscape). Daftar diringkas agar tidak
 * terlalu panjang; sisanya bisa dibuka lewat "Lihat semua".
 */
export function CategoryRail({
  categories,
  counts,
  total,
  selected,
  onSelect,
  allLabel = 'Semua Channel',
  maxVisible = 8,
}: CategoryRailProps) {
  const { isTV } = useResponsive();
  const [expanded, setExpanded] = useState(false);

  const limited = expanded ? categories : categories.slice(0, maxVisible);
  const visible =
    selected && !limited.includes(selected) ? [selected, ...limited] : limited;
  const hiddenCount = categories.length - limited.length;

  return (
    <View style={[styles.container, isTV && styles.containerTV]}>
      <Text style={styles.heading}>Kategori</Text>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        <RailItem
          label={allLabel}
          count={total}
          icon="apps-outline"
          active={selected === null}
          isTV={isTV}
          onPress={() => onSelect(null)}
        />
        {visible.map((category) => (
          <RailItem
            key={category}
            label={category}
            count={counts[category] ?? 0}
            icon="pricetag-outline"
            active={selected === category}
            isTV={isTV}
            onPress={() => onSelect(category)}
          />
        ))}
        {hiddenCount > 0 ? (
          <Pressable
            focusable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Ringkas kategori' : 'Lihat semua kategori'}
            onPress={() => setExpanded((value) => !value)}
            style={[styles.toggle, isTV && styles.toggleTV]}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={isTV ? 22 : 18}
              color={colors.primary}
            />
            <Text style={styles.toggleText}>
              {expanded ? 'Ringkas' : `Lihat semua (+${hiddenCount})`}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

interface RailItemProps {
  label: string;
  count: number;
  icon: 'apps-outline' | 'pricetag-outline';
  active: boolean;
  isTV: boolean;
  onPress: () => void;
}

function RailItem({ label, count, icon, active, isTV, onPress }: RailItemProps) {
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
        styles.item,
        isTV && styles.itemTV,
        active && styles.itemActive,
        focused && !active && styles.itemFocused,
      ]}
    >
      <Ionicons
        name={icon}
        size={isTV ? 22 : 18}
        color={active ? colors.primary : colors.textMuted}
      />
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.count, active && styles.countActive]}>{count}</Text>
    </Pressable>
  );
}

const RAIL_WIDTH = 260;

const styles = StyleSheet.create({
  container: {
    width: RAIL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  containerTV: {
    paddingVertical: spacing.xl,
  },
  scroll: {
    flex: 1,
  },
  heading: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.sm,
  },
  list: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemTV: {
    minHeight: 56,
  },
  itemActive: {
    backgroundColor: colors.primarySoft,
  },
  itemFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.surfaceAlt,
  },
  label: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.primary,
  },
  count: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  countActive: {
    color: colors.primary,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    borderStyle: 'dashed',
  },
  toggleTV: {
    minHeight: 52,
  },
  toggleText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
});
