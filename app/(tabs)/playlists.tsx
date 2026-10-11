import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { InfoBanner } from '@/components/InfoBanner';
import { PlaylistCard } from '@/components/PlaylistCard';
import { Screen } from '@/components/Screen';
import { TVFocusGuide, tvPrefFocus } from '@/components/Tv';
import { colors, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { getPlaylists, removePlaylist } from '@/services/playlistStorage';
import type { Playlist } from '@/types';
import { confirmAction } from '@/utils/confirm';

export default function PlaylistsScreen() {
  const router = useRouter();
  const { gutter, isTV } = useResponsive();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getPlaylists();
    setPlaylists(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleOpen = useCallback(
    (playlist: Playlist) => {
      router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } });
    },
    [router],
  );

  const handleDelete = useCallback(async (playlist: Playlist) => {
    const confirmed = await confirmAction(
      'Hapus Playlist',
      `Hapus "${playlist.name}" dari daftar? Tindakan ini tidak dapat dibatalkan.`,
    );
    if (!confirmed) return;

    setBusyId(playlist.id);
    try {
      const next = await removePlaylist(playlist.id);
      setPlaylists(next);
    } finally {
      setBusyId(null);
    }
  }, []);

  const horizontalPadding = isTV ? spacing.xxl : spacing.lg;

  return (
    <Screen>
      <AppHeader
        title="Playlist Saya"
        subtitle={loading ? 'Memuat…' : `${playlists.length} playlist tersimpan`}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <TVFocusGuide style={styles.listArea}>
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <PlaylistCard
                playlist={item}
                onOpen={handleOpen}
                onDelete={handleDelete}
                busy={busyId === item.id}
                firstFocus={index === 0}
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              { gap: gutter, paddingHorizontal: horizontalPadding },
            ]}
            ListHeaderComponent={
              <AppButton
                title="Tambah Playlist Baru"
                icon="add"
                fullWidth
                large
                onPress={() => router.push('/add-playlist')}
                tvFocus={playlists.length === 0 ? tvPrefFocus(true) : undefined}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="albums-outline"
                title="Belum ada playlist"
                description="Tambahkan tautan M3U/M3U8 untuk mulai menonton channel pilihan Anda."
              />
            }
            ListFooterComponent={
              playlists.length > 0 ? (
                <InfoBanner
                  variant="info"
                  message="Playlist disimpan secara lokal di perangkat Anda. Segala konten dari tautan pihak ketiga merupakan tanggung jawab pengguna."
                />
              ) : null
            }
          />
        </TVFocusGuide>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
});
