import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';

interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Cari channel…' }: SearchBarProps) {
  const { isTV } = useResponsive();

  return (
    <View style={[styles.container, isTV && styles.containerTV]}>
      <Ionicons name="search" size={isTV ? 26 : 20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[styles.input, { fontSize: isTV ? fontSize.md : fontSize.sm }]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bersihkan pencarian"
          onPress={() => onChangeText('')}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={isTV ? 24 : 18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  containerTV: {
    minHeight: 64,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
});
