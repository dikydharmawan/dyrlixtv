import type { Channel } from '@/types';

interface PlaybackQueue {
  channels: Channel[];
  index: number;
}

/**
 * Antrian channel in-memory yang dipakai pemutar untuk berpindah ke channel
 * berikutnya/sebelumnya (next/prev). Diisi oleh layar daftar sebelum membuka
 * pemutar; tidak perlu persisted karena hanya berlaku untuk sesi tonton.
 */
let queue: PlaybackQueue | null = null;

export function setPlaybackQueue(channels: Channel[], index: number): void {
  queue = { channels, index: index >= 0 ? index : 0 };
}

export function getPlaybackQueue(): PlaybackQueue | null {
  return queue;
}
