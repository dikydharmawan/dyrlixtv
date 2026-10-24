import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { IconButton } from '@/components/IconButton';
import { browserRetryHeaders, mergeStreamHeaders } from '@/constants/streamHeaders';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useEpg } from '@/hooks/useEpg';
import { getNowNext } from '@/services/epg';
import { getPlaybackQueue } from '@/services/playbackQueue';
import { saveLastChannel, addRecent } from '@/services/playlistStorage';
import { isTV, tvPrefFocus } from '@/components/Tv';
import { goBack } from '@/utils/navigation';
import { checkStreamDetail, friendlyStreamError, type StreamCheckDetail } from '@/utils/stream';

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string; name?: string; headers?: string }>();

  const initialQueue = useMemo(() => getPlaybackQueue(), []);
  const queueChannels = initialQueue?.channels;
  const [queueIndex, setQueueIndex] = useState(initialQueue?.index ?? -1);
  const activeChannel =
    queueChannels && queueIndex >= 0 && queueIndex < queueChannels.length
      ? queueChannels[queueIndex]
      : null;

  const paramsUrl = typeof params.url === 'string' ? params.url : '';
  const paramsTitle = (typeof params.name === 'string' && params.name) || 'Siaran';

  const url = activeChannel?.url ?? paramsUrl;
  const title = activeChannel?.name ?? paramsTitle;

  const epg = useEpg();
  const nowNext = useMemo(() => {
    if (!epg) return null;
    return getNowNext(activeChannel?.tvgId);
  }, [epg, activeChannel]);

  useEffect(() => {
    if (activeChannel?.id) {
      void saveLastChannel(activeChannel.id);
      void addRecent(activeChannel.id);
    }
  }, [activeChannel?.id]);

  const [backFocused, setBackFocused] = useState(false);
  const [preCheck, setPreCheck] = useState<StreamCheckDetail | null>(null);
  const retriedRef = useRef(false);

  const hasPrev = Boolean(queueChannels && queueIndex > 0);
  const hasNext = Boolean(
    queueChannels && queueIndex >= 0 && queueIndex < queueChannels.length - 1,
  );

  const goPrev = useCallback(() => {
    setQueueIndex((current) => (current > 0 ? current - 1 : current));
  }, []);

  const goNext = useCallback(() => {
    setQueueIndex((current) =>
      queueChannels && current < queueChannels.length - 1 ? current + 1 : current,
    );
  }, [queueChannels]);

  const openSchedule = useCallback(() => {
    if (!activeChannel?.tvgId) return;
    router.push({
      pathname: '/schedule',
      params: { tvgId: activeChannel.tvgId, name: activeChannel.name },
    });
  }, [router, activeChannel]);

  const paramsHeaders = useMemo<Record<string, string> | undefined>(() => {
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

  const channelHeaders = activeChannel?.headers ?? paramsHeaders;

  const mergedHeaders = useMemo(() => mergeStreamHeaders(channelHeaders), [channelHeaders]);

  const source = useMemo(
    () => (url ? { uri: url, headers: mergedHeaders } : null),
    [url, mergedHeaders],
  );

  useEffect(() => {
    if (!url) return;
    console.log(`[Player] Attempting to load: ${url}`);
    
    let active = true;
    retriedRef.current = false;
    void checkStreamDetail(url, 8000, channelHeaders).then((result) => {
      if (active) setPreCheck(result);
    });
    return () => {
      active = false;
    };
  }, [url, channelHeaders]);

  // Tambahkan pengamanan agar tidak membuat player jika source belum siap
  const player = useVideoPlayer(source, (instance) => {
    console.log(`[Player] Instance initialized for: ${url}`);
    instance.loop = false;
    instance.play();
  });

  const { status, error } = useEvent(player, 'statusChange', { status: player.status });

  // Coba ulang sekali dengan header "browser" (UA + Referer asal) — banyak server
  // menolak hotlink tanpa Referer, sehingga 403/404 bisa hilang setelah retry.
  useEffect(() => {
    if (status !== 'error' || !url) return;
    if (retriedRef.current) return;
    retriedRef.current = true;
    const timer = setTimeout(() => {
      player.replace({ uri: url, headers: browserRetryHeaders(url, channelHeaders) });
      player.play();
    }, 600);
    return () => clearTimeout(timer);
  }, [status, url, channelHeaders, player]);

  const preCheckDead = preCheck?.status === 'dead';
  const isLoading = Boolean(url) && (status === 'loading' || status === 'idle');
  // Pra-cek TIDAK lagi memblokir pemutaran; hanya jadi peringatan.
  const hasError = !url || status === 'error';
  const showWarning = Boolean(url) && preCheckDead && status !== 'error';

  const errorMessage = !url
    ? 'URL stream tidak valid atau tidak ditemukan.'
    : friendlyStreamError(error, preCheckDead ? preCheck?.httpStatus : undefined) ??
      'Stream tidak dapat diputar. Periksa koneksi atau tautan.';

  const handleBack = useCallback(() => {
    goBack(router);
  }, [router]);

  const retry = useCallback(() => {
    if (!url) return;
    retriedRef.current = false;
    setPreCheck(null);
    void checkStreamDetail(url, 8000, channelHeaders).then(setPreCheck);
    player.replace({ uri: url, headers: mergedHeaders });
    player.play();
  }, [player, url, channelHeaders, mergedHeaders]);

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

      {isLoading && !hasError ? (
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
          {url ? (
            <View style={styles.diagnostics}>
              <Text style={styles.diagnosticLabel}>URL</Text>
              <Text selectable style={styles.diagnosticValue}>
                {url}
              </Text>
              {typeof preCheck?.httpStatus === 'number' ? (
                <Text style={styles.diagnosticValue}>Kode HTTP: {preCheck.httpStatus}</Text>
              ) : null}
            </View>
          ) : null}
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

      {showWarning ? (
        <View style={styles.warningBanner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.accent} />
          <Text style={styles.warningText}>
            Tautan ini kemungkinan mati (HTTP {preCheck?.httpStatus ?? 404}). Mencoba tetap memutar…
          </Text>
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
          <View style={styles.metaRow}>
            <Text style={styles.liveBadge}>● LIVE</Text>
            {queueChannels ? (
              <Text style={styles.position}>
                Channel {queueIndex + 1}/{queueChannels.length}
              </Text>
            ) : null}
          </View>
          {nowNext?.now ? (
            <Text style={styles.nowPlaying} numberOfLines={1}>
              Sekarang · {nowNext.now.title}
            </Text>
          ) : null}
          {nowNext?.next ? (
            <Text style={styles.nextPlaying} numberOfLines={1}>
              Berikutnya · {nowNext.next.title}
            </Text>
          ) : null}
        </View>
        {activeChannel?.tvgId ? (
          <IconButton
            name="calendar-outline"
            label="Lihat jadwal tayang"
            size={24}
            color={colors.white}
            onPress={openSchedule}
            style={styles.scheduleButton}
          />
        ) : null}
        {queueChannels ? (
          <View style={styles.navButtons}>
            <SkipButton
              icon="play-skip-back"
              label="Channel sebelumnya"
              disabled={!hasPrev}
              onPress={goPrev}
            />
            <SkipButton
              icon="play-skip-forward"
              label="Channel berikutnya"
              disabled={!hasNext}
              onPress={goNext}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

interface SkipButtonProps {
  icon: 'play-skip-back' | 'play-skip-forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
}

function SkipButton({ icon, label, disabled, onPress }: SkipButtonProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      focusable={!disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.skipButton,
        disabled && styles.skipButtonDisabled,
        focused && !disabled && styles.skipButtonFocused,
      ]}
    >
      <Ionicons name={icon} size={26} color={colors.white} />
    </Pressable>
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
  diagnostics: {
    width: '100%',
    maxWidth: 560,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  diagnosticLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  diagnosticValue: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  errorActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  warningBanner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  warningText: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.sm,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  liveBadge: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  position: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  nowPlaying: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  nextPlaying: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scheduleButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  skipButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  skipButtonFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.primarySoft,
  },
  skipButtonDisabled: {
    opacity: 0.35,
  },
});
