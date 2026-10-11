import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Playlist, PlaylistType } from '@/types';
import { parseM3U } from '@/utils/m3uParser';
import { deriveNameFromUrl, isValidStreamUrl } from '@/utils/url';

const STORAGE_KEY = '@iptv_player/playlists:v1';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Mengubah data mentah dari storage menjadi Playlist yang valid (backward compatible). */
function normalizePlaylist(value: unknown): Playlist | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.addedAt !== 'number'
  ) {
    return null;
  }

  const type: PlaylistType = candidate.type === 'content' ? 'content' : 'url';

  return {
    id: candidate.id,
    name: candidate.name,
    url: typeof candidate.url === 'string' ? candidate.url : '',
    addedAt: candidate.addedAt,
    type,
    content: typeof candidate.content === 'string' ? candidate.content : undefined,
    channelCount:
      typeof candidate.channelCount === 'number' ? candidate.channelCount : undefined,
  };
}

/** Mengambil seluruh playlist pengguna, terbaru lebih dulu. */
export async function getPlaylists(): Promise<Playlist[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const playlists = parsed
      .map(normalizePlaylist)
      .filter((item): item is Playlist => item !== null);

    return playlists.sort((a, b) => b.addedAt - a.addedAt);
  } catch (error) {
    console.warn('[playlistStorage] gagal membaca data playlist', error);
    return [];
  }
}

export interface AddPlaylistInput {
  mode: PlaylistType;
  /** Dibutuhkan untuk mode `url`. */
  url?: string;
  /** Dibutuhkan untuk mode `content`. */
  content?: string;
  name?: string;
}

/** Menambahkan playlist baru (URL atau tempel teks) setelah divalidasi. */
export async function addPlaylist(input: AddPlaylistInput): Promise<Playlist> {
  const name = input.name?.trim() || undefined;
  const existing = await getPlaylists();

  if (input.mode === 'content') {
    const content = input.content?.trim();
    if (!content) {
      throw new Error('Isi teks M3U tidak boleh kosong.');
    }

    const parsed = parseM3U(content, 'preview');
    if (parsed.length === 0) {
      throw new Error('Teks tidak mengandung channel M3U yang valid (butuh baris #EXTINF + URL stream).');
    }

    if (existing.some((item) => item.type === 'content' && item.content === content)) {
      throw new Error('Playlist dengan isi yang sama sudah tersimpan.');
    }

    const playlist: Playlist = {
      id: generateId(),
      name: name || `${parsed.length} channel (tempel)`,
      url: '',
      addedAt: Date.now(),
      type: 'content',
      content,
      channelCount: parsed.length,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([playlist, ...existing]));
    return playlist;
  }

  const url = input.url?.trim() ?? '';
  if (!url) {
    throw new Error('Tautan playlist tidak boleh kosong.');
  }
  if (!isValidStreamUrl(url)) {
    throw new Error('Tautan tidak valid. Gunakan URL http(s) yang benar.');
  }
  if (existing.some((item) => item.url === url)) {
    throw new Error('Playlist dengan tautan ini sudah tersimpan.');
  }

  const playlist: Playlist = {
    id: generateId(),
    name: name || deriveNameFromUrl(url),
    url,
    addedAt: Date.now(),
    type: 'url',
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([playlist, ...existing]));
  return playlist;
}

/** Menghapus playlist berdasarkan id dan mengembalikan daftar terbaru. */
export async function removePlaylist(id: string): Promise<Playlist[]> {
  const playlists = await getPlaylists();
  const next = playlists.filter((item) => item.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function getPlaylistById(id: string): Promise<Playlist | undefined> {
  const playlists = await getPlaylists();
  return playlists.find((item) => item.id === id);
}
