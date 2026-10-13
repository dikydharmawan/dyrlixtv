import type { Channel } from '@/types';

export interface CategorySummary {
  /** Nama kategori unik, diurutkan dari jumlah channel terbanyak. */
  categories: string[];
  /** Jumlah channel per kategori. */
  counts: Record<string, number>;
}

/** Ringkas daftar channel menjadi kategori + jumlahnya, diurutkan terbanyak dulu. */
export function summarizeCategories(channels: Channel[]): CategorySummary {
  const counts: Record<string, number> = {};
  for (const channel of channels) {
    const key = channel.group ?? 'Umum';
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const categories = Object.keys(counts).sort((a, b) => {
    const diff = (counts[b] ?? 0) - (counts[a] ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  return { categories, counts };
}
