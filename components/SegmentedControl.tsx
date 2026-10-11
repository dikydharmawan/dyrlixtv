import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';

export interface SegmentedOption<T extends string> {
  key: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { isTV } = useResponsive();

  return (
    <View style={styles.container}>
      {options.map((option) => (
        <Segment<T>
          key={option.key}
          option={option}
          active={option.key === value}
          isTV={isTV}
          onPress={() => onChange(option.key)}
        />
      ))}
    </View>
  );
}

interface SegmentProps<T extends string> {
  option: SegmentedOption<T>;
  active: boolean;
  isTV: boolean;
  onPress: () => void;
}

function Segment<T extends string>({ option, active, isTV, onPress }: SegmentProps<T>) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      focusable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={option.label}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.segment,
        isTV && styles.segmentTV,
        active && styles.segmentActive,
        focused && !active && styles.segmentFocused,
      ]}
    >
      <Text
        style={[
          styles.label,
          { fontSize: isTV ? fontSize.md : fontSize.sm },
          active && styles.labelActive,
        ]}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  segmentTV: {
    minHeight: 60,
  },
  segmentActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  segmentFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.surfaceAlt,
  },
  label: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.primary,
  },
});