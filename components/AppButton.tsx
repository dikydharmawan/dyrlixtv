import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import type { TVFocusProps } from '@/components/Tv';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IoniconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Properti fokus TV (hasTVPreferredFocus / nextFocus*). Aman di HP & web. */
  tvFocus?: TVFocusProps;
}

const VARIANT_STYLES: Record<
  ButtonVariant,
  { background: string; border: string; text: string }
> = {
  primary: { background: colors.primary, border: colors.primary, text: colors.background },
  secondary: { background: colors.surfaceAlt, border: colors.border, text: colors.text },
  danger: { background: colors.danger, border: colors.danger, text: colors.white },
  ghost: { background: 'transparent', border: colors.border, text: colors.text },
};

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  large = false,
  style,
  tvFocus,
}: AppButtonProps) {
  const [focused, setFocused] = useState(false);
  const palette = VARIANT_STYLES[variant];
  const isInactive = disabled || loading;
  const iconSize = large ? 26 : 20;
  // hasTVPreferredFocus belum masuk tipe publik Pressable; cast aman karena
  // hanya memengaruhi perilaku fokus (diabaikan di HP & web).
  const tvProps = (tvFocus ?? {}) as PressableProps;

  return (
    <Pressable
      focusable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={isInactive}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...tvProps}
      style={[
        styles.base,
        large && styles.large,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: palette.background,
          borderColor: focused ? colors.borderFocus : palette.border,
          borderWidth: focused ? 2 : 1,
          opacity: isInactive ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={iconSize} color={palette.text} /> : null}
          <Text
            style={[
              styles.label,
              { color: palette.text, fontSize: large ? fontSize.lg : fontSize.md },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: {
    minHeight: 60,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontWeight: '700',
  },
});
