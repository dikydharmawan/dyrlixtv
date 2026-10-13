export interface Channel {
  /** Unique id, biasanya gabungan dari id playlist + index. */
  id: string;
  /** Nama channel yang ditampilkan di UI. */
  name: string;
  /** URL stream (HLS .m3u8, mp4, dll). */
  url: string;
  /** URL logo channel (opsional). */
  logo?: string | null;
  /** Group/category dari atribut group-title. */
  group?: string;
  /** ID EPG (tvg-id) untuk mencocokkan jadwal tayang pada guide XMLTV. */
  tvgId?: string;
  /** Menandai channel contoh/demo (bukan siaran resmi). */
  isDemo?: boolean;
  /** Header HTTP khusus untuk stream (mis. dari #EXTHTTP/#KODIPROP di M3U). */
  headers?: Record<string, string>;
}

export type PlaylistType = 'url' | 'content';

export interface Playlist {
  /** Unique id playlist. */
  id: string;
  /** Nama playlist yang ditampilkan. */
  name: string;
  /** URL sumber file M3U/M3U8. Kosong untuk playlist tipe `content`. */
  url: string;
  /** Unix timestamp (ms) saat playlist ditambahkan. */
  addedAt: number;
  /** `url`: disinkron dari tautan. `content`: isi M3U ditempel manual (bebas CORS). */
  type: PlaylistType;
  /** Isi teks M3U (hanya untuk tipe `content`). */
  content?: string;
  /** Jumlah channel saat teks disimpan (hanya untuk tipe `content`). */
  channelCount?: number;
}
