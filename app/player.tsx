import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { isTV, tvPrefFocus } from '@/components/Tv';
import { checkStream, friendlyStreamError, type StreamCheck } from '@/utils/stream';

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string; name?: string; headers?: string }>();

  const url = typeof params.url === 'string' ? params.url : '';
  const title = (typeof params.name === 'string' && params.name) || 'Siaran';
  const [backFocused, setBackFocused] = useState(false);
  const [preCheck, setPreCheck] = useState<StreamCheck | null>(null);

  const headers = useMemo(() => {
    const raw = typeof params.headers === 'string' ? params.headers : '';
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    } catch {
      // header tidak valid → dibiarkan tanpa header
    }
    return undefined;
  }, [params.headers]);

  const source = useMemo(
    () => (url ? { uri: url, headers } : null),
    [url, headers],
  );

  useEffect(() => {
    if (!url) return;
    let active = true;
    void checkStream(url, 8000, headers).then((result) => {
      if (active) setPreCheck(result);
    });
    return () => {
      active = false;
    };
  }, [url, headers]);

  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.play();
  });

  const { status, error } = useEvent(player, 'statusChange', { status: player.status });

  const deadLink = preCheck === 'dead';
  const isLoading =
    Boolean(url) && (status === 'loading' || status === 'idle') && !deadLink;
  const hasError = !url || status === 'error' || deadLink;

  const errorMessage = !url
    ? 'URL stream tidak valid atau tidak ditemukan.'
    : deadLink
      ? 'Kanal tidak tersedia (HTTP 404) — tautan mati atau diblokir server. Coba channel lain atau hapus dari playlist.'
      : friendlyStreamError(error) ??
        'Stream tidak dapat diputar. Periksa koneksi atau tautan.';

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const retry = useCallback(() => {
    if (!url) return;
    setPreCheck(null);
    void checkStream(url, 8000, headers).then(setPreCheck);
    player.replace({ uri: url, headers });
    player.play();
  }, [player, url, headers]);

  return (
    <View style={styles.container}>
      {url ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls
          allowsPictureInPicture
          fullscreenOptions={{ enable: true }}
        />
      ) : null}

      {isLoading ? (
        <View style={styles.overlayCenter} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Memuat siaran…</Text>
        </View>
      ) : null}

      {hasError ? (
        <View style={styles.overlayCenter}>
          <Ionicons name="cloud-offline-outline" size={64} color={colors.danger} />
          <Text style={styles.errorTitle}>Gagal memuat stream</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <View style={styles.errorActions}>
            {url ? <AppButton title="Coba Lagi" icon="refresh" onPress={retry} /> : null}
            <AppButton
              title="Kembali"
              variant="secondary"
              icon="arrow-back"
              onPress={handleBack}
            />
          </View>
        </View>
      ) : null}

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          focusable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={handleBack}
          onFocus={() => setBackFocused(true)}
          onBlur={() => setBackFocused(false)}
          {...((isTV() ? tvPrefFocus(true) : undefined) as PressableProps | undefined)}
          style={[styles.backButton, backFocused && styles.backButtonFocused]}
        >
          <Ionicons name="chevron-back" size={28} color={colors.white} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.liveBadge}>● LIVE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  overlayCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.overlay,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  errorTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  errorMessage: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  backButtonFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.primarySoft,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  liveBadge: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
