import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Screen } from '@/components/Screen';
import { TVFocusGuide, tvPrefFocus } from '@/components/Tv';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import {
  checkForUpdates,
  defaultManifestUrl,
  downloadAndInstall,
  getInstalledVersion,
  openInstallPermissionSettings,
  type UpdateManifest,
  type UpdateResult,
} from '@/services/updateManager';

const MANIFEST_URL_KEY = '@iptv_player/update_manifest_url:v1';

export default function UpdateScreen() {
  const { isTV } = useResponsive();
  const isAndroid = Platform.OS === 'android';

  const [manifestUrl, setManifestUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [pendingManifest, setPendingManifest] = useState<UpdateManifest | null>(null);

  const installed = getInstalledVersion();

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await AsyncStorage.getItem(MANIFEST_URL_KEY);
      if (active) {
        setManifestUrl(stored ?? defaultManifestUrl());
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const persistUrl = useCallback((text: string) => {
    setManifestUrl(text);
    void AsyncStorage.setItem(MANIFEST_URL_KEY, text);
  }, []);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    setResult(null);
    setPendingManifest(null);
    const res = await checkForUpdates(manifestUrl);
    setResult(res);
    setPendingManifest(res.status === 'ok' && res.available ? res.manifest ?? null : null);
    setChecking(false);
  }, [manifestUrl]);

  const handleInstall = useCallback(async () => {
    if (!pendingManifest) return;
    setInstalling(true);
    setResult(null);
    const res = await downloadAndInstall(pendingManifest);
    setResult(res);
    setInstalling(false);
  }, [pendingManifest]);

  const inputTextSize = isTV ? fontSize.lg : fontSize.md;
  const checkedOk = result?.status === 'ok' && !result.available;

  return (
    <Screen>
      <AppHeader
        title="Update Aplikasi"
        subtitle={
          installed.versionName
            ? `Terpasang v${installed.versionName}${installed.versionCode ? ` (${installed.versionCode})` : ''}`
            : 'Versi tidak diketahui'
        }
      />

      <TVFocusGuide style={styles.grow}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Text style={styles.label}>URL Manifest Update</Text>
            <TextInput
              value={manifestUrl}
              onChangeText={persistUrl}
              placeholder="https://host-anda.com/dyrlix/update.json"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputMode="url"
              style={[styles.input, { fontSize: inputTextSize }]}
            />
<Text style={styles.hint}>
              {'File update.json berisi versi terbaru dan tautan APK. Contoh: { "versionCode": 2, "apkUrl": "..." }'}
            </Text>
          </View>

          <AppButton
            title={checking ? 'Memeriksa…' : 'Periksa Update'}
            icon="cloud-download-outline"
            large
            fullWidth
            loading={checking}
            disabled={installing || !manifestUrl.trim()}
            onPress={handleCheck}
            tvFocus={tvPrefFocus(true)}
          />

          {result?.status === 'error' ? (
            <InfoBanner variant="danger" title="Gagal Memeriksa" message={result.message} />
          ) : null}

          {checkedOk ? (
            <InfoBanner variant="info" title="Terbaru" message="Aplikasi sudah dalam versi terbaru." />
          ) : null}

          {result?.status === 'ok' && result.available && pendingManifest ? (
            <View style={styles.updateBlock}>
              <InfoBanner
                variant="warning"
                title={`Update v${pendingManifest.versionName} Tersedia`}
                message={
                  pendingManifest.notes ??
                  `Versi terpasang lebih lama dari v${pendingManifest.versionName} (code ${pendingManifest.versionCode}).`
                }
              />
              <AppButton
                title={installing ? 'Menyiapkan…' : 'Unduh & Pasang'}
                icon="download-outline"
                large
                fullWidth
                loading={installing}
                onPress={handleInstall}
              />
            </View>
          ) : null}

          {isAndroid ? (
            <AppButton
              title="Buka Izin Instal Aplikasi"
              icon="shield-checkmark-outline"
              variant="secondary"
              large
              fullWidth
              onPress={() => {
                void openInstallPermissionSettings();
              }}
            />
          ) : null}

          <InfoBanner
            variant="warning"
            title="Perhatian"
            message="Pembaruan diunduh dari server milik Anda (URL manifest di atas) lalu dipasang lewat installer sistem Android. Pastikan perangkat mengizinkan 'Instal aplikasi tidak dikenal' untuk DYRLIX. Seluruh APK hanya boleh berasal dari server tepercaya Anda."
          />
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  updateBlock: {
    gap: spacing.lg,
  },
});