import AsyncStorage from '@react-native-async-storage/async-storage';
import { Inflate } from 'pako';

/**
 * Sumber EPG tambahan untuk melengkapi guide dari header playlist. Memakai id
 * ala iptv-org (mis. `CNN.us@SD`) sehingga cocok dengan `tvg-id`.
 */
const FALLBACK_EPG_URLS = [
  'https://raw.githubusercontent.com/StrangeDrVN/epg/public/guide.xml.gz',
  'https://raw.githubusercontent.com/AqFad2811/epg/main/indonesia.xml',
  'https://raw.githubusercontent.com/kemalsyabaniadama/test-epg/main/guide.xml',
];

const CACHE_PREFIX = 'iptv-player:epg:';
/** Lewati cache bila hasil jadi terlalu besar untuk AsyncStorage. */
const CACHE_MAX_BYTES = 4_500_000;
const FETCH_TIMEOUT_MS = 30000;
const INFLATE_SLICE = 1 << 16;
/** Simpan jadwal dari 3 jam lalu hingga 24 jam ke depan. */
const WINDOW_BACK_MS = 3 * 60 * 60 * 1000;
const WINDOW_FORWARD_MS = 24 * 60 * 60 * 1000;
const MAX_DESCRIPTION = 140;

export interface EpgProgramme {
  channelId: string;
  /** Unix timestamp (ms) mulai tayang. */
  start: number;
  /** Unix timestamp (ms) selesai tayang. */
  stop: number;
  title: string;
  description?: string;
}

export type EpgGuide = Record<string, EpgProgramme[]>;

export interface NowNext {
  now: EpgProgramme | null;
  next: EpgProgramme | null;
}

/** Bentuk ringkas untuk cache: [start, stop, title, description?]. */
type CompactProgramme = [number, number, string] | [number, number, string, string];
type CachedGuide = Record<string, Array<[number, number, string, string | undefined]>>;

let guide: EpgGuide | null = null;
let loadedKey = '';
let inFlight: Promise<EpgGuide | null> | null = null;
let inFlightKey = '';
const listeners = new Set<(guide: EpgGuide | null) => void>();

export function getEpg(): EpgGuide | null {
  return guide;
}

export function subscribeEpg(listener: (guide: EpgGuide | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetEpg(): void {
  guide = null;
  loadedKey = '';
  inFlight = null;
  inFlightKey = '';
  for (const listener of listeners) listener(null);
}

function notify(): void {
  for (const listener of listeners) listener(guide);
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function localDateKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Menormalkan id channel agar id playlist (`ANTV.id@SD`) cocok dengan id di
 * guide (`ANTV.id`): huruf kecil, buang kualitas (`@SD`), buang pemisah.
 */
export function normalizeEpgId(id: string): string {
  return id
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Menggabungkan & menormalkan daftar URL EPG (primary + sumber cadangan). */
function normalizeUrls(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? [input] : [];
  const urls: string[] = [];
  for (const item of raw) {
    for (const part of item.split(',')) {
      const url = part.trim();
      if (url && !urls.includes(url)) urls.push(url);
    }
  }
  for (const fallback of FALLBACK_EPG_URLS) {
    if (!urls.includes(fallback)) urls.push(fallback);
  }
  return urls;
}

/** Mengubah waktu XMLTV (`YYYYMMDDHHmmss ±ZZZZ`) menjadi Unix timestamp (ms). */
function parseXmltvTime(value: string | undefined): number {
  if (!value) return NaN;
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{2}:?\d{2})?/.exec(
    value.trim(),
  );
  if (!match) return NaN;
  const [, year, month, day, hour, minute, second = '00', tz] = match;
  let ms = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (tz) {
    const clean = tz.replace(':', '');
    const sign = clean[0] === '-' ? -1 : 1;
    const offsetMinutes = Number(clean.slice(1, 3)) * 60 + Number(clean.slice(3, 5));
    ms -= sign * offsetMinutes * 60000;
  }
  return ms;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

/** Parser XMLTV bertahap: aman untuk guide besar karena tidak menahan seluruh teks. */
class XmltvCollector {
  private readonly guide: EpgGuide = {};
  private buffer = '';
  private readonly windowStart: number;
  private readonly windowEnd: number;

  constructor(now: number) {
    this.windowStart = now - WINDOW_BACK_MS;
    this.windowEnd = now + WINDOW_FORWARD_MS;
  }

  feed(text: string): void {
    this.buffer += text;
    if (this.buffer.length > 2_000_000 && this.buffer.indexOf('<programme') === -1) {
      this.buffer = '';
      return;
    }
    let close = this.buffer.indexOf('</programme>');
    while (close !== -1) {
      const open = this.buffer.lastIndexOf('<programme', close);
      if (open !== -1) {
        this.handleBlock(this.buffer.slice(open, close + '</programme>'.length));
      }
      this.buffer = this.buffer.slice(close + '</programme>'.length);
      close = this.buffer.indexOf('</programme>');
    }
  }

  finish(): EpgGuide {
    if (this.buffer) this.feed(this.buffer);
    for (const list of Object.values(this.guide)) {
      list.sort((a, b) => a.start - b.start);
    }
    return this.guide;
  }

  private handleBlock(block: string): void {
    const attributes = block.slice(0, block.indexOf('>'));
    const rawChannelId = /channel="([^"]*)"/i.exec(attributes)?.[1];
    if (!rawChannelId) return;
    const channelId = normalizeEpgId(rawChannelId);
    if (!channelId) return;

    const start = parseXmltvTime(/start="([^"]*)"/i.exec(attributes)?.[1]);
    const stop = parseXmltvTime(/stop="([^"]*)"/i.exec(attributes)?.[1]);
    if (!Number.isFinite(start) || !Number.isFinite(stop)) return;
    if (stop < this.windowStart || start > this.windowEnd) return;

    const title = decodeEntities(
      (block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/<[^>]*>/g, ' '),
    )
      .replace(/\s+/g, ' ')
      .trim();
    if (!title) return;

    const rawDescription = block.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/i)?.[1];
    const description = rawDescription
      ? decodeEntities(rawDescription.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
      : '';

    (this.guide[channelId] ??= []).push({
      channelId,
      start,
      stop,
      title,
      description: description ? description.slice(0, MAX_DESCRIPTION) : undefined,
    });
  }
}

/** Dekoder UTF-8 streaming (aman walau `TextDecoder` tidak tersedia di Hermes). */
function createUtf8Decoder(): (chunk: Uint8Array) => string {
  let codePoint = 0;
  let needed = 0;
  return (chunk: Uint8Array): string => {
    let out = '';
    for (let i = 0; i < chunk.length; i += 1) {
      const byte = chunk[i];
      if (needed === 0) {
        if (byte < 0x80) out += String.fromCharCode(byte);
        else if (byte >= 0xc0 && byte < 0xe0) {
          codePoint = byte & 0x1f;
          needed = 1;
        } else if (byte >= 0xe0 && byte < 0xf0) {
          codePoint = byte & 0x0f;
          needed = 2;
        } else if (byte >= 0xf0 && byte < 0xf8) {
          codePoint = byte & 0x07;
          needed = 3;
        } else out += '\uFFFD';
      } else if (byte >= 0x80 && byte < 0xc0) {
        codePoint = (codePoint << 6) | (byte & 0x3f);
        needed -= 1;
        if (needed === 0) {
          out += String.fromCodePoint(codePoint);
          codePoint = 0;
        }
      } else {
        out += '\uFFFD';
        needed = 0;
        codePoint = 0;
        i -= 1;
      }
    }
    return out;
  };
}

async function fetchGuide(url: string, now: number): Promise<EpgGuide> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/gzip, application/xml, text/xml, */*' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const bytes = new Uint8Array(await response.arrayBuffer());
    const collector = new XmltvCollector(now);
    const decode = createUtf8Decoder();
    const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

    if (!isGzip) {
      collector.feed(decode(bytes));
      return collector.finish();
    }

    const inflator = new Inflate({ windowBits: 15 + 32 });
    let queue: Uint8Array[] = [];
    inflator.onData = (chunk: Uint8Array) => {
      queue.push(chunk);
    };

    for (let offset = 0; offset < bytes.length; offset += INFLATE_SLICE) {
      queue = [];
      const slice = bytes.subarray(offset, Math.min(offset + INFLATE_SLICE, bytes.length));
      inflator.push(slice, false);
      for (const chunk of queue) collector.feed(decode(chunk));
      await pause();
    }
    queue = [];
    inflator.push(new Uint8Array(0), true);
    for (const chunk of queue) collector.feed(decode(chunk));

    return collector.finish();
  } finally {
    clearTimeout(timer);
  }
}

function mergeGuides(target: EpgGuide, source: EpgGuide): boolean {
  let added = false;
  for (const [channelId, list] of Object.entries(source)) {
    if (list.length === 0) continue;
    (target[channelId] ??= []).push(...list);
    added = true;
  }
  return added;
}

function dedupeGuide(guide: EpgGuide): EpgGuide {
  for (const [channelId, list] of Object.entries(guide)) {
    list.sort((a, b) => a.start - b.start);
    const seen = new Set<string>();
    guide[channelId] = list.filter((programme) => {
      const key = `${programme.start}-${programme.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return guide;
}

type CompactCache = Record<string, Array<[number, number, string, string?]>>;

function compactGuide(guide: EpgGuide): CompactCache {
  const cache: CompactCache = {};
  for (const [channelId, list] of Object.entries(guide)) {
    cache[channelId] = list.map((programme) =>
      programme.description
        ? [programme.start, programme.stop, programme.title, programme.description]
        : [programme.start, programme.stop, programme.title],
    );
  }
  return cache;
}

function expandGuide(cache: CompactCache): EpgGuide {
  const guide: EpgGuide = {};
  for (const [channelId, list] of Object.entries(cache)) {
    guide[channelId] = list.map((entry) => ({
      channelId,
      start: entry[0],
      stop: entry[1],
      title: entry[2],
      description: entry[3],
    }));
  }
  return guide;
}

async function readCachedGuide(key: string, dateKey: string): Promise<EpgGuide | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date?: string; guide?: CompactCache };
    if (parsed?.date === dateKey && parsed.guide) return expandGuide(parsed.guide);
  } catch {
    // cache rusak → anggap tidak ada
  }
  return null;
}

async function writeCachedGuide(key: string, dateKey: string, guide: EpgGuide): Promise<void> {
  try {
    const payload = JSON.stringify({ date: dateKey, guide: compactGuide(guide) });
    if (payload.length > CACHE_MAX_BYTES) return;
    await AsyncStorage.setItem(CACHE_PREFIX + key, payload);
  } catch {
    // gagal menyimpan cache bukan masalah fatal
  }
}

/**
 * Memastikan guide EPG sudah dimuat dari daftar URL (header playlist + sumber
 * cadangan). Hasil digabung, di-dedupe, dan di-cache per hari.
 */
export async function ensureEpgLoaded(
  input: string | string[] | null | undefined,
  force = false,
): Promise<EpgGuide | null> {
  const urls = normalizeUrls(input);
  if (urls.length === 0) return null;
  const dateKey = localDateKey();
  const key = `${hashString(urls.join('|'))}:${dateKey}`;

  if (!force && guide && loadedKey === key) return guide;
  if (inFlight && inFlightKey === key) return inFlight;

  const task = (async (): Promise<EpgGuide | null> => {
    if (!force) {
      const cached = await readCachedGuide(key, dateKey);
      if (cached) {
        guide = cached;
        loadedKey = key;
        notify();
        return cached;
      }
    }

    const merged: EpgGuide = {};
    let any = false;
    const now = Date.now();
    for (const url of urls) {
      try {
        const partial = await fetchGuide(url, now);
        if (mergeGuides(merged, partial)) any = true;
      } catch {
        // lewati sumber yang gagal
      }
      await pause();
    }

    if (!any) {
      return guide;
    }

    dedupeGuide(merged);
    guide = merged;
    loadedKey = key;
    notify();
    await writeCachedGuide(key, dateKey, merged);
    return merged;
  })();

  inFlight = task;
  inFlightKey = key;
  try {
    return await task;
  } finally {
    if (inFlight === task) {
      inFlight = null;
      inFlightKey = '';
    }
  }
}

/**
 * Perkiraan apakah sebuah acara adalah siaran langsung. Sumber EPG menandai
 * acara live dengan akhiran "(L)" atau kata "LIVE"/"langsung" pada judulnya.
 */
export function isLiveTitle(title: string | undefined): boolean {
  if (!title) return false;
  return /\(l\)/i.test(title) || /\b(live|langsung)\b/i.test(title);
}

/** Daftar acara untuk sebuah `tvg-id` (untuk halaman jadwal lengkap). */
export function getSchedule(tvgId: string | undefined): EpgProgramme[] {
  if (!tvgId || !guide) return [];
  return guide[normalizeEpgId(tvgId)] ?? [];
}

/** Mencari acara yang sedang tayang dan berikutnya untuk sebuah `tvg-id`. */
export function getNowNext(tvgId: string | undefined, at = Date.now()): NowNext | null {
  if (!tvgId || !guide) return null;
  const list = guide[normalizeEpgId(tvgId)];
  if (!list || list.length === 0) return null;

  let low = 0;
  let high = list.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (list[mid].stop <= at) low = mid + 1;
    else high = mid;
  }

  const candidate = list[low];
  const now = candidate && candidate.start <= at ? candidate : null;
  const next = now ? (list[low + 1] ?? null) : (candidate ?? null);
  if (!now && !next) return null;
  return { now, next };
}
