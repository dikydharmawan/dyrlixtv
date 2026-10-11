const STREAM_URL_REGEX = /^https?:\/\/[^\s]+$/i;

/** Validasi sederhana untuk tautan playlist/stream (http atau https). */
export function isValidStreamUrl(value: string): boolean {
  if (!value) return false;
  return STREAM_URL_REGEX.test(value.trim());
}

/** Membuat nama playlist yang ramah dari sebuah URL. */
export function deriveNameFromUrl(value: string, fallback = 'Playlist'): string {
  try {
    const cleaned = value.trim().replace(/^https?:\/\//i, '');
    const withoutQuery = cleaned.split(/[?#]/)[0];
    const segments = withoutQuery.split('/').filter(Boolean);
    const host = segments[0] || fallback;
    const lastSegment = segments.length > 1 ? segments[segments.length - 1] : '';
    const prettyFile = lastSegment
      ? decodeURIComponent(lastSegment.replace(/\.(m3u8?|txt)$/i, ''))
      : '';
    if (prettyFile && !prettyFile.includes('.')) {
      return `${prettyFile} — ${host}`;
    }
    return host;
  } catch {
    return fallback;
  }
}
