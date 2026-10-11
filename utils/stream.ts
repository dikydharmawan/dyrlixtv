import { mergeStreamHeaders } from '@/constants/streamHeaders';
import { isValidStreamUrl } from '@/utils/url';

export type StreamCheck = 'ok' | 'dead' | 'network' | 'invalid';

export interface StreamCheckItem {
  id: string;
  url: string;
  headers?: Record<string, string>;
}

export interface StreamCheckDetail {
  status: StreamCheck;
  /** Kode HTTP bila server sempat menjawab (dipakai untuk pesan error/diagnostik). */
  httpStatus?: number;
}

export interface StreamCheckResult extends StreamCheckDetail {
  id: string;
}

/**
 * Pengecekan cepat ketersediaan stream.
 * Hanya 404/410 yang dianggap PASTI mati; 4xx lain (403/401) belum tentu
 * karena pemutar asli mungkin tetap bisa memutar dengan token.
 * Header default selalu dikirim; header khusus channel menang.
 */
export async function checkStreamDetail(
  url: string,
  timeoutMs = 8000,
  headers?: Record<string, string>,
): Promise<StreamCheckDetail> {
  if (!isValidStreamUrl(url)) return { status: 'invalid' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: mergeStreamHeaders(headers),
      signal: controller.signal,
    });
    // Status headers sudah cukup; hentikan unduhan body supaya hemat kuota.
    controller.abort();
    if (res.status === 404 || res.status === 410) return { status: 'dead', httpStatus: res.status };
    return { status: 'ok', httpStatus: res.status };
  } catch {
    return { status: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** Versi ringkas yang hanya mengembalikan status. */
export async function checkStream(
  url: string,
  timeoutMs = 8000,
  headers?: Record<string, string>,
): Promise<StreamCheck> {
  return (await checkStreamDetail(url, timeoutMs, headers)).status;
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
      const detail = await checkStreamDetail(item.url, timeoutMs, item.headers);
      results[i] = { id: item.id, ...detail };
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/** Deskripsi ramah untuk sebuah kode HTTP. */
function describeStatus(code: number): string | null {
  if (code === 404 || code === 410) {
    return 'Kanal tidak tersedia (HTTP 404) — tautan mati atau diblokir server.';
  }
  if (code === 403) {
    return 'Server menolak akses (HTTP 403) — channel ini kemungkinan butuh langganan/token atau memblokir hotlink.';
  }
  if (code === 451) {
    return 'Channel diblokir (HTTP 451) — tidak tersedia untuk wilayah Anda.';
  }
  if (code >= 500) {
    return `Server channel sedang bermasalah (HTTP ${code}). Coba lagi nanti.`;
  }
  if (code >= 400) {
    return `Permintaan ditolak server (HTTP ${code}).`;
  }
  return null;
}

function detectStatus(message: string, httpStatus?: number): number | undefined {
  if (typeof httpStatus === 'number') return httpStatus;
  const match = message.match(/\b([45]\d\d)\b/);
  return match ? Number(match[1]) : undefined;
}

/** Terjemahkan pesan error mentah pemutar menjadi pesan yang ramah. */
export function friendlyStreamError(raw: unknown, httpStatus?: number): string | null {
  const message = (raw as { message?: unknown } | null)?.message;
  if (typeof message !== 'string') {
    return typeof httpStatus === 'number' ? describeStatus(httpStatus) : null;
  }

  const code = detectStatus(message, httpStatus);
  if (code) {
    const described = describeStatus(code);
    if (described) return described;
  }

  if (/timeout|timed out|network|failed to connect|unreachable|ENOTFOUND|ECONN|abort/i.test(message)) {
    return 'Tidak dapat terhubung ke channel. Periksa koneksi internet atau tautan.';
  }
  return null;
}
