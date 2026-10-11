import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius } from '@/constants/theme';
import type { TVFocusProps } from '@/components/Tv';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface IconButtonProps {
  name: IoniconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Properti fokus TV (hasTVPreferredFocus / nextFocus*). Aman di HP & web. */
  tvFocus?: TVFocusProps;
}

export function IconButton({
  name,
  onPress,
  label,
  size = 24,
  color = colors.text,
  style,
  tvFocus,
}: IconButtonProps) {
  const [focused, setFocused] = useState(false);
  // Cast aman untuk hasTVPreferredFocus (belum ada di tipe publik Pressable).
  const tvProps = (tvFocus ?? {}) as PressableProps;

  return (
    <Pressable
      focusable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...tvProps}
      style={[
        styles.base,
        {
          borderColor: focused ? colors.borderFocus : 'transparent',
          backgroundColor: focused ? colors.primarySoft : 'transparent',
        },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={focused ? colors.primary : color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
