import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ChannelCard } from '@/components/ChannelCard';
import { InfoBanner } from '@/components/InfoBanner';
import { Screen } from '@/components/Screen';
import { TVFocusGuide } from '@/components/Tv';
import { DEFAULT_CHANNELS } from '@/constants/channels';
import { colors, fontSize, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import type { Channel } from '@/types';
import { isPlaceholder, withGridPlaceholders } from '@/utils/grid';

export default function HomeScreen() {
  const router = useRouter();
  const { columns, gutter, isTV } = useResponsive();

  const openChannel = useCallback(
    (channel: Channel) => {
      router.push({
        pathname: '/player',
        params: { url: channel.url, name: channel.name, logo: channel.logo ?? '' },
      });
    },
    [router],
  );

  const data = useMemo(
    () => withGridPlaceholders(DEFAULT_CHANNELS, columns),
    [columns],
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

            <Text
              style={[styles.sectionTitle, { fontSize: isTV ? fontSize.xl : fontSize.lg }]}
            >
              Channel Bawaan
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <InfoBanner
              variant="warning"
              title="Disclaimer"
              message="Channel bawaan hanya contoh. Untuk siaran komersial resmi, tambahkan playlist Anda sendiri. Pengguna bertanggung jawab penuh atas seluruh tautan pihak ketiga yang digunakan. Aplikasi ini tidak menyediakan, menyimpan, maupun menyiarkan konten apa pun."
            />
          </View>
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
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  footer: {
    marginTop: spacing.xl,
  },
});
