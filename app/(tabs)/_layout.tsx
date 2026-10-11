import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { colors } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';

export default function TabsLayout() {
  const { isTV } = useResponsive();
  const iconSize = isTV ? 30 : 24;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: isTV ? 88 : 64,
          paddingTop: 6,
          paddingBottom: isTV ? 14 : 8,
        },
        tabBarLabelStyle: {
          fontSize: isTV ? 16 : 12,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'tv' : 'tv-outline'} size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="playlists"
        options={{
          title: 'Playlist Saya',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'albums' : 'albums-outline'} size={iconSize} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
