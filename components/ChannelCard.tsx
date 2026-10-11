import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { tvPrefFocus, type TVFocusProps } from '@/components/Tv';
import type { Channel } from '@/types';

interface ChannelCardProps {
  channel: Channel;
  onPress: (channel: Channel) => void;
  style?: StyleProp<ViewStyle>;
  /** Kartu pertama (menerima fokus awal saat layar dibuka di TV). */
  first?: boolean;
  /** Menandai channel yang link-nya mati (hasil pemindaian). */
  dead?: boolean;
  /** Properti fokus TV tambahan (nextFocus*). Aman di HP & web. */
  tvFocus?: TVFocusProps;
}

export function ChannelCard({
  channel,
  onPress,
  style,
  first = false,
  dead = false,
  tvFocus,
}: ChannelCardProps) {
  const { isTV } = useResponsive();
  const [focused, setFocused] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const showLogo = Boolean(channel.logo) && !logoFailed;
  const logoHeight = isTV ? 140 : 100;

  const tvProps: PressableProps | undefined = first || tvFocus
    ? (({ ...(first ? tvPrefFocus(true) : {}), ...tvFocus }) as PressableProps)
    : undefined;

  return (
    <Pressable
      focusable
      accessibilityRole="button"
      accessibilityLabel={`Putar ${channel.name}`}
      onPress={() => onPress(channel)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...tvProps}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: focused ? colors.borderFocus : colors.border,
          borderWidth: focused ? 2 : 1,
          backgroundColor: focused ? colors.surfaceAlt : colors.surface,
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.logoWrap, { height: logoHeight }]}>
        {showLogo ? (
          <Image
            source={channel.logo}
            style={styles.logo}
            contentFit="contain"
            transition={150}
            cachePolicy="memory-disk"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <Ionicons name="tv-outline" size={isTV ? 56 : 40} color={colors.primary} />
        )}

        {channel.isDemo ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>DEMO</Text>
          </View>
        ) : null}

        {dead ? (
          <View style={styles.deadBadge}>
            <Ionicons name="close-circle" size={14} color={colors.white} />
            <Text style={styles.deadBadgeText}>MATI</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text
          style={[styles.name, { fontSize: isTV ? fontSize.lg : fontSize.md }]}
          numberOfLines={1}
        >
          {channel.name}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.group} numberOfLines={1}>
            {channel.group ?? 'Umum'}
          </Text>
          <Ionicons
            name={dead ? 'close-circle' : focused ? 'play-circle' : 'play-circle-outline'}
            size={isTV ? 30 : 24}
            color={dead ? colors.danger : colors.primary}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  logoWrap: {
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    color: colors.background,
    fontSize: fontSize.xs,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  deadBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  deadBadgeText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  body: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  name: {
    color: colors.text,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  group: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
});
