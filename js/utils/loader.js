/* ============================================================
   DATA LOADER — fetch JSON files with memory cache
   ============================================================ */

const _cache = new Map();
const BASE = (typeof window !== "undefined")
  ? window.location.pathname.replace(/\/[^/]*$/, "")
  : "";

/**
 * Load a JSON file from /data/. Returns null on any error.
 * @param {string} path  relative to repo root, e.g. "data/meta.json"
 */
export async function loadData(path) {
  if (_cache.has(path)) return _cache.get(path);

  try {
    const url = `${BASE}/${path}`;
    const resp = await fetch(url, { cache: "default" });

    if (resp.status === 404) {
      _cache.set(path, null);
      return null;
    }

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    _cache.set(path, data);
    return data;
  } catch (err) {
    console.warn(`[loader] Failed to load ${path}:`, err.message);
    _cache.set(path, null);
    return null;
  }
}

/**
 * Load multiple paths in parallel. Returns array in same order.
 */
export async function loadAll(paths) {
  return Promise.all(paths.map(loadData));
}

/**
 * Load the fixture detail for a given ID.
 */
export async function loadFixture(id) {
  return loadData(`data/fixtures/${id}.json`);
}

/**
 * Load meta.json for freshness info.
 */
export async function loadMeta() {
  return loadData("data/meta.json");
}

/**
 * Bust cache for a specific path (used for manual refresh).
 */
export function bustCache(path) {
  if (path) {
    _cache.delete(path);
  } else {
    _cache.clear();
  }
}
