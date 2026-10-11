import {
  Platform,
  TVFocusGuideView,
  View,
  type FocusDestination,
  type ViewProps,
} from 'react-native';

export type TVFocusDestination = FocusDestination;

export type TVFocusDirection = 'up' | 'down' | 'left' | 'right' | 'forward';

/** Properti fokus TV yang aman disebar ke Pressable/View mana pun. */
export interface TVFocusProps {
  hasTVPreferredFocus?: boolean;
  nextFocusDown?: TVFocusDestination;
  nextFocusUp?: TVFocusDestination;
  nextFocusLeft?: TVFocusDestination;
  nextFocusRight?: TVFocusDestination;
  nextFocusForward?: TVFocusDestination;
}

/** True hanya saat berjalan di perangkat TV (Android TV / tvOS). */
export function isTV(): boolean {
  return Platform.isTV === true;
}

/** {} di non-TV; di TV mengembalikan hasTVPreferredFocus (fokus awal layar). */
export function tvPrefFocus(active = true): TVFocusProps {
  if (!isTV()) return {};
  return { hasTVPreferredFocus: active };
}

/** {} di non-TV; di TV mengembalikan prop nextFocus<Arah> ke destination. */
export function tvNextFocus(
  direction: TVFocusDirection,
  destination: TVFocusDestination,
): TVFocusProps {
  if (!isTV()) return {};
  const suffix = direction === 'forward' ? 'Forward' : capitalize(direction);
  const key = `nextFocus${suffix}`;
  return { [key]: destination } as TVFocusProps;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type TVFocusGuideProps = ViewProps & {
  /** Redirect fokus ke anak yang dapat difokus pertama saat pertama kali dikunjungi. */
  autoFocus?: boolean;
  /** Sembunyikan focus guide. Default: true. */
  enabled?: boolean;
  trapFocusUp?: boolean;
  trapFocusDown?: boolean;
  trapFocusLeft?: boolean;
  trapFocusRight?: boolean;
};

/**
 * Pembatas fokus lintas platform. Di TV membungkus anak dengan TVFocusGuideView;
 * di web/HP fallback ke View biasa sehingga prop TV aman dipakai di mana saja.
 */
export function TVFocusGuide({
  autoFocus,
  enabled,
  trapFocusUp,
  trapFocusDown,
  trapFocusLeft,
  trapFocusRight,
  children,
  ...props
}: TVFocusGuideProps) {
  if (!isTV()) {
    return <View {...props}>{children}</View>;
  }
  return (
    <TVFocusGuideView
      autoFocus={autoFocus}
      enabled={enabled}
      trapFocusUp={trapFocusUp}
      trapFocusDown={trapFocusDown}
      trapFocusLeft={trapFocusLeft}
      trapFocusRight={trapFocusRight}
      {...props}
    >
      {children}
    </TVFocusGuideView>
  );
}