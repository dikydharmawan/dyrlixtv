import type { Channel } from '@/types';

/**
 * Stream contoh (DEMO) yang bersifat publik dan stabil.
 * Dipakai sebagai placeholder agar aplikasi bisa langsung dicoba.
 */
const DEMO_HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

/**
 * Endpoint HLS resmi TVRI (kanal publik).
 * Jika sewaktu-waktu berubah, cukup perbarui URL di bawah ini.
 */
const TVRI_HLS = 'https://ott-balancer.tvri.go.id/live/eds';

/**
 * Daftar channel bawaan aplikasi.
 *
 * CATATAN:
 * - Channel komersial (Trans TV, Trans7, TVOne, Kompas TV) TIDAK menyediakan
 *   endpoint publik resmi. Kartu di bawah memakai stream DEMO agar pemutar
 *   dapat diuji. Ganti `url` dengan sumber resmi/legal yang Anda miliki,
 *   atau tambahkan playlist M3U Anda sendiri dari menu "Tambah Playlist".
 * - Tautan pihak ketiga sepenuhnya menjadi tanggung jawab pengguna.
 */
export const DEFAULT_CHANNELS: Channel[] = [
  {
    id: 'tvri-nasional',
    name: 'TVRI Nasional',
    group: 'Nasional',
    url: `${TVRI_HLS}/Nasional/hls/Nasional.m3u8`,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/TVRI_2023.svg/240px-TVRI_2023.svg.png',
  },
  {
    id: 'tvri-sport',
    name: 'TVRI Sport',
    group: 'Olahraga',
    url: `${TVRI_HLS}/Sport/hls/Sport.m3u8`,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/TVRI_2023.svg/240px-TVRI_2023.svg.png',
  },
  {
    id: 'trans-tv',
    name: 'Trans TV',
    group: 'Hiburan',
    url: DEMO_HLS,
    isDemo: true,
  },
  {
    id: 'trans7',
    name: 'Trans7',
    group: 'Hiburan',
    url: DEMO_HLS,
    isDemo: true,
  },
  {
    id: 'tvone',
    name: 'TVOne',
    group: 'Berita',
    url: DEMO_HLS,
    isDemo: true,
  },
  {
    id: 'kompas-tv',
    name: 'Kompas TV',
    group: 'Berita',
    url: DEMO_HLS,
    isDemo: true,
  },
];
