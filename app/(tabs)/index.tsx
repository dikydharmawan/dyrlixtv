import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ChannelCard } from '@/components/ChannelCard';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { InfoBanner } from '@/components/InfoBanner';
import { Screen } from '@/components/Screen';
import { TVFocusGuide } from '@/components/Tv';
import { colors, fontSize, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { getDeadLinks, setDeadLinks } from '@/services/deadLinks';
import { loadDefaultChannels } from '@/services/defaultPlaylist';
import type { Channel } from '@/types';
import { isPlaceholder, withGridPlaceholders } from '@/utils/grid';
import { checkStreams } from '@/utils/stream';

const DEFAULT_CHANNELS_KEY = 'playlist-bawaan';

export default function HomeScreen() {
  const router = useRouter();
  const { columns, gutter, isTV } = useResponsive();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deadIds, setDeadIds] = useState<Set<string>>(new Set());
  const [hideDead, setHideDead] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const reload = useCallback(async (force = true) => {
    setLoading(true);
    setChannels([]);
    const data = await loadDefaultChannels(force);
    setChannels(data);
    setScanNote(null);
    setDeadIds(await getDeadLinks(DEFAULT_CHANNELS_KEY));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void loadDefaultChannels(false).then(async (data) => {
      if (!active) return;
      setChannels(data);
      setDeadIds(await getDeadLinks(DEFAULT_CHANNELS_KEY));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleScan = useCallback(async () => {
    if (channels.length === 0 || scanning) return;
    setScanning(true);
    setDeadIds(new Set());
    setScanNote(null);

    const results = await checkStreams(
      channels.map((channel) => ({ id: channel.id, url: channel.url, headers: channel.headers })),
    );

    const dead = new Set<string>();
    let unknown = 0;
    for (const result of results) {
      if (result.status === 'dead') dead.add(result.id);
      else if (result.status === 'network' || result.status === 'invalid') unknown += 1;
    }

    setDeadIds(dead);
    await setDeadLinks(DEFAULT_CHANNELS_KEY, dead);
    setScanNote(
      dead.size === 0
        ? unknown > 0
          ? `Semua channel tampak aktif (${unknown} tak dapat diuji — periksa koneksi).`
          : 'Semua channel dapat diakses. Tidak ada link mati.'
        : unknown > 0
          ? `${dead.size} channel mati (404) terdeteksi, ${unknown} tak dapat diuji karena jaringan.`
          : `${dead.size} channel mati (404) terdeteksi — tandai MATI.`,
    );
    setScanning(false);
  }, [channels, scanning]);

  const openChannel = useCallback(
    (channel: Channel) => {
      router.push({
        pathname: '/player',
        params: {
          url: channel.url,
          name: channel.name,
          logo: channel.logo ?? '',
          headers: channel.headers ? JSON.stringify(channel.headers) : '',
        },
      });
    },
    [router],
  );

  const visibleChannels = useMemo(
    () => (hideDead ? channels.filter((channel) => !deadIds.has(channel.id)) : channels),
    [channels, hideDead, deadIds],
  );

  const data = useMemo(
    () => withGridPlaceholders(visibleChannels, columns),
    [visibleChannels, columns],
  );

  const horizontalPadding = isTV ? spacing.xxl : spacing.lg;

  return (
    <Screen>
      <TVFocusGuide style={styles.focus}>
        <FlatList
          key={`channels-${columns}`}
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) =>
            isPlaceholder(item) ? (
              <View style={styles.placeholder} />
            ) : (
              <ChannelCard
                channel={item}
                onPress={openChannel}
                first={index === 0}
                dead={deadIds.has(item.id)}
              />
            )
          }
          columnWrapperStyle={columns > 1 ? { gap: gutter } : undefined}
          contentContainerStyle={[
            styles.listContent,
            { gap: gutter, paddingHorizontal: horizontalPadding },
          ]}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.hero}>
                <Text
                  style={[styles.heroTitle, { fontSize: isTV ? fontSize.hero : fontSize.xxl }]}
                >
                  IPTV Player
                </Text>
                <Text style={styles.heroSubtitle}>
                  Tonton channel favorit Anda dalam tampilan gelap yang nyaman di HP, Web, dan
                  Android TV.
                </Text>
                <AppButton
                  title="Tambah Playlist"
                  icon="add"
                  large
                  onPress={() => router.push('/add-playlist')}
                />
              </View>

              <View style={styles.sectionRow}>
                <Text
                  style={[styles.sectionTitle, { fontSize: isTV ? fontSize.xl : fontSize.lg }]}
                >
                  Channel Bawaan
                </Text>
                {channels.length > 0 ? (
                  <IconButton
                    name="refresh"
                    label="Segarkan channel bawaan"
                    size={isTV ? 30 : 24}
                    onPress={() => {
                      void reload(true);
                    }}
                  />
                ) : null}
              </View>

              <View style={styles.actions}>
                <AppButton
                  title={scanning ? 'Memeriksa…' : 'Periksa Channel Mati'}
                  icon={scanning ? undefined : 'pulse'}
                  loading={scanning}
                  disabled={scanning || channels.length === 0}
                  fullWidth
                  onPress={handleScan}
                />
                {deadIds.size > 0 ? (
                  <AppButton
                    title={
                      hideDead
                        ? `Tampilkan semua (${deadIds.size} mati)`
                        : `Sembunyikan ${deadIds.size} channel mati`
                    }
                    icon={hideDead ? 'eye-outline' : 'eye-off-outline'}
                    variant="secondary"
                    fullWidth
                    onPress={() => setHideDead((value) => !value)}
                  />
                ) : null}
                {scanNote ? (
                  <InfoBanner
                    variant={deadIds.size > 0 ? 'danger' : 'info'}
                    message={scanNote}
                  />
                ) : null}
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Memuat channel bawaan…</Text>
              </View>
            ) : (
              <EmptyState
                icon="cloud-offline-outline"
                title="Channel bawaan gagal dimuat"
                description="Periksa jaringan lalu coba segarkan kembali. Tautan playlist bawaan berasal dari server pihak ketiga."
              />
            )
          }
          ListFooterComponent={
            channels.length > 0 ? (
              <View style={styles.footer}>
                <InfoBanner
                  variant="info"
                  message={
                    hideDead && deadIds.size > 0
                      ? `Menampilkan ${visibleChannels.length} channel aktif dari ${channels.length} (${deadIds.size} disembunyikan karena mati).`
                      : `${channels.length} channel dari playlist bawaan. Ketuk ikon segarkan untuk mengambil daftar terbaru tanpa update aplikasi.`
                  }
                />
              </View>
            ) : null
          }
        />
      </TVFocusGuide>
    </Screen>
  );
}

const styles = StyleSheet.create({
  focus: {
    flex: 1,
  },
  center: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  listContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  placeholder: {
    flex: 1,
  },
  header: {
    gap: spacing.xl,
    marginBottom: spacing.sm,
  },
  hero: {
    gap: spacing.sm,
  },
  heroTitle: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  footer: {
    marginTop: spacing.xl,
  },
});