/* ============================================================
   FORMATTERS — dates, stats, safe N/A display
   ============================================================ */

export const NA = '<span class="na">N/D</span>';

export const FIXTURE_STATUS = {
  UPCOMING: ["NS","TBD","PST"],
  LIVE:     ["1H","HT","2H","ET","BT","P","INT","LIVE"],
  PLAYED:   ["FT","AET","PEN"],
};

/**
 * Return a safe value or N/D span.
 */
export function val(v, suffix = "") {
  if (v === null || v === undefined || v === "") return NA;
  return `${v}${suffix}`;
}

/**
 * Format a decimal to 1 decimal place, or N/D.
 */
export function decimal(v, suffix = "") {
  if (v === null || v === undefined) return NA;
  const n = parseFloat(v);
  if (isNaN(n)) return NA;
  return `${n.toFixed(1)}${suffix}`;
}

/**
 * Format a percentage value (e.g. "45%" or 0.45).
 */
export function percent(v) {
  if (v === null || v === undefined) return NA;
  const s = String(v);
  if (s.includes("%")) return s;
  const n = parseFloat(s);
  if (isNaN(n)) return NA;
  return `${Math.round(n * 100)}%`;
}

/**
 * Format a player rating (0–10, colored).
 */
export function rating(v) {
  if (v === null || v === undefined) return NA;
  const n = parseFloat(v);
  if (isNaN(n)) return NA;
  let cls = "rating-low";
  if (n >= 7.5) cls = "rating-high";
  else if (n >= 6.5) cls = "rating-mid";
  return `<span class="pstat-val rating ${cls}">${n.toFixed(2)}</span>`;
}

/**
 * Format a date string to locale date/time.
 * @param {string} iso  ISO 8601 string
 * @param {"date"|"time"|"datetime"|"short"} mode
 */
export function formatDate(iso, mode = "datetime") {
  if (!iso) return NA;
  try {
    const d = new Date(iso);
    if (isNaN(d)) return NA;

    const opts = {
      date: { day: "2-digit", month: "2-digit", year: "numeric" },
      time: { hour: "2-digit", minute: "2-digit" },
      datetime: { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },
      short: { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" },
    };

    return d.toLocaleString("fr-FR", opts[mode] || opts.datetime);
  } catch {
    return NA;
  }
}

/**
 * Relative time string (e.g. "dans 2h", "il y a 3j").
 */
export function timeAgo(iso) {
  if (!iso) return "";
  try {
    const diff = new Date(iso) - Date.now();
    const abs = Math.abs(diff);
    const mins = Math.floor(abs / 60000);
    const hours = Math.floor(abs / 3600000);
    const days = Math.floor(abs / 86400000);

    const past = diff < 0;

    if (mins < 1) return past ? "À l'instant" : "Maintenant";
    if (hours < 1) return past ? `il y a ${mins}min` : `dans ${mins}min`;
    if (days < 1)  return past ? `il y a ${hours}h`  : `dans ${hours}h`;
    if (days < 7)  return past ? `il y a ${days}j`   : `dans ${days}j`;
    return formatDate(iso, "short");
  } catch {
    return "";
  }
}

/**
 * Render a WDLWW form string as colored badges.
 */
export function formBadges(form) {
  if (!form) return NA;
  return form.split("").map(c => {
    const safe = ["W", "D", "L"].includes(c) ? c : "D";
    const label = safe === "W" ? "V" : safe === "D" ? "N" : "D";
    return `<span class="form-result ${safe}">${label}</span>`;
  }).join("");
}

/**
 * Render a fixture status badge.
 */
export function statusBadge(status, elapsed) {
  const { UPCOMING: upcoming, LIVE: liveStatuses, PLAYED: played } = FIXTURE_STATUS;

  if (liveStatuses.includes(status)) {
    const label = status === "HT" ? "Mi-temps" : `${elapsed ?? ""}' LIVE`;
    return `<span class="status-badge live">${label}</span>`;
  }
  if (upcoming.includes(status)) {
    return `<span class="status-badge ns">À venir</span>`;
  }
  if (played.includes(status)) {
    const label = status === "AET" ? "AP" : status === "PEN" ? "TAB" : "FT";
    return `<span class="status-badge ft">${label}</span>`;
  }
  return `<span class="status-badge ft">${status}</span>`;
}

/**
 * Display a score or "–" when not yet played.
 */
export function score(home, away) {
  if (home === null || home === undefined) return `<span class="hero-vs">VS</span>`;
  return `<span class="hero-score">${home} <span style="color:var(--text-muted)">-</span> ${away}</span>`;
}

/**
 * Friendly freshness string.
 */
export function freshness(iso) {
  if (!iso) return "Jamais mis à jour";
  return `Mis à jour ${timeAgo(iso)}`;
}

/**
 * Event type → emoji.
 */
export function eventIcon(type, detail) {
  if (type === "Goal") {
    if (detail === "Own Goal")   return "🔴";
    if (detail === "Penalty")    return "⚽🎯";
    return "⚽";
  }
  if (type === "Card") {
    if (detail === "Red Card")        return "🟥";
    if (detail === "Yellow Card")     return "🟨";
    if (detail === "Yellow Red Card") return "🟨🟥";
    return "🃏";
  }
  if (type === "subst")          return "🔄";
  if (type === "Var")            return "📺";
  return "•";
}

/**
 * Position abbreviation label.
 */
export function posLabel(pos) {
  const map = { G: "G", D: "D", M: "M", F: "A" };
  return map[pos] || pos || "";
}
