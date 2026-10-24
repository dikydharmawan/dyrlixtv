import type { Channel } from '@/types';

const ATTRIBUTE_PATTERN = /([A-Za-z0-9_-]+)="([^"]*)"/g;

/**
 * Karakter tak terlihat yang sering ikut terikut saat menyalin teks dari web:
 * BOM, zero-width space/joiner, penanda arah (RTL/LTR), dan sejenisnya.
 * Karakter ini bisa menempel di awal baris sehingga `#EXTINF`/URL tak terdeteksi.
 */
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

/**
 * Menormalkan teks M3U yang ditempel:
 * - BOM di awal,
 * - kutip "keriting" (dari web) → kutip lurus,
 * - semua jenis akhir baris (CR, CRLF, LF, U+2028, U+2029) → LF,
 * - karakter tak terlihat dibuang.
 */
function normalizeContent(content: string): string {
  return content
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(INVISIBLE_CHARS, '');
}

interface PendingChannel {
  name?: string;
  logo?: string | null;
  group?: string;
  tvgId?: string;
  headers?: Record<string, string>;
}

/** Mengambil URL guide EPG (XMLTV) dari baris header `#EXTM3U x-tvg-url="..."`. */
export function extractEpgUrl(content: string): string | null {
  if (!content || typeof content !== 'string') return null;
  const headerMatch = /#EXTM3U([^\n\r]*)/i.exec(content);
  if (!headerMatch) return null;
  const urlMatch = /(?:x-tvg-url|url-tvg)="([^"]+)"/i.exec(headerMatch[1]);
  const raw = urlMatch?.[1]?.trim();
  return raw ? raw : null;
}

function parseAttributes(input: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const regex = new RegExp(ATTRIBUTE_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    attributes[match[1].toLowerCase()] = match[2];
  }
  return attributes;
}

/**
 * Menggabungkan header HTTP dari:
 * - `#EXTHTTP:` (JSON),
 * - `#KODIPROP:` (dipisah `|`, tiap bagian `key=value`),
 * - `#EXTVLCOPT:` (mis. `http-user-agent=...`, `http-referrer=...`, `http-origin=...`).
 */
function collectHeaders(pending: PendingChannel | null, line: string): PendingChannel | null {
  const base = pending ?? {};
  const merged: Record<string, string> = { ...(base.headers ?? {}) };

  if (/^#EXTHTTP:/i.test(line)) {
    const raw = line.slice('#EXTHTTP:'.length).trim();
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === 'string') merged[key] = value;
        }
      }
    } catch {
      // abaikan baris #EXTHTTP yang tidak valid
    }
  } else if (/^#KODIPROP:/i.test(line)) {
    const eq = line.indexOf('=');
    if (eq >= 0) {
      const value = line.slice(eq + 1);
      for (const pair of value.split('|')) {
        const i = pair.indexOf('=');
        if (i > 0) {
          const key = pair.slice(0, i).trim();
          const val = pair.slice(i + 1).trim();
          if (key && val) merged[key] = val;
        }
      }
    }
  } else if (/^#EXTVLCOPT:/i.test(line)) {
    const eq = line.indexOf('=');
    if (eq >= 0) {
      const key = line.slice('#EXTVLCOPT:'.length, eq).trim().toLowerCase();
      const val = line.slice(eq + 1).trim();
      if (val) {
        if (key === 'http-user-agent') merged['User-Agent'] = val;
        else if (key === 'http-referrer') merged['Referer'] = val;
        else if (key === 'http-origin') merged['Origin'] = val;
      }
    }
  }

  return { ...base, headers: Object.keys(merged).length > 0 ? merged : undefined };
}

/**
 * Mencari indeks koma PERTAMA yang berada di luar tanda kutip.
 * `#EXTINF` memisahkan atribut dan nama dengan koma, namun nilai atribut
 * (mis. group-title="Berita, Hiburan") juga bisa mengandung koma.
 */
function findNameSplitIndex(line: string): number {
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      return i;
    }
  }
  return -1;
}

/** Menghapus tanda kutip yang membungkus nama display. */
function cleanDisplayName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Mengubah isi file M3U/M3U8 menjadi daftar Channel.
 * Mendukung format `#EXTINF:-1 tvg-logo="..." group-title="...", Nama`.
 * 
 * Dioptimalkan untuk memproses file besar tanpa memuat seluruh baris ke dalam array memori.
 */
export function parseM3U(content: string, playlistId = 'playlist'): Channel[] {
  if (!content || typeof content !== 'string') return [];

  const channels: Channel[] = [];
  let pending: PendingChannel | null = null;
  let index = 0;

  let start = 0;
  while (start < content.length) {
    // Cari posisi karakter pemisah baris tercepat
    let end = -1;
    for (let i = start; i < content.length; i++) {
      const charCode = content.charCodeAt(i);
      if (charCode === 10 || charCode === 13 || charCode === 8232 || charCode === 8233) {
        end = i;
        break;
      }
    }
    
    // Jika tidak ditemukan karakter pemisah baris, gunakan akhir string
    const lineEnd = end === -1 ? content.length : end;
    let line = content.substring(start, lineEnd);

    // Normalisasi baris (hanya jika ada karakter yang perlu diganti)
    if (line.search(/[\u201C\u201D\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/) !== -1) {
      line = line
        .replace(/[\u201C\u201D]/g, '"')
        .replace(INVISIBLE_CHARS, '');
    }

    // Majukan start melewati baris ini
    if (end === -1) {
      start = content.length;
    } else {
      // Menangani CRLF
      if (content[end] === '\r' && content[end + 1] === '\n') {
        start = end + 2;
      } else {
        start = end + 1;
      }
    }

    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (/^#EXTINF/i.test(trimmedLine)) {
      const commaIndex = findNameSplitIndex(trimmedLine);
      const hasSeparator = commaIndex >= 0;
      const meta = hasSeparator ? trimmedLine.slice(0, commaIndex) : trimmedLine;
      const displayName = hasSeparator ? cleanDisplayName(trimmedLine.slice(commaIndex + 1)) : '';
      const attributes = parseAttributes(meta);
      pending = {
        name: displayName || attributes['tvg-name'] || attributes['tvg-id'] || undefined,
        logo: attributes['tvg-logo'] || null,
        group: attributes['group-title'] || undefined,
        tvgId: attributes['tvg-id'] || undefined,
      };
      continue;
    }

    // Direktif header stream (#EXTHTTP / #KODIPROP / #EXTVLCOPT) dikumpulkan untuk channel berikutnya.
    if (
      /^#EXTHTTP:/i.test(trimmedLine) ||
      /^#KODIPROP:/i.test(trimmedLine) ||
      /^#EXTVLCOPT:/i.test(trimmedLine)
    ) {
      pending = collectHeaders(pending, trimmedLine);
      continue;
    }

    // Lewati baris komentar/direktif lain (#EXTM3U, #EXTVLCOPT, dsb).
    if (trimmedLine.startsWith('#')) continue;

    // Baris dianggap URL stream jika mengandung skema protokol (`://`).
    // Tidak harus di awal baris agar tahan terhadap sisa karakter aneh.
    if (!trimmedLine.includes('://')) continue;

    channels.push({
      id: `${playlistId}-${index}`,
      name: pending?.name?.trim() || `Channel ${index + 1}`,
      url: trimmedLine,
      logo: pending?.logo ?? null,
      group: pending?.group,
      tvgId: pending?.tvgId,
      headers: pending?.headers,
    });

    index += 1;
    pending = null;
  }

  return channels;
}
