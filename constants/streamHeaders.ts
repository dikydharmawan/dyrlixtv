/**
 * Header default untuk permintaan stream.
 *
 * Banyak panel IPTV/hotlink protection menolak permintaan tanpa User-Agent
 * (HTTP 403/404). Kita kirim UA browser Android TV sebagai default supaya
 * channel yang tidak mencantumkan header sendiri tetap punya peluang diputar.
 */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 11; AndroidTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Header default; header dari playlist (channel.headers) selalu menang. */
export const DEFAULT_STREAM_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: '*/*',
};

/**
 * Menggabungkan header default dengan header khusus channel.
 * Perbandingan kunci bersifat case-insensitive supaya tidak ada dua
 * `User-Agent`/`user-agent` sekaligus.
 */
export function mergeStreamHeaders(
  channelHeaders?: Record<string, string> | null,
): Record<string, string> {
  const merged: Record<string, string> = { ...DEFAULT_STREAM_HEADERS };
  if (!channelHeaders) return merged;

  for (const [key, value] of Object.entries(channelHeaders)) {
    for (const existing of Object.keys(merged)) {
      if (existing.toLowerCase() === key.toLowerCase()) delete merged[existing];
    }
    merged[key] = value;
  }
  return merged;
}

/** Membuat header "browser" tambahan (UA + Referer asal) untuk percobaan ulang. */
export function browserRetryHeaders(
  url: string,
  base?: Record<string, string> | null,
): Record<string, string> {
  const headers = mergeStreamHeaders(base);
  headers['User-Agent'] = DEFAULT_USER_AGENT;
  try {
    const origin = new URL(url).origin;
    headers.Referer = `${origin}/`;
    if (!headers.Origin) headers.Origin = origin;
  } catch {
    // URL tidak valid → biarkan header apa adanya
  }
  return headers;
}
