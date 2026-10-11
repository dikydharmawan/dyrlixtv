import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { ChannelCard } from '@/components/ChannelCard';
import { EmptyState } from '@/components/EmptyState';
import { InfoBanner } from '@/components/InfoBanner';
import { Screen } from '@/components/Screen';
import { TVFocusGuide, tvPrefFocus } from '@/components/Tv';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { loadPlaylistChannels } from '@/services/playlistLoader';
import { getDeadLinks, setDeadLinks } from '@/services/deadLinks';
import { getPlaylistById } from '@/services/playlistStorage';
import type { Channel, Playlist } from '@/types';
import { isPlaceholder, withGridPlaceholders } from '@/utils/grid';
import { checkStreams } from '@/utils/stream';

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const playlistId = typeof params.id === 'string' ? params.id : '';

  const { columns, gutter, isTV } = useResponsive();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [hideDead, setHideDead] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [deadIds, setDeadIds] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(async () => {
    if (!playlistId) {
      throw new Error('Playlist tidak ditemukan.');
    }

    const meta = await getPlaylistById(playlistId);
    if (!meta) {
      throw new Error('Playlist tidak ditemukan atau sudah dihapus.');
    }

    setPlaylist(meta);
    const data = await loadPlaylistChannels(meta);
    setChannels(data);
  }, [playlistId]);

  const refresh = useCallback(async () => {
    try {
      await load();
      const dead = await getDeadLinks(playlistId);
      setDeadIds(dead);
      setScanNote(null);
      setError(null);
    } catch (e) {
      setChannels([]);
      setError(e instanceof Error ? e.message : 'Gagal memuat playlist.');
    } finally {
      setLoading(false);
    }
  }, [load, playlistId]);

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
      else if (result.status === 'network') unknown += 1;
      if (result.status === 'invalid') unknown += 1;
    }

    setDeadIds(dead);
    await setDeadLinks(playlistId, dead);
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
  }, [channels, scanning, playlistId]);

  useEffect(() => {
    let active = true;
    // Fetch on mount / id berubah. Semua setState berada setelah await,
    // sehingga tidak ada render sinkron; abaikan aturan ini.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = channels;
    if (q) {
      list = list.filter(
        (channel) =>
          channel.name.toLowerCase().includes(q) ||
          (channel.group ?? '').toLowerCase().includes(q),
      );
    }
    if (hideDead) {
      list = list.filter((channel) => !deadIds.has(channel.id));
    }
    return list;
  }, [channels, query, hideDead, deadIds]);

  const data = useMemo(() => withGridPlaceholders(filtered, columns), [filtered, columns]);

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

  const horizontalPadding = isTV ? spacing.xxl : spacing.lg;

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Memuat channel dari playlist…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Gagal memuat playlist"
            description={error}
          />
          <AppButton title="Coba Lagi" icon="refresh" onPress={handleRetry} />
        </View>
      );
    }

    return (
      <TVFocusGuide style={styles.listArea}>
        <FlatList
          key={`channels-${columns}`}
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cari channel…"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              style={[styles.search, { fontSize: isTV ? fontSize.lg : fontSize.md }]}
            />
            <AppButton
              title={scanning ? 'Memeriksa…' : 'Periksa Channel Mati'}
              icon={scanning ? undefined : 'pulse'}
              large
              fullWidth
              loading={scanning}
              disabled={scanning || channels.length === 0}
              onPress={handleScan}
              tvFocus={tvPrefFocus(true)}
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
                tvFocus={tvPrefFocus(true)}
              />
            ) : null}
            {scanNote ? (
              <InfoBanner
                variant={deadIds.size > 0 ? 'danger' : 'info'}
                message={scanNote}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Channel tidak ditemukan"
            description={
              query
                ? `Tidak ada channel yang cocok dengan "${query}".`
                : 'Playlist ini tidak memiliki channel yang bisa ditampilkan.'
            }
          />
        }
      />
      </TVFocusGuide>
    );
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppHeader
        title={playlist?.name ?? 'Playlist'}
        subtitle={
          loading
            ? 'Memuat…'
            : `${channels.length} channel${deadIds.size > 0 ? ` · ${deadIds.size} mati` : ''}`
        }
        onBack={() => router.back()}
      />
      {renderBody()}
      {channels.length > 0 ? (
        <View style={[styles.footer, { paddingHorizontal: horizontalPadding }]}>
          <InfoBanner
            variant="info"
            message="Sumber channel berasal dari playlist Anda. Jika ada yang tidak dapat diputar, kemungkinan tautan sudah tidak aktif."
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  listArea: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
  },
  header: {
    gap: spacing.md,
  },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
});
