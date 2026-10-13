import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { CategoryFilter } from '@/components/CategoryFilter';
import { CategoryRail } from '@/components/CategoryRail';
import { ChannelCard } from '@/components/ChannelCard';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { InfoBanner } from '@/components/InfoBanner';
import { Screen } from '@/components/Screen';
import { SearchBar } from '@/components/SearchBar';
import { TVFocusGuide } from '@/components/Tv';
import { colors, fontSize, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { loadDefaultPlaylist } from '@/services/defaultPlaylist';
import { ensureEpgLoaded } from '@/services/epg';
import { setPlaybackQueue } from '@/services/playbackQueue';
import type { Channel } from '@/types';
import { summarizeCategories } from '@/utils/categories';
import { isPlaceholder, withGridPlaceholders } from '@/utils/grid';

export default function HomeScreen() {
  const router = useRouter();
  const { columns, gutter, isTV, isTablet, isLandscape } = useResponsive();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const reload = useCallback(async (force = true) => {
    setLoading(true);
    setChannels([]);
    const data = await loadDefaultPlaylist(force);
    setChannels(data.channels);
    void ensureEpgLoaded(data.epgUrl, force);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void loadDefaultPlaylist(false).then((data) => {
      if (!active) return;
      setChannels(data.channels);
      setLoading(false);
      void ensureEpgLoaded(data.epgUrl);
    });
    return () => {
      active = false;
    };
  }, []);

  const { categories, counts: categoryCounts } = useMemo(
    () => summarizeCategories(channels),
    [channels],
  );

  const activeGroup = selectedGroup && categories.includes(selectedGroup) ? selectedGroup : null;

  const wide = isTV || isTablet || isLandscape;

  const visibleChannels = useMemo(() => {
    let list = channels;
    if (activeGroup) {
      list = list.filter((channel) => (channel.group ?? 'Umum') === activeGroup);
    }
    const term = query.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (channel) =>
          channel.name.toLowerCase().includes(term) ||
          (channel.group ?? '').toLowerCase().includes(term),
      );
    }
    return list;
  }, [channels, activeGroup, query]);

  const openChannel = useCallback(
    (channel: Channel) => {
      const index = visibleChannels.findIndex((item) => item.id === channel.id);
      setPlaybackQueue(visibleChannels, index);
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
    [router, visibleChannels],
  );

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

  const data = useMemo(
    () => withGridPlaceholders(visibleChannels, columns),
    [visibleChannels, columns],
  );

  const horizontalPadding = isTV ? spacing.xxl : spacing.lg;

  const filterNote = useMemo(() => {
    const term = query.trim();
    if (term) {
      return `Menampilkan ${visibleChannels.length} channel untuk pencarian "${term}" dari ${channels.length}.`;
    }
    if (activeGroup) {
      return `Menampilkan ${visibleChannels.length} channel kategori "${activeGroup}" dari ${channels.length}.`;
    }
    return `${channels.length} channel dari playlist bawaan. Ketuk ikon segarkan untuk mengambil daftar terbaru tanpa update aplikasi.`;
  }, [query, activeGroup, visibleChannels.length, channels.length]);

  return (
    <Screen>
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
          {channels.length > 0 ? (
            <View style={[styles.filters, { paddingHorizontal: horizontalPadding }]}>
              <SearchBar value={query} onChangeText={setQuery} />
              {!wide && categories.length > 1 ? (
                <CategoryFilter
                  categories={categories}
                  selected={activeGroup}
                  onSelect={setSelectedGroup}
                />
              ) : null}
            </View>
          ) : null}
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
                  <View style={styles.hero}>
                    <Text
                      style={[styles.heroTitle, { fontSize: isTV ? fontSize.hero : fontSize.xxl }]}
                    >
                      DYRLIX TV
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
                </View>
              }
              ListEmptyComponent={
                loading ? (
                  <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Memuat channel bawaan…</Text>
                  </View>
                ) : channels.length > 0 ? (
                  <EmptyState
                    icon="search-outline"
                    title="Tidak ditemukan"
                    description={
                      query.trim()
                        ? `Tidak ada channel yang cocok dengan "${query.trim()}". Coba kata kunci lain.`
                        : activeGroup
                          ? `Tidak ada channel pada kategori "${activeGroup}". Coba pilih kategori lain.`
                          : 'Tidak ada channel yang ditampilkan. Coba ubah filter Anda.'
                    }
                  />
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
                      message={filterNote}
                    />
                  </View>
                ) : null
              }
            />
          </TVFocusGuide>
        </View>
      </View>
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
  filters: {
    paddingTop: spacing.sm,
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
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  footer: {
    marginTop: spacing.xl,
  },
});