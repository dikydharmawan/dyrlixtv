import Ionicons from '@expo/vector-icons/Ionicons';
import * as Application from 'expo-application';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Screen } from '@/components/Screen';
import { TVFocusGuide } from '@/components/Tv';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { defaultManifestUrl, getInstalledVersion } from '@/services/updateManager';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface Feature {
  icon: IoniconName;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: 'play-circle-outline',
    title: 'Pemutar HLS cepat',
    description: 'Streaming M3U8/HLS lancar dengan buffering ringan dan dukungan header khusus.',
  },
  {
    icon: 'tv-outline',
    title: 'Playlist bawaan siap tonton',
    description: 'Channel publik dari iptv-org dimuat otomatis tanpa perlu menyiapkan apa pun.',
  },
  {
    icon: 'cloud-upload-outline',
    title: 'Impor playlist fleksibel',
    description: 'Tambahkan sumber lewat tautan URL, tempel teks M3U, atau pilih file dari perangkat.',
  },
  {
    icon: 'search-outline',
    title: 'Pencarian & kategori',
    description: 'Temukan channel dengan cepat lewat pencarian dan filter kategori.',
  },
  {
    icon: 'cloud-download-outline',
    title: 'Pembaruan mandiri',
    description: 'Perbarui APK langsung dari dalam aplikasi, tanpa perlu melalui toko aplikasi.',
  },
];

const DEVELOPER_NAME = 'Ahmad Diky Dharmawan';
const DEVELOPER_ROLE = 'Pengembang & Pemelihara';
const GITHUB_URL = 'https://github.com/dikydharmawan';
const CONTACT_EMAIL = 'dikyaye118@gmail.com';

export default function AboutScreen() {
  const router = useRouter();
  const { isTV } = useResponsive();

  const installed = getInstalledVersion();
  const versionText = installed.versionName
    ? `v${installed.versionName}${installed.versionCode ? ` (build ${installed.versionCode})` : ''}`
    : 'Tidak diketahui';

  const infoRows: { label: string; value: string }[] = [
    { label: 'Nama Aplikasi', value: 'DYRLIX TV' },
    { label: 'Pengembang', value: DEVELOPER_NAME },
    { label: 'Versi', value: versionText },
    {
      label: 'Paket',
      value: Application.applicationId ?? 'com.dyrlix.player',
    },
    { label: 'Platform', value: `Android, iOS, Web, Android TV, tvOS (${Platform.OS})` },
    { label: 'Mesin Pemutar', value: 'expo-video (HLS / progressive)' },
    { label: 'Sumber Playlist Bawaan', value: 'iptv-org public playlist' },
  ];

  const horizontalPadding = isTV ? spacing.xxl : spacing.lg;

  return (
    <Screen>
      <AppHeader title="Tentang Aplikasi" subtitle="Informasi, fitur, dan kredit" />

      <TVFocusGuide style={styles.grow}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, isTV && styles.heroTV]}>
            <Image
              source={require('../../assets/icon.png')}
              style={[styles.logo, isTV && styles.logoTV]}
              contentFit="contain"
            />
            <View style={styles.heroText}>
              <Text style={[styles.appName, { fontSize: isTV ? fontSize.hero : fontSize.xxl }]}>
                DYRLIX TV
              </Text>
              <Text style={styles.tagline}>
                Pemutar IPTV ringan dan cepat untuk HP, Web, dan Android TV.
              </Text>
              <View style={styles.versionPill}>
                <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
                <Text style={styles.versionPillText}>{versionText}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { fontSize: isTV ? fontSize.xl : fontSize.lg }]}>
            Fitur Unggulan
          </Text>
          <View style={styles.featureList}>
            {FEATURES.map((feature) => (
              <View key={feature.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon} size={isTV ? 26 : 22} color={colors.primary} />
                </View>
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDesc}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { fontSize: isTV ? fontSize.xl : fontSize.lg }]}>
            Detail Teknis
          </Text>
          <View style={styles.infoCard}>
            {infoRows.map((row, index) => (
              <View
                key={row.label}
                style={[styles.infoRow, index > 0 && styles.infoRowBorder]}
              >
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { fontSize: isTV ? fontSize.xl : fontSize.lg }]}>
            Pengembang
          </Text>
          <View style={styles.devCard}>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons
                  name="person-circle-outline"
                  size={isTV ? 26 : 22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>{DEVELOPER_NAME}</Text>
                <Text style={styles.featureDesc}>{DEVELOPER_ROLE} DYRLIX TV.</Text>
              </View>
            </View>
            <View style={styles.devLinks}>
              <AppButton
                title="GitHub"
                icon="logo-github"
                variant="secondary"
                style={styles.devLink}
                onPress={() => {
                  void Linking.openURL(GITHUB_URL);
                }}
              />
              <AppButton
                title="Email"
                icon="mail-outline"
                variant="secondary"
                style={styles.devLink}
                onPress={() => {
                  void Linking.openURL(`mailto:${CONTACT_EMAIL}`);
                }}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <AppButton
              title="Periksa Update"
              icon="cloud-download-outline"
              fullWidth
              large
              onPress={() => router.navigate('/update')}
            />
            <AppButton
              title="Kelola Playlist"
              icon="albums-outline"
              variant="secondary"
              fullWidth
              large
              onPress={() => router.navigate('/playlists')}
            />
          </View>

          {defaultManifestUrl() ? (
            <InfoBanner
              variant="info"
              title="Sumber Pembaruan"
              message={`Aplikasi memeriksa pembaruan dari manifest berikut:\n${defaultManifestUrl()}`}
            />
          ) : null}

          <InfoBanner
            variant="warning"
            title="Disclaimer"
            message="DYRLIX hanya menyediakan alat pemutar. Aplikasi ini tidak menyediakan, menyimpan, atau menyiarkan konten apa pun. Seluruh playlist dan stream dari pihak ketiga sepenuhnya menjadi tanggung jawab pengguna."
          />

          <Text style={styles.credit}>
            Dibuat oleh {DEVELOPER_NAME}
            {'\n'}Dibangun dengan Expo + React Native{'\n'}© {new Date().getFullYear()} DYRLIX TV
          </Text>
        </ScrollView>
      </TVFocusGuide>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  heroTV: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  logoTV: {
    width: 96,
    height: 96,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  appName: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  versionPillText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  featureList: {
    gap: spacing.md,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBody: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  featureDesc: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  infoRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  actions: {
    gap: spacing.md,
  },
  devCard: {
    gap: spacing.md,
  },
  devLinks: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  devLink: {
    flex: 1,
  },
  credit: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
