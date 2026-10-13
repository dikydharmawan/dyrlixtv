import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SideNav } from '@/components/SideNav';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <View style={styles.root}>
      <SideNav />
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
});
