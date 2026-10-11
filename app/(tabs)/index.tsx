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
import { loadDefaultChannels } from '@/services/defaultPlaylist';
import type { Channel } from '@/types';
import { isPlaceholder, withGridPlaceholders } from '@/utils/grid';

export default function HomeScreen() {
  const router = useRouter();
  const { columns, gutter, isTV } = useResponsive();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (force = true) => {
    setLoading(true);
    setChannels([]);
    const data = await loadDefaultChannels(force);
    setChannels(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void loadDefaultChannels(false).then((data) => {
      if (!active) return;
      setChannels(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

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

  const data = useMemo(() => withGridPlaceholders(channels, columns), [channels, columns]);

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
              <ChannelCard channel={item} onPress={openChannel} first={index === 0} />
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
                  message={`${channels.length} channel dari playlist bawaan. Ketuk ikon segarkan untuk mengambil daftar terbaru tanpa update aplikasi.`}
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
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  footer: {
    marginTop: spacing.xl,
  },
});