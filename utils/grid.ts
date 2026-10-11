export interface GridPlaceholder {
  id: string;
  __placeholder: true;
}

export function isPlaceholder<T>(item: T | GridPlaceholder): item is GridPlaceholder {
  return Boolean(item && typeof item === 'object' && '__placeholder' in (item as object));
}

/**
 * Menambahkan item kosong agar baris terakhir grid tetap rapi
 * (tidak ada kartu yang melebar memenuhi satu baris).
 */
export function withGridPlaceholders<T extends { id: string }>(
  items: T[],
  columns: number,
): Array<T | GridPlaceholder> {
  if (columns <= 1 || items.length === 0) return items;

  const remainder = items.length % columns;
  if (remainder === 0) return items;

  const fillers: GridPlaceholder[] = Array.from(
    { length: columns - remainder },
    (_, index) => ({ id: `__placeholder_${index}`, __placeholder: true }),
  );

  return [...items, ...fillers];
}
