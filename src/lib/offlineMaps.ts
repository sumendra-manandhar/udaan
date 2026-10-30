import { db } from '../db/db';
import { tilesForBounds } from './geo';

/** OpenFreeMap's public instance allows offline downloads of up to 3,000
 * tiles / 50 MB per area, with at most 4 parallel requests. Stay inside that. */
export const MAX_TILES = 3000;
const PARALLEL = 4;
const CACHE = 'map-tiles';

export const MAP_STYLE_URL =
  (import.meta.env.VITE_MAP_STYLE_URL as string | undefined) ?? 'https://tiles.openfreemap.org/styles/dark';

export interface SavedArea {
  id: string;
  name: string;
  bounds: [number, number, number, number]; // w, s, e, n
  minZoom: number;
  maxZoom: number;
  tiles: number;
  saved_at: string;
}

async function tileTemplates(): Promise<string[]> {
  const style = await (await fetch(MAP_STYLE_URL)).json();
  const templates: string[] = [];
  for (const source of Object.values(style.sources ?? {}) as { url?: string; tiles?: string[] }[]) {
    if (source.tiles) templates.push(...source.tiles);
    else if (source.url) {
      const tj = await (await fetch(source.url)).json();
      if (tj.tiles) templates.push(...tj.tiles);
    }
  }
  return templates;
}

export function countTiles(bounds: SavedArea['bounds'], minZoom: number, maxZoom: number, sources = 2): number {
  let n = 0;
  for (let z = minZoom; z <= maxZoom; z++) n += tilesForBounds(...bounds, z).length;
  return n * sources;
}

/** Pick the deepest zoom that keeps the area under the tile limit. */
export function bestMaxZoom(bounds: SavedArea['bounds'], minZoom: number, cap = 15): number {
  let z = minZoom;
  while (z < cap && countTiles(bounds, minZoom, z + 1) <= MAX_TILES) z++;
  return z;
}

export async function saveArea(
  name: string,
  bounds: SavedArea['bounds'],
  minZoom: number,
  maxZoom: number,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<SavedArea> {
  const templates = await tileTemplates();
  const urls: string[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    for (const [tz, x, y] of tilesForBounds(...bounds, z)) {
      for (const tpl of templates) urls.push(tpl.replace('{z}', String(tz)).replace('{x}', String(x)).replace('{y}', String(y)));
    }
  }
  if (urls.length > MAX_TILES) throw new Error(`That area needs ${urls.length} tiles; the limit is ${MAX_TILES}. Zoom in or lower the detail.`);
  const cache = await caches.open(CACHE);
  let done = 0;
  let next = 0;
  async function worker() {
    while (next < urls.length) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const url = urls[next++];
      if (!(await cache.match(url))) {
        const res = await fetch(url, { signal });
        if (res.ok) await cache.put(url, res);
      }
      onProgress(++done, urls.length);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  const area: SavedArea = {
    id: crypto.randomUUID(),
    name,
    bounds,
    minZoom,
    maxZoom,
    tiles: urls.length,
    saved_at: new Date().toISOString(),
  };
  await db.meta.put({ key: `area:${area.id}`, value: area });
  return area;
}

export async function listAreas(): Promise<SavedArea[]> {
  const rows = await db.meta.where('key').startsWith('area:').toArray();
  return rows.map((r) => r.value as SavedArea).sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}

export async function removeArea(id: string): Promise<void> {
  await db.meta.delete(`area:${id}`);
}
