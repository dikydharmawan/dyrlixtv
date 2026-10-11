import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';

type BannerVariant = 'info' | 'warning' | 'danger';
type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface InfoBannerProps {
  message: string;
  title?: string;
  variant?: BannerVariant;
}

const VARIANT_CONFIG: Record<
  BannerVariant,
  { icon: IoniconName; color: string; background: string }
> = {
  info: { icon: 'information-circle', color: colors.primary, background: colors.primarySoft },
  warning: { icon: 'alert-circle', color: colors.accent, background: 'rgba(245, 158, 11, 0.16)' },
  danger: { icon: 'warning', color: colors.danger, background: colors.dangerSoft },
};

export function InfoBanner({ message, title, variant = 'info' }: InfoBannerProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <View style={[styles.container, { backgroundColor: config.background, borderColor: config.color }]}>
      <Ionicons name={config.icon} size={20} color={config.color} style={styles.icon} />
      <View style={styles.textWrap}>
        {title ? <Text style={[styles.title, { color: config.color }]}>{title}</Text> : null}
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    gap: spacing.sm,
  },
  icon: {
    marginTop: 2,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  message: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
