import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { colors } from '@/constants/theme';

interface ScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Sisi yang diberi padding safe-area. Default: atas + kiri + kanan. */
  edges?: Edge[];
  padded?: boolean;
}

export function Screen({
  children,
  style,
  edges = ['top', 'left', 'right'],
  padded = false,
}: ScreenProps) {
  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      <View style={styles.backgroundWallpaper} pointerEvents="none">
        <Image
          source={require('../assets/icon.png')}
          style={styles.wallpaperImage}
          contentFit="contain"
        />
      </View>
      <View style={[styles.inner, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundWallpaper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.1,
    overflow: 'hidden',
  },
  wallpaperImage: {
    width: '75%',
    height: '75%',
  },
  inner: {
    flex: 1,
    zIndex: 1,
  },
  padded: {
    paddingHorizontal: 20,
  },
});
