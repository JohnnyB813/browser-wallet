export interface WatchedAsset { hash: string; customName?: string }
const key = (address: string) => `warthogWatchedAssets_${address.toLowerCase()}`;
export function loadWatched(address: string): WatchedAsset[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(address)) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: string | WatchedAsset) => typeof item === "string" ? { hash: item } : item)
      .filter((item): item is WatchedAsset => Boolean(item && typeof item.hash === "string" && /^[a-f0-9]{64}$/i.test(item.hash)));
  } catch { return []; }
}
export function saveWatched(address: string, items: WatchedAsset[]) {
  localStorage.setItem(key(address), JSON.stringify(items));
}
