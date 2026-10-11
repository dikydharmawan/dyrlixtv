import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_CHANNELS, DEFAULT_PLAYLIST_URL } from '@/constants/channels';
import type { Channel } from '@/types';
import { parseM3U } from '@/utils/m3uParser';

const CACHE_KEY = '@iptv_player/default_playlist:v1';
/** Umur cache: 30 menit sebelum mencoba menyegarkan dari jaringan. */
const STALE_MS = 30 * 60 * 1000;

interface CacheEntry {
  channels: Channel[];
  fetchedAt: number;
}

async function readCache(): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheEntry) : null;
  } catch {
    return null;
  }
}

async function writeCache(entry: CacheEntry): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // cache gagal tersimpan bukan masalah fatal
  }
}

/**
 * Memuat channel bawaan dari `DEFAULT_PLAYLIST_URL`.
 * Fail-safe: pakai cache (bila masih segar), lalu cache lama, lalu channel contoh.
 */
export async function loadDefaultChannels(force = false): Promise<Channel[]> {
  const cached = await readCache();
  const freshEnough = cached && Date.now() - cached.fetchedAt < STALE_MS;

  if (!force && freshEnough && cached) {
    return cached.channels;
  }

  try {
    const res = await fetch(DEFAULT_PLAYLIST_URL, {
      headers: { accept: 'text/plain,*/*' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    const channels = parseM3U(text, 'bawaan');
    if (channels.length === 0) {
      throw new Error('Playlist bawaan kosong.');
    }
    await writeCache({ channels, fetchedAt: Date.now() });
    return channels;
  } catch {
    if (cached) {
      return cached.channels;
    }
    return DEFAULT_CHANNELS.slice();
  }
}