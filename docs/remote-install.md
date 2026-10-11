# DYRLIX — Install & Update Jarak Jauh (10 Perangkat, Lintas Jaringan)

Aplikasi dipasang dengan cara sideload (bukan Play Store). Karena perangkat TV/STB
berada di jaringan (rumah/kantor) yang berbeda-beda, pembaruan ditangani oleh
**self-updater di dalam aplikasi** (tidak butuh Tailscale maupun layanan pihak
ketiga). Tailscale hanya tersedia sebagai cadangan opsional untuk menembus koneksi
ADB manual dari PC.

---

## 0. Cara utama: pembaruan lewat aplikasi (self-updater)

Setiap perangkat bisa memperbarui sendiri APK-nya selama masih terhubung internet.

### a. Terbitkan APK + manifest ke host Anda

**Cara singkat (gh-pages sebagai hosting):**
1. Naikkan `version` + `versionCode` di `app.json`.
2. Build rilis: `npx eas-cli build -p android --profile release` (output `dyrlix.apk`).
3. Publikasikan (mengunggah APK + `update.json` ke branch `gh-pages`):

   ```bash
   ./scripts/publish-gh-pages.sh \
     --apk ./dyrlix.apk \
     --version-code 5 \
     --version-name 1.0.3 \
     --notes "Playback lebih lancar, ukuran APK lebih kecil"
   ```

   Manifest default: `https://raw.githubusercontent.com/dikydharmawan/dyrlixtv/gh-pages/update.json`.

**Cara manual / host sendiri:**
1. Jalankan build rilis dengan EAS (profil `release`, output APK) — `dyrlix.apk`.
2. Cek **versionCode** hasil build (EAS menomori dari 1, 2, 3, ...). Lihat detail
   build di https://expo.dev → project dyrlix → builds.
3. Upload APK ke hosting statis/halaman Anda (contoh: localhost, NAS, GitHub,
   Cloudflare Pages — apa pun yang bisa diakses perangkat TV).
4. Siapkan `update.json` (boleh manual, atau skrip):

   ```bash
   node scripts/prepare-update.js \
     --version-code 2 \
     --version-name 1.0.1 \
     --apk-url https://host-anda.com/dyrlix/dyrlix-2.apk \
     --notes "Perbaikan playback & stabilitas"
   ```

   Hasilnya kira-kira:

   ```json
   {
     "packageName": "com.dyrlix.player",
     "versionCode": 2,
     "versionName": "1.0.1",
     "apkUrl": "https://host-anda.com/dyrlix/dyrlix-2.apk",
     "notes": "Perbaikan playback & stabilitas",
     "publishedAt": "2026-10-11T00:00:00Z"
   }
   ```

### b. Jalankan di perangkat
1. Buka tab **Update** di DYRLIX.
2. Isi URL `update.json` (perangkat menyimpannya; bisa juga diubah via
   `app.json` → `extra.updateManifestUrl` untuk default bawaan). Untuk hosting
   gh-pages, pakai URL raw GitHub (pembaruan cepat & andal):

   ```
   https://raw.githubusercontent.com/dikydharmawan/dyrlixtv/gh-pages/update.json
   ```
3. Tekan **Periksa Update** → bila ada versi baru, **Unduh & Pasang**.
4. Installer sistem akan terbuka. Jika diminta, izinkan "Instal aplikasi tidak
   dikenal" untuk DYRLIX (tombol **Buka Izin Instal Aplikasi** di tab Update
   mengarah ke halaman itu).

Cara ini bekerja untuk **semua 10 perangkat sekaligus** — cukup update satu file
`update.json` + APK di server; tiap perangkat yang memeriksa akan mendapat versi baru.

---

## 1. Cadangan: install/update manual via Tailscale + adb (opsional)

```
PC Anda (jaringan A) ─┬─ 100.x.0.11  TV Ruang Tamu  (rumah B)
                      ├─ 100.x.0.12  STB Kamar       (rumah B)
                      ├─ 100.x.1.21  TV Ruang Keluarga (rumah C)
                      ├─ ... sampai 10 perangkat
                      └─ semuanya lewat Tailscale (VPN mesh)
```

---

## 1. Persiapkan akun & PC

1. Buka https://login.tailscale.com → buat akun (gratis, sampai 100 perangkat).
2. Install Tailscale di **PC**:
   - Linux: `curl -fsSL https://tailscale.com/install.sh | sh` lalu `sudo tailscale up`.
   - Windows/macOS: unduh dari https://tailscale.com/download, login akun yang sama.
3. Pastikan PC sudah punya `adb` (Android platform-tools). Cek: `adb version`.

## 2. Setup tiap TV/STB (sekali saja, per perangkat)

> Buka item dengan "Developer options" modelnya hampir sama antarmerek; lokasi menu
> bisa sedikit berbeda di Google TV vs Android TV polos vs STB.

### a. Izinkan sideload aplikasi
- **Google TV:** Settings → Apps → Security & restrictions → **Unknown sources = ON**
  (aktifkan untuk browser/file manager/Tailscale).
- **Android TV / STB:** Settings → Device Preferences (atau Security) →
  **Unknown sources = ON**.

### b. Buka Developer options & nyalakan ADB jaringan
1. Settings → About/Device → klik **Build** 7× → muncul _Developer options_.
2. Developer options → aktifkan **USB debugging** (jika ada) dan **Network/Wireless
   debugging** (jika ada).
3. Beberapa STB langsung bisa `adb connect` begitu network debugging hidup. Bila tidak
   ada opsi "network debugging", tetap jalan: `adb connect` lewat Tailscale memakai
   layanan ADB over TCP yang sudah default di sebagian besar Android.

### c. Install Tailscale di TV/STB
- Jika TV punya **Play Store**: install **Tailscale** → buka → login sekali pakai
  kode dari https://login.tailscale.com/start → perangkat masuk mesh.
- Jika tidak ada Play Store/file manager: unduh APK Tailscale (pilih `arm64-v8a`
  atau `armeabi-v7a` sesuai STB) di https://pkgs.tailscale.com/stable/ → salin ke
  flashdisk → tancapkan ke STB → klik APK → izinkan **Unknown sources**.
- Setelah login, catat **IP Tailscale** tiap perangkat (teringat di
  https://login.tailscale.com/admin/machines).

> Konfirmasi: semua perangkat selain PC harus **login ke akun Tailscale yang sama**.
> Perangkat tetap "beda lingkup jaringan" — tidak masalah, mesh Tailscale yang jembatani.

### d. Catat IP ke `tv-hosts.txt`
Buka file `tv-hosts.txt` di akar proyek, isi IP Tailscale tiap perangkat:

```
100.100.1.11    # TV Ruang Tamu
100.100.1.12    # STB Kamar
100.100.2.21    # TV Ruang Keluarga
```

## 3. Install/update dari mana saja

```bash
# Install pertama (dari PC mana pun yang ada internet)
./scripts/install-tv.sh

# Update ke versi APK baru
./scripts/update-tv.sh

# Opsional: tentukan APK lain
./scripts/install-tv.sh --apk /jalan/ke/dyrlix.apk
```

Yang dilakukan script tiap perangkat: `adb connect IP:5555` → `adb install [-r]` →
verifikasi package (`pm path com.dyrlix.player`) → laporan ringkas.

- Instalasi default memakai `dyrlix.apk` di akar proyek.
- IP boleh ditimpa port: `100.x.0.11:4567`.
- Hasil gagal tidak menghentikan perangkat lain.

## 4. Pakai aplikasi

- Buka **DYRLIX** di tiap perangkat.
- **Beranda**: TVRI Nasional & TVRI Sport langsung jalan.
- Tambah channel: Playlist Saya → Tambah Playlist → mode **URL** (link M3U publik)
  atau **TEMPEL** (isi manual, disimpan lokal per perangkat).

### (Opsional) Playlist terpusat — update konten tanpa install ulang
1. Upload `channels.m3u` ke hosting statis gratis (mis. GitHub raw, Cloudflare Pages).
2. Di tiap perangkat pakai mode **URL** ke link tersebut.
3. Tiap buka app, playlist ikut ter-update otomatis.

## Keamanan

- **Jangan pernah** membuka port ADB ke internet tanpa VPN. Semua akses remote harus
  lewat Tailscale (mesh terenkripsi) — inilah kenapa kita pakai Tailscale.
- Playlist/stream dari pihak ketiga sepenuhnya tanggung jawab pengguna.

## Troubleshooting

| Gejala | Solusi |
| --- | --- |
| `adb connect` tidak terhubung | Cek perangkat sudah login Tailscale (admin/machines). Pastikan PC juga `tailscale up`. Coba `tailscale ping <ip>` dari PC. |
| `DEVICE_UNAUTHORIZED` | Buka dialog "Allow debugging?" di TV → Allow. |
| Install gagal `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Pakai `./scripts/update-tv.sh` (pakai `-d`). |
| TV tidak muncul developer options | Klik **Build** 7×; beberapa STB memakai kombinasi lain (tahan OK berkali-kali). |
| STB tak bisa install Tailscale | Pakai flashdisk + izinkan Unknown sources untuk installer file. |
| Lima+ perangkat sekali | Tambah semua ke `tv-hosts.txt`, jalankan `./scripts/install-tv.sh` sekali. |

## Referensi
- Tailscale: https://tailscale.com
- APK Tailscale stable: https://pkgs.tailscale.com/stable/
- Android platform-tools (adb): https://developer.android.com/tools/releases/platform-tools