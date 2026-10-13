import type { ImperativeRouter } from 'expo-router';

/**
 * Kembali ke halaman sebelumnya. Bila tidak ada riwayat (mis. layar dibuka
 * langsung lewat deep link / tautan), arahkan ke Beranda agar tidak memicu
 * peringatan "The action 'GO_BACK' was not handled by any navigator".
 */
export function goBack(router: ImperativeRouter): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}
