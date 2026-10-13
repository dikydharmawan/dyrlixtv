import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { getInstalledVersion } from '@/services/updateManager';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type NavRoute = '/' | '/playlists' | '/update' | '/about';

interface NavItem {
  route: NavRoute;
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
}

const NAV_ITEMS: NavItem[] = [
  { route: '/', label: 'Beranda', icon: 'tv-outline', activeIcon: 'tv' },
  { route: '/playlists', label: 'Playlist Saya', icon: 'albums-outline', activeIcon: 'albums' },
  {
    route: '/update',
    label: 'Update',
    icon: 'cloud-download-outline',
    activeIcon: 'cloud-download',
  },
  {
    route: '/about',
    label: 'Tentang',
    icon: 'information-circle-outline',
    activeIcon: 'information-circle',
  },
];

/** Jam berjalan ala status bar OTT Navigator. */
function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Navigasi kiri bergaya "Ott Navigator": panel tetap berisi brand, daftar
 * menu, dan status jam. Menyempit menjadi rail ikon di layar kecil.
 */
export function SideNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { isTV, isTablet, isLandscape } = useResponsive();
  const now = useClock();

  const expanded = isTV || isTablet || isLandscape;
  const installed = getInstalledVersion();
  const versionLabel = installed.versionName ? `v${installed.versionName}` : 'versi ?';
  const iconSize = isTV ? 28 : 24;

  const isActive = (route: NavRoute) => pathname === route;

  return (
    <SafeAreaView
      style={[styles.safe, expanded ? styles.safeWide : styles.safeNarrow]}
      edges={['top', 'bottom', 'left']}
    >
      <View style={[styles.brand, !expanded && styles.brandNarrow]}>
        <View style={styles.logoBadge}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logoBadgeImage}
            contentFit="contain"
          />
        </View>
        {expanded ? (
          <View style={styles.brandTextWrap}>
            <Text style={styles.brandText}>DYRLIX</Text>
            <Text style={styles.brandSub}>TV PLAYER</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.items}>
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.route}
            item={item}
            active={isActive(item.route)}
            expanded={expanded}
            iconSize={iconSize}
            onPress={() => {
              if (!isActive(item.route)) router.navigate(item.route);
            }}
          />
        ))}
      </View>

      <View style={[styles.footer, !expanded && styles.footerNarrow]}>
        {expanded ? (
          <View style={styles.clockWrap}>
            <Text style={styles.clock}>{formatClock(now)}</Text>
            <Text style={styles.clockDate}>{formatDate(now)}</Text>
          </View>
        ) : (
          <Ionicons name="time-outline" size={20} color={colors.textMuted} />
        )}
        <View style={[styles.statusRow, !expanded && styles.statusRowNarrow]}>
          <View style={styles.liveDot} />
          {expanded ? <Text style={styles.statusText}>LIVE</Text> : null}
          <Text style={styles.version} numberOfLines={1}>
            {expanded ? versionLabel : ''}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

interface NavButtonProps {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  iconSize: number;
  onPress: () => void;
}

function NavButton({ item, active, expanded, iconSize, onPress }: NavButtonProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      focusable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.item,
        !expanded && styles.itemNarrow,
        active && styles.itemActive,
        focused && !active && styles.itemFocused,
        pressed && styles.itemPressed,
      ]}
    >
      {active ? <View style={styles.activeBar} /> : null}
      <Ionicons
        name={active || focused ? item.activeIcon : item.icon}
        size={iconSize}
        color={active ? colors.primary : focused ? colors.text : colors.textMuted}
      />
      {expanded ? (
        <Text
          style={[styles.itemLabel, active && styles.itemLabelActive]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const EXPANDED_WIDTH = 248;
const NARROW_WIDTH = 84;

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.backgroundAlt,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    justifyContent: 'space-between',
  },
  safeWide: {
    width: EXPANDED_WIDTH,
  },
  safeNarrow: {
    width: NARROW_WIDTH,
    paddingHorizontal: spacing.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  brandNarrow: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoBadgeImage: {
    width: '100%',
    height: '100%',
  },
  brandTextWrap: {
    flexShrink: 1,
  },
  brandText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandSub: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 2,
  },
  items: {
    flex: 1,
    gap: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemNarrow: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  itemActive: {
    backgroundColor: colors.primarySoft,
  },
  itemFocused: {
    borderColor: colors.borderFocus,
    backgroundColor: colors.surfaceAlt,
  },
  itemPressed: {
    opacity: 0.85,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  itemLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  itemLabelActive: {
    color: colors.primary,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerNarrow: {
    alignItems: 'center',
  },
  clockWrap: {
    gap: 2,
  },
  clock: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
    letterSpacing: 1,
  },
  clockDate: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusRowNarrow: {
    justifyContent: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  statusText: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: '900',
    letterSpacing: 1,
  },
  version: {
    marginLeft: 'auto',
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
