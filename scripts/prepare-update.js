#!/usr/bin/env node
/**
 * Siapkan file manifest update.json untuk self-updater DYRLIX.
 *
 * Manfaatkan versi yang dihasilkan EAS: saat build, lihat "build version / version code"
 * yang tercantum di halaman build atau `eas build:list`, lalu teruskan ke skrip ini.
 *
 * Pemakaian:
 *   node scripts/prepare-update.js \
 *     --version-code 2 \
 *     --version-name 1.0.1 \
 *     --apk-url https://host-anda.com/dyrlix/dyrlix-1.0.1.apk \
 *     --notes "Perbaikan playback & stabilitas" \
 *     [--out update.json]
 */

const fs = require('fs');
const path = require('path');

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const versionCode = Number(arg('--version-code', ''));
const versionName = arg('--version-name', '');
const apkUrl = arg('--apk-url', '');
const notes = arg('--notes', '');
const out = arg('--out', 'update.json');

if (!Number.isInteger(versionCode) || versionCode < 1) {
  console.error('Argumen wajib: --version-code <angka>  (contoh: 2)');
  process.exit(1);
}

let versionFallback = versionName;
let appJsonVersion = null;
try {
  const appJsonPath = path.resolve(__dirname, '..', 'app.json');
  appJsonVersion = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')).expo?.version;
} catch {
  /* abaikan bila app.json tidak terbaca */
}
if (!versionFallback && appJsonVersion) versionFallback = appJsonVersion;

const manifest = {
  packageName: 'com.dyrlix.player',
  versionCode,
  versionName: versionFallback,
  apkUrl,
  notes: notes || undefined,
  publishedAt: new Date().toISOString(),
};

try {
  const previous = JSON.parse(fs.readFileSync(out, 'utf8'));
  if (previous.versionCode >= versionCode) {
    console.warn(
      `Peringatan: update.json saat ini sudah versionCode ${previous.versionCode} (>= ${versionCode}). ` +
        'Pastikan Anda menaikkan versi aplikasi di EAS terlebih dahulu.',
    );
  }
} catch {
  /* file belum ada */
}

fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Ditulis ke ${out}:`);
console.log(manifest);
console.log('\nUpload file ini + APK ke host Anda, lalu pastikan URL-nya sama dengan');
console.log('URL manifest di layar Update aplikasi.');