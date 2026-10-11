import type { Channel, Playlist } from '@/types';
import { parseM3U } from '@/utils/m3uParser';

const FETCH_TIMEOUT_MS = 20000;

/**
 * Titik masuk untuk memuat channel dari sebuah Playlist.
 * - `type === 'content'`  → parse teks yang ditempel langsung (bebas CORS).
 * - `type === 'url'`      → unduh file M3U/M3U8 lalu parse.
 */
export async function loadPlaylistChannels(playlist: Playlist): Promise<Channel[]> {
  if (playlist.type === 'content' && playlist.content) {
    const channels = parseM3U(playlist.content, playlist.id);
    if (channels.length === 0) {
      throw new Error('Playlist tidak berisi channel yang valid.');
    }
    return channels;
  }

  return fetchPlaylistChannels(playlist.id, playlist.url);
}

/**
 * Mengunduh file M3U/M3U8 dari URL lalu mengubahnya menjadi daftar Channel.
 *
 * Catatan Web: sebagian server tidak mengizinkan permintaan lintas domain (CORS),
 * sehingga pemuatan playlist bisa gagal di browser. Gunakan mode "Tempel Teks M3U"
 * untuk playlist yang diblokir, atau sekadar buka playlist di Android/iOS.
 */
export async function fetchPlaylistChannels(
  playlistId: string,
  url: string,
): Promise<Channel[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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

    const text = await response.text();
    const channels = parseM3U(text, playlistId);

    if (channels.length === 0) {
      throw new Error('Playlist tidak berisi channel yang valid.');
    }

    return channels;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Koneksi habis waktu. Periksa jaringan lalu coba lagi.');
    }
    if (error instanceof TypeError) {
      throw new Error('Tidak dapat terhubung ke tautan. Periksa URL atau koneksi internet.');
    }
    throw error instanceof Error ? error : new Error('Gagal memuat playlist.');
  } finally {
    clearTimeout(timeoutId);
  }
}
