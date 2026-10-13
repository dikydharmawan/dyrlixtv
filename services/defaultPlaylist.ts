import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_CHANNELS, DEFAULT_PLAYLIST_URL } from '@/constants/channels';
import type { Channel } from '@/types';
import { extractEpgUrl, parseM3U } from '@/utils/m3uParser';

const CACHE_KEY = '@iptv_player/default_playlist:v3';
/** Umur cache: 30 menit sebelum mencoba menyegarkan dari jaringan. */
const STALE_MS = 30 * 60 * 1000;

interface CacheEntry {
  channels: Channel[];
  epgUrl: string | null;
  fetchedAt: number;
}

export interface DefaultPlaylist {
  channels: Channel[];
  /** URL guide EPG (XMLTV) dari header `x-tvg-url`, bila ada. */
  epgUrl: string | null;
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
export async function loadDefaultPlaylist(force = false): Promise<DefaultPlaylist> {
  const cached = await readCache();
  const freshEnough = cached && Date.now() - cached.fetchedAt < STALE_MS;

  if (!force && freshEnough && cached) {
    return { channels: cached.channels, epgUrl: cached.epgUrl ?? null };
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
    const epgUrl = extractEpgUrl(text);
    await writeCache({ channels, epgUrl, fetchedAt: Date.now() });
    return { channels, epgUrl };
  } catch {
    if (cached) {
      return { channels: cached.channels, epgUrl: cached.epgUrl ?? null };
    }
    return { channels: DEFAULT_CHANNELS.slice(), epgUrl: null };
  }
}

/** Versi ringkas yang hanya mengembalikan daftar channel. */
export async function loadDefaultChannels(force = false): Promise<Channel[]> {
  const { channels } = await loadDefaultPlaylist(force);
  return channels;
}
