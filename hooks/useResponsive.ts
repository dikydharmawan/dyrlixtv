import { Platform, useWindowDimensions } from 'react-native';

import { layout } from '@/constants/theme';

export interface Responsive {
  width: number;
  height: number;
  /** True di Android TV / tvOS atau layar sangat lebar. */
  isTV: boolean;
  isLandscape: boolean;
  isTablet: boolean;
  /** Faktor skala untuk menyesuaikan ukuran teks/elemen. */
  scale: number;
  /** Jumlah kolom grid channel. */
  columns: number;
  /** Jarak antar item grid. */
  gutter: number;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  const isTV = Platform.isTV || width >= layout.tvBreakpoint;
  const isLandscape = width > height;
  const isTablet = width >= 768;
  const scale = isTV ? 1.25 : isTablet ? 1.1 : 1;

  let columns = 1;
  if (isTV) {
    if (width >= 1800) columns = 5;
    else if (width >= 1360) columns = 4;
    else columns = 3;
  } else {
    if (width >= 1024) columns = 3; // tablet landscape
    else if (width >= 720) columns = 2; // tablet portrait
    else columns = 1; // phone portrait/compact
  }

  return {
    width,
    height,
    isTV,
    isLandscape,
    isTablet,
    scale,
    columns,
    gutter: isTV ? 24 : 16,
  };
}
