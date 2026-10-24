# DYRLIX Native (Kotlin) — Parity Spec & Checklist

> Sumber kebenaran tunggal untuk port RN/Expo → Kotlin/Compose (project `android-native/`).
> Web tetap memakai app RN. Paritas dikerjakan **paralel** (TS + Kotlin).
> Semua referensi `file:line` menunjuk ke kode RN yang ada di repo ini.

Status: **F1 selesai**. Update dokumen ini setiap kali perilaku RN berubah; jangan port dari ingatan.

---

## 1. Keputusan terkunci

| # | Keputusan |
|---|---|
| K1 | Keystore dibuat manual `dyrlix-release.jks` (update in-place butuh uninstall+install ulang karena keystore asli hilang). |
| K2 | Web di-host di GitHub Pages (root `gh-pages` = build web RN; `update.json` + `dyrlix-*.apk` juga di root). |
| K3 | Paritas **paralel** — setiap fitur diselesaikan di TS dan Kotlin di sprint yang sama. |
| K4 | `versionName 2.0.0` / `versionCode 14` (lanjut dari RN 1.0.11 / vc13) ✅ Selesai. |
| K5 | UI = **opsi B**: desain identik (warna/spacing/radius/layout dari `constants/theme.ts`) + skala TV. |
| K6 | Ikon: bundle **Ionicons TTF**, bukan Material Icons. |

### Aturan UI opsi B (angka pasti)

Paritas berarti **ukuran eksplisit per-breakpoint** yang sudah dipakai RN — *bukan* mengalikan semua dengan 1.25.
`useResponsive().scale` (1.25/1.1/1) adalah **dead code** dan tidak boleh dipakai sebagai dasar (`hooks/useResponsive.ts:26`).
Petakan tabel `isTV ? A : B` di §6 apa adanya.

Tambahan khusus STB far-view (disetujui): overscan 48dp, focus border 3dp + scale 1.06, card logo 170dp, SideNav 272dp/item 64dp, hero 52, body 20.
> Catatan: nilai 2dp/140dp/248dp di RN adalah nilai *compact*; padanan TV RN-nya (border 2dp, logo 140dp, nav 248dp) tetap dipakai agar visual identik. Selisih hanya pada tambahan far-view di atas.

---

## 2. Peta modul RN → Kotlin

| RN | Kotlin target |
|---|---|
| `types/index.ts` | `data/model/Models.kt` (`Channel`, `Playlist`, `EpgProgramme`, `UpdateManifest`) |
| `utils/m3uParser.ts` | `data/m3u/M3uParser.kt` |
| `services/epg.ts` | `data/epg/EpgRepository.kt` + `EpgXmlParser.kt` + `EpgCache.kt` |
| `services/playlistStorage.ts` | `data/store/PlaylistStore.kt` (DataStore + kotlinx.serialization) |
| `services/defaultPlaylist.ts` | `data/store/DefaultPlaylist.kt` |
| `services/playlistLoader.ts` | `data/net/PlaylistLoader.kt` |
| `services/playbackQueue.ts` | `player/PlaybackQueue.kt` (in-memory object) |
| `constants/streamHeaders.ts` | `data/net/StreamHeaders.kt` |
| `utils/stream.ts` | `data/net/StreamHealth.kt` |
| `utils/url.ts` | `core/UrlUtils.kt` |
| `utils/categories.ts`, `utils/grid.ts`, `utils/format.ts`, `utils/navigation.ts` | `core/*.kt` |
| `services/updateManager.ts` | `update/UpdateManager.kt` |
| `constants/theme.ts` | `ui/theme/{Color,Dimens,Type,Theme}.kt` ✅ sudah dibuat |
| `components/*` | `ui/components/*.kt` |
| `app/(tabs)/index.tsx` dll | `ui/screen/*.kt` + `ui/nav/RootNav.kt` |

---

## 3. Storage contract (DataStore)

RN memakai **hanya AsyncStorage** (`@react-native-async-storage/async-storage`), 4 key:

| Key RN | Isi | Kotlin |
|---|---|---|
| `@iptv_player/playlists:v1` | array `Playlist` JSON | DataStore `playlists` |
| `@iptv_player/default_playlist:v3` | `{channels, epgUrl, fetchedAt}` | DataStore `default_playlist` (stale 30 menit) |
| `@iptv_player/update_manifest_url:v1` | string URL | DataStore `update_manifest_url` |
| `iptv-player:epg:<fnv36>:<YYYY-MM-DD>` | `{date, guide}` | cache file/DataStore `epg_*` (key sama!) |

**Detail penting:**
- `Playlist` normalisasi ketat: `id`, `name`, `addedAt` harus ada (tipe benar) else drop; `type==='content'` **hanya** jika persis string itu, else `'url'` (`services/playlistStorage.ts:14-38`).
- ID: `` `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}` `` (`:9-11`).
- Sortir daftar: `addedAt` desc (`:52`); playlist baru di-**prepend** (`:98`,`:121`).
- EPG cache: hash **FNV-1a 32-bit** atas UTF-16 code unit dari `urls.join('|')`, cetak base-36; `dateKey` = tanggal **lokal** `YYYY-MM-DD`; **tulis dilewati bila panjang payload > 4.500.000 karakter**; key lama tidak pernah dihapus (`services/epg.ts:14,16,84-91,393,375`).
- Tidak ada: cache M3U per-playlist, resume position, UI prefs. (Kunci historis `@iptv_player/dead_links:v1` dan `default_playlist:v1/v2` hanya di instalasi lama.)

> **MIG-1 (butuh keputusan):** aplikasi Kotlin menggantikan RN dengan applicationId sama → data AsyncStorage (playlist user) **tidak** terbaca otomatis. Pilihan: (a) abaikan — user menambah ulang; (b) baca SQLite `RKStorage` sekali lalu migrasi. Rekomendasi: (a).

---

## 4. Kontrak data (harus byte-for-byte sama)

### 4.1 M3U parser (`utils/m3uParser.ts`)

- `normalizeContent` (dipakai **hanya** di `parseM3U`), urutan mutlak: `“”`→`"` → `\r\n?`→`\n` → `\u2028\u2029`→`\n` → **strip global** `[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]` (`:19-25`).
- `extractEpgUrl` memakai teks **RAW** (tanpa normalize!), hanya baris `#EXTM3U` **pertama**, regex `/(?:x-tvg-url|url-tvg)="([^"]+)"/i`, hasil `.trim()`, kosong→`null` (`:36-43`).
- `parseAttributes`: regex `([A-Za-z0-9_-]+)="([^"]*)"`, key **lowercase**, duplikat → terakhir menang, atribut tanpa kutip diabaikan (`:45-53`).
- `findNameSplitIndex`: koma pertama **di luar kutip**; kutip tidak seimbang → `-1` → nama `''` (`:111-122`).
- `cleanDisplayName`: trim; jika panjang ≥2 dan diawali+diakhiri `"` → buang sepasang lalu trim (`:125-131`).
- `#EXTHTTP:` JSON parse (hanya value string, key case dipertahankan); `#KODIPROP:` split `|` lalu `=`; `#EXTVLCOPT:` map **hanya** `http-user-agent`→`User-Agent`, `http-referrer`→`Referer`, `http-origin`→`Origin` (`:61-104`).
- Direktif header **sebelum** `#EXTINF` tetap menghasilkan channel dengan `name = "Channel N"` (`:61-63,170,183`).
- URL diterima jika mengandung `://` **di mana saja**, disimpan **utuh** (trim saja) — `>> http://x` diterima (`:179-184`).
- `name` fallback: displayName → `tvg-name` → `tvg-id` → `Channel ${index+1}`; `id = "${playlistId}-${index}"` (index 0-based, hanya channel diterima) (`:182-183`).
- Tidak ada dedup/sortir/limit; `group-title` disimpan verbatim (tidak di-split `,`/`;`) (`:155-160`).

### 4.2 EPG (`services/epg.ts`)

- Sumber: `x-tvg-url` dari playlist, lalu fallback berurutan `StrangeDrVN/epg/public/guide.xml.gz`, `AqFad2811/epg/main/indonesia.xml`, `kemalsyabaniadama/test-epg/main/guide.xml` (`:8-12`); `normalizeUrls` split `,`, trim, dedupe urut, lalu append fallback (`:105-118`).
- Fetch: timeout **30 detik**, header `accept: application/gzip, application/xml, text/xml, */*`, body dibaca penuh ke memory (`:17,267-275`).
- Gzip sniff `1f 8b`; inflate via zlib windowBits `15+32`, slice 65536 byte + `await pause()` tiap slice (`:278-300`).
- Decoder UTF-8 streaming dengan carry antar-chunk; byte tak valid → `\uFFFD`; byte tak terduga saat `needed>0` → `\uFFFD` + reprocess byte (`:228-263`).
- Window: `[now-3h, now+24h]`; buang jika `stop < windowStart || start > windowEnd` (`:20-21,203`).
- `parseXmltvTime`: regex `^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{2}:?\d{2})?`; tanpa tz → **UTC**; detik opsional (`:121-143`).
- Field: `channel` (wajib, dinormalisasi), `start`/`stop` (wajib finite), `title` (wajib; strip tag → `' '` → decodeEntities → collapse spasi), `desc` opsional, **max 140 char** (`:22,193-224`).
- `decodeEntities` urutan: `&lt; &gt; &quot; &apos; &#dddd; &#xhhhh;` lalu **`&amp;` terakhir** (`:145-154`).
- Collector: jika `buffer.length > 2.000.000` dan tidak ada `'<programme'` → buffer dibuang; `finish()` sort tiap channel by `start` (`:168-191`).
- Merge semua URL secara berurutan; jika tidak ada yang menambah → **tidak** tulis cache & tidak notify (`:412-431`).
- `dedupeGuide`: key `` `${start}-${title}` `` (abaikan stop & desc), simpan yang pertama (`:318-330`).
- `normalizeEpgId`: `lowercase()` → buang `@...` (`@.*$`) → buang `[^a-z0-9]` → `antvid` (`:97-102`).
- `getNowNext`: binary search index pertama `stop > at`; `now` bila `start <= at`; `next = now ? list[low+1] : candidate` (`:462-479`).
- `isLiveTitle`: `/\(l\)/i` **atau** `/\b(live|langsung)\b/i` (`:450-453`).
- Semua error EPG **senyap** (tidak ada string user-facing).

### 4.3 Stream & jaringan (`utils/stream.ts`, `constants/streamHeaders.ts`)

- `DEFAULT_USER_AGENT` = `Mozilla/5.0 (Linux; Android 11; AndroidTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`; default `Accept: */*` (`streamHeaders.ts:8-15`).
- `mergeStreamHeaders`: hapus key lama yang lowercase-nya sama, sisipkan key dari channel apa adanya (`:22-35`).
- `browserRetryHeaders`: paksa UA default; `Referer = {origin}/`; `Origin` hanya bila belum ada (`:38-52`).
- Health check: **GET**, timeout **8000 ms**, header merge, **body langsung di-abort** setelah response; **hanya 404/410 = `dead`**; error jaringan = `network`; URL invalid = `invalid`; lainnya = `ok` (`stream.ts:18-41`).
- String error (harus sama, termasuk bug: 410 → mencetak **404**):
  - 404/410: `Kanal tidak tersedia (HTTP 404) — tautan mati atau diblokir server.`
  - 403: `Server menolak akses (HTTP 403) — channel ini kemungkinan butuh langganan/token atau memblokir hotlink.`
  - 451: `Channel diblokir (HTTP 451) — tidak tersedia untuk wilayah Anda.`
  - ≥500: `Server channel sedang bermasalah (HTTP {code}). Coba lagi nanti.`
  - ≥400: `Permintaan ditolak server (HTTP {code}).`
  - pola timeout/network: `Tidak dapat terhubung ke channel. Periksa koneksi internet atau tautan.`
  - (`utils/stream.ts:44-86`)
- `isValidStreamUrl`: `/^https?:\/\/[^\s]+$/i` pada `trim()` (`utils/url.ts:1-7`).
- `deriveNameFromUrl` (`:10-27`): strip scheme → potong `?`/`#` → split `/`; segment terakhir tanpa `.m3u/.m3u8/.txt` dan tanpa `.` → `"{file} — {host}"` (em dash), else `host`; error → `fallback`.

### 4.4 Playlist fetch (`services/playlistLoader.ts`)

- Timeout **20 detik**; `Accept: application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*` (`:4,27`).
- Pesan: non-2xx → `Server menolak permintaan (HTTP {status}).`; abort → `Koneksi habis waktu. Periksa jaringan lalu coba lagi.`; TypeError → `Tidak dapat terhubung ke tautan. Periksa URL atau koneksi internet.`; else `{message}` atau `Gagal memuat playlist.` (`:32-42`).
- 0 channel → `Playlist tidak berisi channel yang valid.` (`:15`).
- `type:'content'` → parse isi tersimpan (tanpa jaringan); `type:'url'` → selalu fetch ulang (`:53-59`).

### 4.5 Default playlist (`services/defaultPlaylist.ts`)

- URL: `https://iptv-org.github.io/iptv/index.m3u`, header `accept: text/plain,*/*`, **tanpa timeout** (`constants/channels.ts:29-30`, `:54`).
- Freshness 30 menit (`:9`); `force` tetap menulis cache (`:48-66`).
- Fallback berurutan: cache basi → `DEFAULT_CHANNELS` (6 channel, 4 `isDemo`, `epgUrl:null`) (`:67-72`).
- `playlistId = 'bawaan'` → id channel `bawaan-0..` (`:60`).

---

## 5. Update mandiri (`services/updateManager.ts`)

- Manifest default: `https://raw.githubusercontent.com/dikydharmawan/dyrlixtv/gh-pages/update.json` (`app.json:84`), bisa dioverride di key DataStore.
- Cache-buster `?t=<Date.now()>`; candidate jsDelivr → raw.githubusercontent; **ambil semua, pilih `versionCode` tertinggi** (`:37-60,94-96`).
- Skema: `{packageName?, versionCode:number, versionName:string, apkUrl:string, notes?, publishedAt?}`; `versionCode` non-number atau `apkUrl` kosong → `update.json tidak valid (butuh versionCode & apkUrl).`; `packageName` beda → `Manifest update bukan untuk aplikasi ini.` (`:7-14,76-92`).
- Perbandingan **hanya versionCode** (`available = manifest.versionCode > installed.versionCode`) (`:120`).
- Pesan: `URL manifest update belum diisi.` / `Versi terpasang tidak bisa dibaca.` / `Gagal memeriksa update.` / `Update {versionName} tersedia.` / `Aplikasi sudah dalam versi terbaru.` (`:109-135`).
- Unduh: nama file **`dyrlix-{versionCode}.apk`** di cache dir; HTTP ≥400 → `Download gagal (HTTP {status}).`; lalu `VIEW` + mime `application/vnd.android.package-archive` + flag `NEW_TASK|GRANT_READ_URI_PERMISSION`; sukses → `Installer aplikasi telah dibuka.`; gagal → `Gagal membuka installer.` (`:138-165`).
  - Kotlin: pakai `FileProvider` (authority `com.dyrlix.player.fileprovider`) untuk dapat content URI — wajib, tambahkan ke manifest.
- Izin: buka `MANAGE_UNKNOWN_APP_SOURCES` `package:<applicationId>` (`:168-174`).
- **Tidak ada** progres, resume, atau checksum (`:5.5`).

---

## 6. Aturan UI/breakpoint (semua branch)

Definisi:
- `isTV` (loose, untuk sizing/layout) = `Platform.isTV || width >= 1000` (`hooks/useResponsive.ts:23`).
- `isTV()` (strict, untuk focus) = `Platform.isTV === true` saja (`components/Tv.tsx:24-26`).
  → **Trap #2:** window lebar ≥1000 (HP/web) dapat layout TV tetapi tanpa `hasTVPreferredFocus`. Di Compose, pakai `Configuration.isTv`/`UiModeManager` untuk focus dan `screenWidthDp>=1000` untuk layout.
- `wide = isTV || isTablet(≥768) || isLandscape` → `SideNav` 248 expanded vs 84 rail; `CategoryRail` vs `CategoryFilter`.
- `columns`: ≥1800→5, ≥1360→4, ≥880→3, ≥560→2, else 1; `gutter = isTV?24:16` (`:28-42`).
- SideNav: expanded bila `isTV||isTablet||isLandscape`.

Daftar lengkap cabang `isTV ? A : B` ada di laporan riset §5.2 (font 42/34, section 26/20, icon 30/24, logo 140/100, dsb). Implementasikan via `LocalDimens` (bukan cek platform berulang) + `isTv`/`isWide`.

Trap visual:
- `colors.background #121212` (semua layar) vs `#0F172A` (window/splash `app.json`).
- `InfoBanner` warning bg `rgba(245,158,11,0.16)`, `borderLeftWidth 4`.
- `Screen` wallpaper = ikon app opacity 0.1, 75%×75%, `pointerEvents none`.
- Player: overlay `rgba(0,0,0,0.8)`; topBar `rgba(2,6,23,0.55)`; warning `rgba(15,23,42,0.92)`; tombol back 48×48 `rgba(15,23,42,0.7)`; skip 52×52 `rgba(255,255,255,0.12)` disabled `opacity 0.35`.

---

## 7. Peta navigasi & layar

8 layar (tidak ada tab bar; SideNav hanya pada 4 layar grup):

| Route | Layar | SideNav |
|---|---|---|
| `/` | Beranda — default playlist, grid, cari, kategori | ya |
| `/playlists` | Playlist Saya — buka/hapus, konfirmasi | ya |
| `/update` | Update Aplikasi — URL manifest, cek, unduh/pasang | ya |
| `/about` | Tentang Aplikasi — fitur, teknis, kredit, tautan | ya |
| `/add-playlist` | Tambah Playlist (modal) — URL / tempel / file | tidak |
| `/playlist/[id]` | Detail playlist — grid + cari + kategori | tidak |
| `/schedule?tvgId&name` | Jadwal Tayang (EPG) — SectionList Hari ini/Besok | tidak |
| `/player` | Pemutar — video + top bar + prev/next | tidak |

Deep link scheme `dyrlix`. Back: `router.back()` else `replace('/')` (`utils/navigation.ts:8-14`).
Transisi: default `fade`; `add-playlist` `slide_from_bottom`; player bg hitam (`app/_layout.tsx:11-31`).

### Focus awal (`hasTVPreferredFocus`) — trap #7
- Home: kartu channel pertama.
- Playlist Saya: tombol **Buka** kartu pertama (atau tombol header bila kosong).
- Update: **Periksa Update**.
- Tambah Playlist: **Pilih File M3U…** (hanya mode file).
- Player: tombol **kembali**.
- About / Schedule / Detail playlist: default (Detail → kartu channel pertama).

### State kosong/gagal (copy persis)
Semua string kosong/loading/error per layar tercantum di laporan riset UI §2.1–2.9 — wajib disalin verbatim (bahasa Indonesia) termasuk:
- Home loading `Memuat channel bawaan…`; gagal `Channel bawaan gagal dimuat`.
- Playlist Saya: `Belum ada playlist`, `Memuat…`, `{n} playlist tersimpan`.
- Update: `Terbaru`, `Gagal Memeriksa`, `Perhatian` (teks panjang), placeholder `https://host-anda.com/dyrlix/update.json`.
- About: `DYRLIX TV`, tagline, 5 fitur, `Ahmad Diky Dharmawan`, GitHub/Email, Disclaimer (teks panjang).
- Add playlis: validasi `Tautan playlist tidak boleh kosong.`, `Format tautan tidak valid. Contoh: https://contoh.com/playlist.m3u`, `Pilih file M3U terlebih dahulu.`, `Berhasil` / `Gagal`, Disclaimer panjang.
- Detail playlist: `Memuat channel dari playlist…`, `Gagal memuat playlist`, `Channel tidak ditemukan`.
- Schedule: `Memuat jadwal…` / `Jadwal tidak tersedia`; label `Hari ini`/`Besok`/`{Hari}, {D} {Mon}`; badge `● LIVE` / `● SEDANG TAYANG`.
- Player: `Memuat siaran…`, `Gagal memuat stream`, tombol `Coba Lagi`/`Kembali`, banner `Tautan ini kemungkinan mati (HTTP {code}). Mencoba tetap memutar…`.

---

## 8. Player (`app/player.tsx`) — paritas wajib

- Sumber: `activeChannel.url ?? params.url`; judul `activeChannel.name ?? params.name ?? 'Siaran'` (`:40-44`). Param `logo` **tidak dipakai**.
- Header channel (`params.headers` JSON atau `channel.headers`) di-merge dengan default; parse JSON gagal → diabaikan (`:78-94`).
- Pre-check 8 detik sebelum putar; `dead` **tidak** memblokir, hanya banner; `hasError = !url || status==='error'` (`:101-137`).
- **Retry otomatis 1×**: saat status `error`, jeda **600 ms**, `replace()` dengan `browserRetryHeaders` (tambah `Referer`/`Origin`), lalu `play()` (`:122-131`).
- Overlay loading: full-screen `rgba(0,0,0,0.8)` + spinner + `Memuat siaran…`, `pointerEvents none`.
- Error: ikon `cloud-offline-outline` 64 `danger`, judul `Gagal memuat stream`, pesan dari §4.3, kotak diagnostik (label `URL`, teks URL selectable, `Kode HTTP: {status}` optional, maxWidth 560), tombol `Coba Lagi` (bila ada url) + `Kembali`.
- Top bar **selalu tampil (tanpa auto-hide)**; judul + badge `● LIVE` + `Channel {i+1}/{N}` + `Sekarang · {title}` / `Berikutnya · {title}`; tombol calendar bila `tvgId`; prev/next (`play-skip-back`/`forward`) dengan label aksesibilitas `Channel sebelumnya`/`Channel berikutnya`.
- **Tidak ada** gesture, key handler kustom, seek bar kustom, resume, atau progres buffer — kontrol dari native controls.
- Kotlin/Media3: `ExoPlayer` + `PlayerView` (atau Compose `PlayerSurface`) dengan kontrol native; implementasi pre-check, retry 600ms, banner, dan top bar sesuai di atas. Aktifkan HLS + `OkHttpDataSource` dengan header per-channel.

---

## 9. Publishing (`scripts/`)

- `prepare-update.js`: field output `packageName:'com.dyrlix.player'`, `versionCode`, `versionName`, `apkUrl`, `notes` (omit bila kosong), `publishedAt` ISO (`:46-53`).
- `publish-gh-pages.sh`: `APK_NAME=dyrlix-{versionName}.apk`, `APK_URL=https://raw.githubusercontent.com/{slug}/gh-pages/{file}`; `rm -f` semua `dyrlix-*.apk` lalu copy yang baru; regenerate `update.json`; `git add -A` + `git add -f *.apk`; commit `Rilis {versionName} (versionCode {code})`; push.
- **Hazard:** `rm` semua APK sebelum copy → `update.json` + APK **harus satu commit**; jangan sampai CI Pages menimpa `update.json`/APK; worktree gh-pages menyimpan snapshot sumber lama (jangan di-`git add -A` dari arah lain).
- Nama file beda sengaja: server `dyrlix-{versionName}.apk` vs in-app `dyrlix-{versionCode}.apk` (trap #10).

---

## 10. Checklist paritas (isi saat mengecek)

### Data
- [ ] M3U: 11 poin §4.1 (normalize, extractEpgUrl raw, header-before-EXTINF, `://` substring, group verbatim, dsb.)
- [ ] EPG: 12 poin §4.2 (gzip, decoder, window, tz, entities, dedupe, normalizeEpgId, now/next)
- [ ] Cache EPG: FNV-1a base36 + tanggal lokal + skip >4.5M
- [ ] Header merge case-insensitive + retry headers
- [ ] Health check hanya 404/410 dead + bug 410→"404"
- [ ] Semua string error §4.3/§4.4 identik

### UI
- [ ] 8 layar + nav SideNav/wide/modal sesuai §7
- [ ] Semua string state kosong/loading/error verbatim
- [ ] Semua cabang `isTV ? A : B` §6
- [ ] Focus awal §7 + focus ring 2dp `#38BDF8` (3dp far-view) + bg swap (tanpa scale di komponen RN; scale hanya far-view)
- [ ] Player: pre-check, retry 600ms, banner mati, error UI, top bar tanpa auto-hide, prev/next

### Ops
- [ ] `update.json` + APK satu commit; field manifest sama
- [ ] `versionCode 14` / `versionName 2.0.0`; update in-place lolos (keystore sama)
- [ ] Install/TV via `scripts/install-tv.sh`

---

## 11. Keputusan (disetujui)

1. **MIG-1 = (a) abaikan** — data AsyncStorage lama tidak dimigrasikan; user menambah ulang playlist. Jangan tulis kode pembaca `RKStorage`.
2. **PLAYER-1 = (a) PlayerView native Media3** + top bar/overlay/banners kustom sesuai §8.
3. **EPG-1 = (b) file cache terpisah** — `cacheDir/epg/<hash>-<YYYY-MM-DD>.json`, bukan DataStore.
4. **ICON-1 = (c) Ionicons TTF diunduh** dari paket `@expo/vector-icons` yang dipakai RN (versi & codepoint identik), dibundel ke `res/font/` + glyphmap JSON di `assets/`.

---

## 12. Fixture uji bersama (F10)

Buat `fixtures/` berisi file yang diuji **kedua** implementasi dengan hasil identik:
- `m3u/*.m3u` (BOM, zero-width, curly quotes, header-before-EXTINF, url dengan `>>`, tanpa koma, kutip tak seimbang, EXTHTTP/KODIPROP/EXTVLCOPT).
- `xmltv/*.xml(.gz)` (tz offset, tanpa tz, entity bertingkat, `<programme>` tanpa title, buffer >2MB tanpa marker).
- Hasil yang diharapkan (JSON) untuk tiap fixture.

---

## 13. Status implementasi native

- [x] F1 — port fondasi data, jaringan, EPG, penyimpanan, dan update manager.
- [ ] F5 — UI Compose. Semua route utama sudah punya implementasi awal di `ui/AppRoot.kt`: beranda, Playlist Saya, tambah playlist (URL/tempel/file), detail playlist, jadwal EPG, update, tentang, dan player Media3. Theme breakpoint compact/TV eksplisit, ikon Ionicons, banner informasi, state loading playlist, dan tombol izin installer sudah ditambahkan.
- [ ] Audit paritas visual, focus navigation di perangkat TV, dan semua state/copy harus ditinjau terhadap §6–§8.
- [ ] Build native belum dijalankan pada penyelesaian ini. Verifikasi runtime, playback nyata (termasuk HLS/header), dan instalasi update bertanda tangan yang cocok masih perlu dilakukan. Fixture lintas TS/Kotlin §12 belum dibuat.

Catatan implementasi: UI native sudah punya alur dasar untuk semua layar, tetapi status rilis siap pakai belum dapat diklaim sebelum build, uji playback nyata, pemasangan update bertanda tangan yang cocok, serta audit paritas/fokus TV berhasil. Perbarui checklist §10 berdasarkan verifikasi nyata.
