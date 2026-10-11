import type { Channel } from '@/types';

const ATTRIBUTE_PATTERN = /([A-Za-z0-9_-]+)="([^"]*)"/g;

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
 */
export function parseM3U(content: string, playlistId = 'playlist'): Channel[] {
  if (!content || typeof content !== 'string') return [];

  const lines = content.split(/\r?\n/);
  const channels: Channel[] = [];
  let pending: { name?: string; logo?: string | null; group?: string } | null = null;
  let index = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^#EXTINF/i.test(line)) {
      const commaIndex = findNameSplitIndex(line);
      const hasSeparator = commaIndex >= 0;
      const meta = hasSeparator ? line.slice(0, commaIndex) : line;
      const displayName = hasSeparator ? cleanDisplayName(line.slice(commaIndex + 1)) : '';
      const attributes = parseAttributes(meta);
      pending = {
        name: displayName || attributes['tvg-name'] || attributes['tvg-id'] || undefined,
        logo: attributes['tvg-logo'] || null,
        group: attributes['group-title'] || undefined,
      };
      continue;
    }

    // Lewati baris komentar/direktif lain (#EXTM3U, #EXTVLCOPT, dsb).
    if (line.startsWith('#')) continue;

    // Baris dianggap URL stream hanya jika memiliki skema protokol.
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(line)) continue;

    channels.push({
      id: `${playlistId}-${index}`,
      name: pending?.name?.trim() || `Channel ${index + 1}`,
      url: line,
      logo: pending?.logo ?? null,
      group: pending?.group,
    });

    index += 1;
    pending = null;
  }

  return channels;
}
