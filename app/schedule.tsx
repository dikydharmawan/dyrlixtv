import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useEpg } from '@/hooks/useEpg';
import { getSchedule, isLiveTitle, type EpgProgramme } from '@/services/epg';
import { goBack } from '@/utils/navigation';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatTime(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sectionTitle(dayStart: number, today: number): string {
  const diffDays = Math.round((dayStart - today) / 86400000);
  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Besok';
  const date = new Date(dayStart);
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

function useNow(intervalMs = 60000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export default function ScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tvgId?: string; name?: string }>();
  const tvgId = typeof params.tvgId === 'string' ? params.tvgId : '';
  const name = (typeof params.name === 'string' && params.name) || 'Jadwal Tayang';
  const guide = useEpg();
  const now = useNow();

  const programmes = useMemo(() => {
    if (!guide) return [] as EpgProgramme[];
    return getSchedule(tvgId);
  }, [guide, tvgId]);

  const today = startOfDay(now);

  const sections = useMemo(() => {
    const map = new Map<number, EpgProgramme[]>();
    for (const programme of programmes) {
      const key = startOfDay(programme.start);
      const list = map.get(key);
      if (list) list.push(programme);
      else map.set(key, [programme]);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayStart, data]) => ({ title: sectionTitle(dayStart, today), data }));
  }, [programmes, today]);

  return (
    <Screen>
      <AppHeader title={name} subtitle="Jadwal tayang" onBack={() => goBack(router)} />
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.start}-${index}`}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const isNow = item.start <= now && now < item.stop;
          return (
            <View style={[styles.row, isNow && styles.rowNow]}>
              <View style={styles.timeCol}>
                <Text style={[styles.time, isNow && styles.timeNow]}>{formatTime(item.start)}</Text>
                <Text style={styles.timeEnd}>{formatTime(item.stop)}</Text>
              </View>
              <View style={styles.infoCol}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {isNow ? (
                    <Text style={styles.liveTag}>
                      {isLiveTitle(item.title) ? '● LIVE' : '● SEDANG TAYANG'}
                    </Text>
                  ) : null}
                </View>
                {item.description ? (
                  <Text style={styles.description} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="calendar-outline"
              title={guide ? 'Jadwal tidak tersedia' : 'Memuat jadwal…'}
              description={
                guide
                  ? 'Channel ini belum punya data jadwal tayang pada sumber EPG. Coba channel lain atau segarkan playlist.'
                  : 'Sedang mengambil panduan acara dari sumber EPG.'
              }
            />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  rowNow: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  timeCol: {
    width: 64,
  },
  time: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  timeNow: {
    color: colors.primary,
  },
  timeEnd: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
    flex: 1,
  },
  liveTag: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  description: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 2,
  },
  emptyWrap: {
    marginTop: spacing.xxl,
  },
});
