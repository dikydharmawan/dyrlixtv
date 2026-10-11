import { isValidStreamUrl } from '@/utils/url';

export type StreamCheck = 'ok' | 'dead' | 'network' | 'invalid';

export interface StreamCheckItem {
  id: string;
  url: string;
  headers?: Record<string, string>;
}

export interface StreamCheckResult {
  id: string;
  status: StreamCheck;
}

/**
 * Pengecekan cepat ketersediaan stream.
 * Hanya 404/410 yang dianggap PASTI mati; 4xx lain (403/401) belum tentu
 * karena pemutar asli mungkin tetap bisa memutar dengan token.
 */
export async function checkStream(
  url: string,
  timeoutMs = 8000,
  headers?: Record<string, string>,
): Promise<StreamCheck> {
  if (!isValidStreamUrl(url)) return 'invalid';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: '*/*', ...headers },
      signal: controller.signal,
    });
    // Status headers sudah cukup; hentikan unduhan body supaya hemat kuota.
    controller.abort();
    if (res.status === 404 || res.status === 410) return 'dead';
    return 'ok';
  } catch {
    return 'network';
  } finally {
    clearTimeout(timer);
  }
}

/** Cek banyak channel sekaligus dengan batas konkurensi (hindari akses berlebihan ke server). */
export async function checkStreams(
  items: StreamCheckItem[],
  concurrency = 8,
  timeoutMs = 8000,
): Promise<StreamCheckResult[]> {
  const results: StreamCheckResult[] = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      const item = items[i];
      results[i] = {
        id: item.id,
        status: await checkStream(item.url, timeoutMs, item.headers),
      };
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/** Terjemahkan pesan error mentah pemutar menjadi pesan yang ramah. */
export function friendlyStreamError(raw: unknown): string | null {
  const message = (raw as { message?: unknown } | null)?.message;
  if (typeof message !== 'string' || !message) return null;
  if (/404/.test(message)) {
    return 'Kanal tidak tersedia (HTTP 404) — tautan mati atau diblokir server.';
  }
  if (/410/.test(message)) {
    return 'Kanal sudah tidak tersedia (HTTP 410).';
  }
  if (/403/.test(message)) {
    return 'Akses diblokir server (HTTP 403). Mungkin butuh izin/token.';
  }
  if (/timed out|timeout|socket|econn|failed to connect|no route/i.test(message)) {
    return 'Koneksi gagal — periksa jaringan Anda atau server stream.';
  }
  return null;
}