import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { IconButton } from '@/components/IconButton';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useEpg } from '@/hooks/useEpg';
import { useResponsive } from '@/hooks/useResponsive';
import { getNowNext, isLiveTitle } from '@/services/epg';
import { tvPrefFocus, type TVFocusProps } from '@/components/Tv';
import { getFavorites, toggleFavorite } from '@/services/playlistStorage';
import type { Channel } from '@/types';

interface ChannelCardProps {
  channel: Channel;
  onPress: (channel: Channel) => void;
  /** Membuka halaman jadwal tayang channel (opsional). */
  onSchedule?: (channel: Channel) => void;
  style?: StyleProp<ViewStyle>;
  /** Kartu pertama (menerima fokus awal saat layar dibuka di TV). */
  first?: boolean;
  /** Properti fokus TV tambahan (nextFocus*). Aman di HP & web. */
  tvFocus?: TVFocusProps;
}

export function ChannelCard({
  channel,
  onPress,
  onSchedule,
  style,
  first = false,
  tvFocus,
}: ChannelCardProps) {
  const { isTV } = useResponsive();
  const [focused, setFocused] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    void getFavorites().then((favs) => setIsFavorite(favs.includes(channel.id)));
  }, [channel.id]);

  const handleToggleFavorite = useCallback(async () => {
    const nextFavs = await toggleFavorite(channel.id);
    setIsFavorite(nextFavs.includes(channel.id));
  }, [channel.id]);

  const showLogo = Boolean(channel.logo) && !logoFailed;
  const logoHeight = isTV ? 140 : 100;

  const tvProps: PressableProps | undefined = first || tvFocus
    ? (({ ...(first ? tvPrefFocus(true) : {}), ...tvFocus }) as PressableProps)
    : undefined;

  const epg = useEpg();
  const nowNext = useMemo(() => {
    if (!epg || !channel.tvgId) return null;
    return getNowNext(channel.tvgId);
  }, [epg, channel.tvgId]);

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: focused ? colors.borderFocus : colors.border,
          borderWidth: focused ? 2 : 1,
          backgroundColor: focused ? colors.surfaceAlt : colors.surface,
        },
        style,
      ]}
    >
      <Pressable
        focusable
        accessibilityRole="button"
        accessibilityLabel={`Putar ${channel.name}`}
        onPress={() => onPress(channel)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...tvProps}
        style={({ pressed }) => [pressed && styles.pressed]}
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
        </View>

        <View style={styles.body}>
          <Text
            style={[styles.name, { fontSize: isTV ? fontSize.lg : fontSize.md }]}
            numberOfLines={1}
          >
            {channel.name}
          </Text>
          {nowNext?.now ? (
            <View style={styles.nowRow}>
              <Text style={styles.nowDot}>●</Text>
              <Text style={styles.nowTitle} numberOfLines={1}>
                {nowNext.now.title}
              </Text>
              {isLiveTitle(nowNext.now.title) ? (
                <View style={styles.livePill}>
                  <Text style={styles.livePillText}>LIVE</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {nowNext?.next ? (
            <Text style={styles.nextTitle} numberOfLines={1}>
              Berikutnya · {nowNext.next.title}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Text style={styles.group} numberOfLines={1}>
            {channel.group ?? 'Umum'}
          </Text>
          <View style={styles.actions}>
            {onSchedule && channel.tvgId ? (
              <IconButton
                name="calendar-outline"
                label={`Jadwal ${channel.name}`}
                size={isTV ? 26 : 22}
                color={colors.textMuted}
                onPress={() => onSchedule(channel)}
                style={styles.scheduleIcon}
              />
            ) : null}
            <IconButton
              name={isFavorite ? 'heart' : 'heart-outline'}
              label={isFavorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}
              size={isTV ? 26 : 22}
              color={isFavorite ? colors.danger : colors.textMuted}
              onPress={handleToggleFavorite}
              style={styles.scheduleIcon}
            />
            <Ionicons
              name={focused ? 'play-circle' : 'play-circle-outline'}
              size={isTV ? 30 : 24}
              color={colors.primary}
            />
          </View>
        </View>
      </View>
    </View>
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
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  meta: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  name: {
    color: colors.text,
    fontWeight: '700',
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nowDot: {
    color: colors.danger,
    fontSize: fontSize.xs,
  },
  nowTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  livePill: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  livePillText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  nextTitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scheduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
});
