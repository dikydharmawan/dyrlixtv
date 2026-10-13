export const colors = {
  background: '#121212',
  backgroundAlt: '#181818',
  surface: '#1E1E1E',
  surfaceAlt: '#2A2A2A',
  border: '#383838',
  borderFocus: '#38BDF8',
  primary: '#38BDF8',
  primaryDark: '#0284C7',
  accent: '#F59E0B',
  danger: '#EF4444',
  success: '#22C55E',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  dangerSoft: 'rgba(239, 68, 68, 0.16)',
  primarySoft: 'rgba(56, 189, 248, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.8)',
  black: '#000000',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 34,
  hero: 42,
} as const;

export const layout = {
  /** Lebar layar yang dianggap TV / layar besar. */
  tvBreakpoint: 1000,
} as const;

export type ColorName = keyof typeof colors;
