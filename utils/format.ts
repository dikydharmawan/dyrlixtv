/** Format timestamp menjadi tanggal yang mudah dibaca (contoh: 11 Okt 2026). */
export function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}
