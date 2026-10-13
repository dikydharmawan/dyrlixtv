import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { tvPrefFocus } from '@/components/Tv';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { addPlaylist } from '@/services/playlistStorage';
import type { PlaylistType } from '@/types';
import { parseM3U } from '@/utils/m3uParser';
import { goBack } from '@/utils/navigation';
import { isValidStreamUrl } from '@/utils/url';

type InputMode = PlaylistType | 'file';

export default function AddPlaylistScreen() {
  const router = useRouter();
  const { isTV } = useResponsive();

  const [mode, setMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const detectedChannels = useMemo(() => {
    if (mode === 'url' || !content.trim()) return 0;
    return parseM3U(content, 'preview').length;
  }, [mode, content]);

  const handlePickFile = useCallback(async () => {
    setError(null);
    setSuccess(null);
    try {
      setPicking(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      const text = asset.file
        ? await asset.file.text()
        : await FileSystem.readAsStringAsync(asset.uri);
      setContent(text);
      setFileName(asset.name || 'playlist.m3u');
      if (!text.trim()) {
        setError('File tersebut kosong atau tidak dapat dibaca.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membaca file. Coba file lain.');
    } finally {
      setPicking(false);
    }
  }, []);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (mode === 'content' || mode === 'file') {
      if (!content.trim()) {
        setError(
          mode === 'file'
            ? 'Pilih file M3U terlebih dahulu.'
            : 'Isi teks M3U tidak boleh kosong.',
        );
        return;
      }
    } else {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        setError('Tautan playlist tidak boleh kosong.');
        return;
      }
      if (!isValidStreamUrl(trimmedUrl)) {
        setError('Format tautan tidak valid. Contoh: https://contoh.com/playlist.m3u');
        return;
      }
    }

    setSaving(true);
    try {
      const playlist = await addPlaylist({
        mode: mode === 'url' ? 'url' : 'content',
        url,
        content,
        name,
      });
      setSuccess(`Playlist "${playlist.name}" berhasil disimpan.`);
      setUrl('');
      setContent('');
      setFileName('');
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan playlist.');
    } finally {
      setSaving(false);
    }
  };

  const inputTextSize = isTV ? fontSize.lg : fontSize.md;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <AppHeader title="Tambah Playlist" subtitle="Format M3U / M3U8" onBack={() => goBack(router)} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SegmentedControl
            options={[
              { key: 'url', label: 'Tautan URL' },
              { key: 'content', label: 'Tempel Teks' },
              { key: 'file', label: 'Pilih File' },
            ]}
            value={mode}
            onChange={setMode}
          />

          {mode === 'content' ? (
            <>
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Isi File M3U</Text>
                  {detectedChannels > 0 ? (
                    <Text style={styles.detected}>Terbaca {detectedChannels} channel</Text>
                  ) : null}
                </View>
                <TextInput
                  value={content}
                  onChangeText={(text) => {
                    setContent(text);
                    if (error) setError(null);
                  }}
                  placeholder={'#EXTM3U\n#EXTINF:-1,...,Channel 1\nhttps://…/stream.m3u8'}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={10}
                  textAlignVertical="top"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, styles.contentInput, { fontSize: inputTextSize }]}
                />
              </View>
              <InfoBanner
                variant="info"
                message="Mode ini tidak membutuhkan akses jaringan, sehingga aman dari blokir CORS dan langsung bisa dibuka di Web, HP, maupun Android TV."
              />
            </>
          ) : mode === 'file' ? (
            <>
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>File M3U dari Perangkat</Text>
                  {detectedChannels > 0 ? (
                    <Text style={styles.detected}>Terbaca {detectedChannels} channel</Text>
                  ) : null}
                </View>
                <AppButton
                  title={content ? fileName || 'File dipilih' : 'Pilih File M3U…'}
                  icon={content ? 'document-text-outline' : 'folder-open-outline'}
                  variant="secondary"
                  large
                  fullWidth
                  loading={picking}
                  onPress={handlePickFile}
                  tvFocus={tvPrefFocus(true)}
                />
                {content ? (
                  <View style={styles.filePreview}>
                    <Text style={styles.filePreviewLine} numberOfLines={5}>
                      {content.slice(0, 240).trim()}
                    </Text>
                    <Text style={styles.filePreviewHint}>
                      {detectedChannels > 0
                        ? `${detectedChannels} channel siap disimpan. Tekan "Pilih File M3U…" untuk mengganti.`
                        : 'File terbaca, tetapi tidak ada channel yang dikenali. Pastikan format M3U benar.'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <InfoBanner
                variant="info"
                message="Pilih file .m3u/.m3u8 dari unduhan, flashdisk, atau penyimpanan perangkat. Isinya dibaca lokal tanpa jaringan, jadi aman dari blokir CORS."
              />
            </>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>Tautan Playlist *</Text>
              <TextInput
                value={url}
                onChangeText={(text) => {
                  setUrl(text);
                  if (error) setError(null);
                }}
                placeholder="https://contoh.com/playlist.m3u"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                inputMode="url"
                style={[styles.input, { fontSize: inputTextSize }]}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Nama Playlist (opsional)</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Contoh: Channel TV Indonesia"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              style={[styles.input, { fontSize: inputTextSize }]}
            />
          </View>

          {error ? <InfoBanner variant="danger" title="Gagal" message={error} /> : null}
          {success ? <InfoBanner variant="info" title="Berhasil" message={success} /> : null}

          <AppButton
            title="Simpan Playlist"
            icon="save-outline"
            large
            fullWidth
            loading={saving}
            onPress={handleSave}
          />

          {success ? (
            <AppButton
              title="Buka Playlist Saya"
              icon="albums-outline"
              variant="secondary"
              large
              fullWidth
              onPress={() => router.replace('/playlists')}
            />
          ) : (
            <AppButton
              title="Batal"
              variant="ghost"
              large
              fullWidth
              onPress={() => goBack(router)}
            />
          )}

          <InfoBanner
            variant="warning"
            title="Disclaimer"
            message="Dengan menyimpan playlist, Anda menyatakan memiliki hak atau izin atas tautan tersebut. Seluruh konten pihak ketiga sepenuhnya menjadi tanggung jawab pengguna. Aplikasi ini hanya alat pemutar dan tidak menyediakan konten apa pun."
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detected: {
    color: colors.success,
    fontSize: fontSize.sm,
    fontWeight: '700',
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
  contentInput: {
    minHeight: 220,
    fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
    lineHeight: 22,
  },
  filePreview: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  filePreviewLine: {
    color: colors.textMuted,
    fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  filePreviewHint: {
    color: colors.text,
    fontSize: fontSize.sm,
  },
});