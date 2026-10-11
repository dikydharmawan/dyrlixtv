import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@iptv_player/dead_links:v1';

interface DeadEntry {
  ids: string[];
  updatedAt: number;
}

type DeadMap = Record<string, DeadEntry>;

async function readMap(): Promise<DeadMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as DeadMap;
  } catch {
    return {};
  }
}

async function writeMap(map: DeadMap): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // gagal menyimpan bukan masalah fatal
  }
}

/**
 * Channel mati hasil pemindaian disimpan per "key" (id playlist, atau `bawaan`
 * untuk channel bawaan). Dipakai agar penandaan MATI tetap ada setelah app ditutup.
 */
export async function getDeadLinks(key: string): Promise<Set<string>> {
  const map = await readMap();
  return new Set(map[key]?.ids ?? []);
}

export async function setDeadLinks(key: string, ids: Iterable<string>): Promise<void> {
  const map = await readMap();
  map[key] = { ids: [...new Set(ids)], updatedAt: Date.now() };
  await writeMap(map);
}

export async function clearDeadLinks(key: string): Promise<void> {
  const map = await readMap();
  if (key in map) {
    delete map[key];
    await writeMap(map);
  }
}
