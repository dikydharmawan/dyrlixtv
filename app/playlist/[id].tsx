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
import { CategoryFilter } from '@/components/CategoryFilter';
import { CategoryRail } from '@/components/CategoryRail';
import { ChannelCard } from '@/components/ChannelCard';
import { EmptyState } from '@/components/EmptyState';
import { InfoBanner } from '@/components/InfoBanner';
import { Screen } from '@/components/Screen';
import { TVFocusGuide } from '@/components/Tv';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { ensureEpgLoaded } from '@/services/epg';
import { loadPlaylistData } from '@/services/playlistLoader';
import { setPlaybackQueue } from '@/services/playbackQueue';
import { getPlaylistById } from '@/services/playlistStorage';
import type { Channel, Playlist } from '@/types';
import { summarizeCategories } from '@/utils/categories';
import { isPlaceholder, withGridPlaceholders } from '@/utils/grid';
import { goBack } from '@/utils/navigation';

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const playlistId = typeof params.id === 'string' ? params.id : '';

  const { columns, gutter, isTV, isTablet, isLandscape } = useResponsive();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!playlistId) {
      throw new Error('Playlist tidak ditemukan.');
    }

    const meta = await getPlaylistById(playlistId);
    if (!meta) {
      throw new Error('Playlist tidak ditemukan atau sudah dihapus.');
    }

    setPlaylist(meta);
    const data = await loadPlaylistData(meta);
    // Yield ke event loop biar UI sempat render loading state & nggak keliatan freeze
    await new Promise((resolve) => setTimeout(resolve, 0));
    setChannels(data.channels);
    void ensureEpgLoaded(data.epgUrl);
  }, [playlistId]);

  const refresh = useCallback(async () => {
    try {
      await load();
      setError(null);
    } catch (e) {
      setChannels([]);
      setError(e instanceof Error ? e.message : 'Gagal memuat playlist.');
    } finally {
      setLoading(false);
    }
  }, [load]);

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

  const { categories, counts: categoryCounts } = useMemo(
    () => summarizeCategories(channels),
    [channels],
  );

  const activeGroup = selectedGroup && categories.includes(selectedGroup) ? selectedGroup : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = channels;
    if (activeGroup) {
      list = list.filter((channel) => (channel.group ?? 'Umum') === activeGroup);
    }
    if (q) {
      list = list.filter(
        (channel) =>
          channel.name.toLowerCase().includes(q) ||
          (channel.group ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [channels, query, activeGroup]);

  const openSchedule = useCallback(
    (channel: Channel) => {
      if (!channel.tvgId) return;
      router.push({
        pathname: '/schedule',
        params: { tvgId: channel.tvgId, name: channel.name },
      });
    },
    [router],
  );

  const data = useMemo(() => withGridPlaceholders(filtered, columns), [filtered, columns]);

  const openChannel = useCallback(
    (channel: Channel) => {
      const index = filtered.findIndex((item) => item.id === channel.id);
      setPlaybackQueue(filtered, index);
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
    [router, filtered],
  );

  const horizontalPadding = isTV ? spacing.xxl : spacing.lg;
  const wide = isTV || isTablet || isLandscape;

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
      <View style={styles.body}>
        {wide && channels.length > 0 ? (
          <CategoryRail
            categories={categories}
            counts={categoryCounts}
            total={channels.length}
            selected={activeGroup}
            onSelect={setSelectedGroup}
          />
        ) : null}
        <View style={styles.main}>
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
                    onSchedule={openSchedule}
                    first={index === 0}
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
                  {!wide && categories.length > 1 ? (
                    <CategoryFilter
                      categories={categories}
                      selected={activeGroup}
                      onSelect={setSelectedGroup}
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
                      : activeGroup
                        ? `Tidak ada channel pada kategori "${activeGroup}".`
                        : 'Playlist ini tidak memiliki channel yang bisa ditampilkan.'
                  }
                />
              }
            />
          </TVFocusGuide>
        </View>
      </View>
    );
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppHeader
        title={playlist?.name ?? 'Playlist'}
        subtitle={loading ? 'Memuat…' : `${channels.length} channel`}
        onBack={() => goBack(router)}
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
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  main: {
    flex: 1,
  },
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
