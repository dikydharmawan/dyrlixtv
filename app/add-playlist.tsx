import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { addPlaylist } from '@/services/playlistStorage';
import type { PlaylistType } from '@/types';
import { parseM3U } from '@/utils/m3uParser';
import { isValidStreamUrl } from '@/utils/url';

type Mode = PlaylistType;

export default function AddPlaylistScreen() {
  const router = useRouter();
  const { isTV } = useResponsive();

  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const detectedChannels = useMemo(() => {
    if (mode !== 'content' || !content.trim()) return 0;
    return parseM3U(content, 'preview').length;
  }, [mode, content]);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (mode === 'content') {
      if (!content.trim()) {
        setError('Isi teks M3U tidak boleh kosong.');
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
      const playlist = await addPlaylist({ mode, url, content, name });
      setSuccess(`Playlist "${playlist.name}" berhasil disimpan.`);
      setUrl('');
      setContent('');
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
      <AppHeader title="Tambah Playlist" subtitle="Format M3U / M3U8" onBack={() => router.back()} />

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
              { key: 'content', label: 'Tempel Teks M3U' },
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
              onPress={() => router.back()}
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
});