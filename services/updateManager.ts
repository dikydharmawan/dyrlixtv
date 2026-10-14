import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

/** Tata letak yang dipublikasikan bersama APK (mis. https://host/dyrlix/update.json). */
export interface UpdateManifest {
  packageName?: string;
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
  publishedAt?: string;
}

export type UpdateResult =
  | { status: 'ok'; available: boolean; message?: string; manifest?: UpdateManifest }
  | { status: 'error'; message: string };

/** URL manifest default dari app.json (extra.updateManifestUrl). */
export function defaultManifestUrl(): string {
  const fromConfig = Constants.expoConfig?.extra?.updateManifestUrl;
  return typeof fromConfig === 'string' ? fromConfig : '';
}

/** Versi aplikasi yang terpasang (versiName + versiCode) atau null bila tidak tersedia. */
export function getInstalledVersion(): { versionName: string | null; versionCode: number | null } {
  const raw = Application.nativeBuildVersion;
  const versionCode = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return {
    versionName: Application.nativeApplicationVersion ?? (Constants.expoConfig?.version ?? '1.0.11'),
    versionCode: Number.isFinite(versionCode) ? versionCode : (Constants.expoConfig?.android?.versionCode ?? 13),
  };
}

/** Menambahkan query anti-cache agar CDN/proxy tidak menyajikan update.json lama. */
function withCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
}

/**
 * Beberapa URL yang layak dicoba untuk manifest yang sama.
 *
 * jsDelivr `@branch` menyimpan pemetaan branch→commit sampai 12 jam, sehingga
 * manifest bisa "macet" di versi lama walau file di GitHub sudah baru. Karena
 * itu, bila URL memakai jsDelivr, kami tambahkan padanan raw.githubusercontent
 * sebagai cadangan. Pemanggil memilih manifest dengan versionCode tertinggi.
 */
function candidateManifestUrls(url: string): string[] {
  const urls = [url];
  const match = url.match(
    /^https?:\/\/cdn\.jsdelivr\.net\/gh\/([^/@]+)\/([^/@]+)@([^/]+)\/(.+)$/,
  );
  if (match) {
    const [, user, repo, ref, path] = match;
    urls.push(`https://raw.githubusercontent.com/${user}/${repo}/${ref}/${path}`);
  }
  return urls;
}

async function fetchManifest(manifestUrl: string): Promise<UpdateManifest> {
  let lastError: unknown;
  let best: UpdateManifest | null = null;

  for (const candidate of candidateManifestUrls(manifestUrl)) {
    try {
      const res = await fetch(withCacheBuster(candidate), {
        headers: { accept: 'application/json', 'cache-control': 'no-cache' },
      });
      if (!res.ok) {
        lastError = new Error(`Server merespons HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as Partial<UpdateManifest>;
      if (
        typeof data?.versionCode !== 'number' ||
        typeof data?.apkUrl !== 'string' ||
        !data.apkUrl
      ) {
        lastError = new Error('update.json tidak valid (butuh versionCode & apkUrl).');
        continue;
      }
      const applicationId = Application.applicationId;
      if (
        applicationId &&
        typeof data.packageName === 'string' &&
        data.packageName !== applicationId
      ) {
        lastError = new Error('Manifest update bukan untuk aplikasi ini.');
        continue;
      }
      const manifest = data as UpdateManifest;
      if (!best || manifest.versionCode > best.versionCode) {
        best = manifest;
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (!best) {
    throw lastError instanceof Error ? lastError : new Error('Gagal memuat manifest update.');
  }
  return best;
}

/** Periksa apakah ada versi lebih baru dari yang terpasang. */
export async function checkForUpdates(manifestUrl: string): Promise<UpdateResult> {
  const url = manifestUrl.trim();
  if (!url) {
    return { status: 'error', message: 'URL manifest update belum diisi.' };
  }
  try {
    const installed = getInstalledVersion();
    if (installed.versionCode === null) {
      return { status: 'error', message: 'Versi terpasang tidak bisa dibaca.' };
    }
    const manifest = await fetchManifest(url);
    const available = manifest.versionCode > installed.versionCode;
    return {
      status: 'ok',
      available,
      manifest,
      message: available
        ? `Update ${manifest.versionName} tersedia.`
        : 'Aplikasi sudah dalam versi terbaru.',
    };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Gagal memeriksa update.',
    };
  }
}

/** Unduh APK lalu buka installer sistem (Android). */
export async function downloadAndInstall(manifest: UpdateManifest): Promise<UpdateResult> {
  try {
    const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!base) {
      return { status: 'error', message: 'Penyimpanan file tidak tersedia.' };
    }
    const fileName = `dyrlix-${manifest.versionCode}.apk`;
    const targetUri = `${base}${fileName}`;

    const download = await FileSystem.downloadAsync(manifest.apkUrl, targetUri);
    if (download.status >= 400) {
      throw new Error(`Download gagal (HTTP ${download.status}).`);
    }

    const contentUri = await FileSystem.getContentUriAsync(download.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 0x10000000 | 0x00000001, // FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION
    });
    return { status: 'ok', available: false, message: 'Installer aplikasi telah dibuka.' };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Gagal membuka installer.',
    };
  }
}

/** Buka pengaturan "Instal aplikasi tidak dikenal" untuk aplikasi ini. */
export function openInstallPermissionSettings(): Promise<IntentLauncher.IntentLauncherResult> {
  const packageName = Application.applicationId ?? 'com.dyrlix.player';
  return IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
    { data: `package:${packageName}` },
  );
}