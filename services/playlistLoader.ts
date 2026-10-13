import type { Channel, Playlist } from '@/types';
import { extractEpgUrl, parseM3U } from '@/utils/m3uParser';

const FETCH_TIMEOUT_MS = 20000;

export interface PlaylistData {
  channels: Channel[];
  /** URL guide EPG (XMLTV) dari header `x-tvg-url`, bila ada. */
  epgUrl: string | null;
}

function buildData(m3u: string, playlistId: string): PlaylistData {
  const channels = parseM3U(m3u, playlistId);
  if (channels.length === 0) {
    throw new Error('Playlist tidak berisi channel yang valid.');
  }
  return { channels, epgUrl: extractEpgUrl(m3u) };
}

async function fetchPlaylistText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`Server menolak permintaan (HTTP ${response.status}).`);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Koneksi habis waktu. Periksa jaringan lalu coba lagi.');
    }
    if (error instanceof TypeError) {
      throw new Error('Tidak dapat terhubung ke tautan. Periksa URL atau koneksi internet.');
    }
    throw error instanceof Error ? error : new Error('Gagal memuat playlist.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Titik masuk untuk memuat channel dari sebuah Playlist beserta URL EPG-nya.
 * - `type === 'content'` → parse teks yang ditempel langsung (bebas CORS).
 * - `type === 'url'`     → unduh file M3U/M3U8 lalu parse.
 */
export async function loadPlaylistData(playlist: Playlist): Promise<PlaylistData> {
  if (playlist.type === 'content' && playlist.content) {
    return buildData(playlist.content, playlist.id);
  }
  const text = await fetchPlaylistText(playlist.url);
  return buildData(text, playlist.id);
}

/** Tetap tersedia untuk pemanggil lama yang hanya butuh daftar channel. */
export async function loadPlaylistChannels(playlist: Playlist): Promise<Channel[]> {
  const { channels } = await loadPlaylistData(playlist);
  return channels;
}
