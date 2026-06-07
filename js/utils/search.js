import { FIXTURE_STATUS } from "./format.js";

/* ============================================================
   SEARCH & FILTER UTILITIES
   ============================================================ */

/**
 * Simple case-insensitive substring search across multiple fields.
 * @param {object[]} items
 * @param {string}   query
 * @param {Function} getFields  (item) => string[]  — fields to search
 */
export function fuzzyFilter(items, query, getFields) {
  if (!query || !query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter(item =>
    getFields(item).some(f => f && String(f).toLowerCase().includes(q))
  );
}

/**
 * Filter fixtures by:
 *  - leagueId  (number | null)
 *  - status    ("upcoming" | "played" | "all")
 *  - teamId    (number | null)
 */
export function filterFixtures(fixtures, { leagueId, status, teamId, query } = {}) {
  const { UPCOMING, PLAYED } = FIXTURE_STATUS;

  return fixtures.filter(fix => {
    if (leagueId && fix.league?.id !== leagueId) return false;

    if (status === "upcoming" && !UPCOMING.includes(fix.status)) return false;
    if (status === "played"   && !PLAYED.includes(fix.status))   return false;

    if (teamId) {
      const hid = fix.teams?.home?.id;
      const aid = fix.teams?.away?.id;
      if (hid !== teamId && aid !== teamId) return false;
    }

    if (query) {
      const q = query.toLowerCase();
      const hn = fix.teams?.home?.name?.toLowerCase() || "";
      const an = fix.teams?.away?.name?.toLowerCase() || "";
      const ln = fix.league?.name?.toLowerCase() || "";
      if (!hn.includes(q) && !an.includes(q) && !ln.includes(q)) return false;
    }

    return true;
  });
}

/**
 * Extract unique leagues from a fixture list.
 */
export function extractLeagues(fixtures) {
  const map = new Map();
  fixtures.forEach(f => {
    if (f.league?.id) map.set(f.league.id, f.league);
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sort an array by a numeric or string field.
 * @param {object[]} items
 * @param {string}   field  dot-path e.g. "stats.goals"
 * @param {"asc"|"desc"} dir
 */
export function sortBy(items, field, dir = "desc") {
  const get = (obj, path) =>
    path.split(".").reduce((o, k) => (o ?? {})[k], obj) ?? null;

  return [...items].sort((a, b) => {
    const va = get(a, field);
    const vb = get(b, field);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
    return dir === "asc" ? cmp : -cmp;
  });
}

/**
 * Attach sort behaviour to a <thead> row.
 * @param {HTMLElement} thead
 * @param {object[]}    data        reactive array (replaced in place)
 * @param {Function}    renderFn    () => void  called after sort
 */
export function attachSortHandlers(thead, data, renderFn) {
  let currentField = null;
  let currentDir   = "desc";

  thead.querySelectorAll("[data-sort]").forEach(th => {
    th.classList.add("sort-th");
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      if (currentField === field) {
        currentDir = currentDir === "desc" ? "asc" : "desc";
      } else {
        currentField = field;
        currentDir   = "desc";
      }

      thead.querySelectorAll(".sort-th").forEach(h => {
        h.classList.remove("asc", "desc");
      });
      th.classList.add(currentDir);

      const sorted = sortBy(data, field, currentDir);
      data.length = 0;
      data.push(...sorted);
      renderFn();
    });
  });
}
