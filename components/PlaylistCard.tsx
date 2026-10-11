import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { tvPrefFocus } from '@/components/Tv';
import type { Playlist } from '@/types';
import { formatDate } from '@/utils/format';

interface PlaylistCardProps {
  playlist: Playlist;
  onOpen: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
  busy?: boolean;
  /** Kartu pertama (memberi fokus awal ke tombol "Buka" di TV). */
  firstFocus?: boolean;
}

export function PlaylistCard({
  playlist,
  onOpen,
  onDelete,
  busy = false,
  firstFocus = false,
}: PlaylistCardProps) {
  const { isTV } = useResponsive();
  const isContent = playlist.type === 'content';

  const subtitle = isContent
    ? `${playlist.channelCount ?? '?'} channel — isi teks`
    : playlist.url;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={isContent ? 'document-text-outline' : 'link-outline'}
            size={isTV ? 30 : 24}
            color={colors.primary}
          />
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, { fontSize: isTV ? fontSize.lg : fontSize.md }]}
              numberOfLines={1}
            >
              {playlist.name}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{isContent ? 'TEMPEL' : 'URL'}</Text>
            </View>
          </View>
          <Text style={styles.url} numberOfLines={1}>
            {subtitle}
          </Text>
          <Text style={styles.date}>Ditambahkan {formatDate(playlist.addedAt)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton
          title="Buka"
          icon="play"
          onPress={() => onOpen(playlist)}
          disabled={busy}
          style={styles.openButton}
          tvFocus={firstFocus ? tvPrefFocus(true) : undefined}
        />
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <AppButton
            title="Hapus"
            icon="trash-outline"
            variant="danger"
            onPress={() => onDelete(playlist)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontWeight: '800',
    flexShrink: 1,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  url: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  date: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  openButton: {
    flex: 1,
  },
  busy: {
    minHeight: 48,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
});