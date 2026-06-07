import { loadData } from "../utils/loader.js";
import { val, decimal, freshness, rating as fmtRating, NA } from "../utils/format.js";
import { fuzzyFilter, sortBy } from "../utils/search.js";

export default async function renderPlayers(container) {
  container.innerHTML = `
    <div class="page">
      <div class="search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input class="search-input" id="playerSearch" type="search"
               placeholder="Joueur, équipe…" autocomplete="off">
      </div>
      <div class="filter-chips" id="playerSortChips">
        <button class="chip active" data-sort="season_stats.goals.total">Buts</button>
        <button class="chip" data-sort="season_stats.goals.assists">Passes D</button>
        <button class="chip" data-sort="season_stats.rating">Note</button>
        <button class="chip" data-sort="season_stats.appearances">Matchs</button>
      </div>
      <div id="playerList"><div class="loading-state"><div class="spinner"></div></div></div>
      <div class="freshness" id="playerFreshness"></div>
    </div>`;

  const [data, meta] = await Promise.all([
    loadData("data/players.json"),
    loadData("data/meta.json"),
  ]);

  const freshEl = container.querySelector("#playerFreshness");
  if (meta?.last_updated?.players) {
    freshEl.textContent = `${freshness(meta.last_updated.players)} · Source : API-Football`;
  }

  if (!data?.players?.length) {
    container.querySelector("#playerList").innerHTML = `
      <div class="empty-state">
        <div class="state-icon">👤</div>
        <p>Données joueurs non encore générées.<br>Lance le workflow fetch-stats.</p>
      </div>`;
    return;
  }

  let players   = [...data.players];
  let sortField = "season_stats.goals.total";
  let searchQ   = "";
  let expanded  = null; // player id expanded

  function current() {
    let p = fuzzyFilter(players, searchQ, pl => [pl.name, pl.firstname, pl.lastname, pl.team?.name, pl.nationality]);
    return sortBy(p, sortField, "desc");
  }

  function render() {
    const list = current();
    const el   = container.querySelector("#playerList");

    if (!list.length) {
      el.innerHTML = `<div class="empty-state"><p>Aucun joueur trouvé</p></div>`;
      return;
    }

    el.innerHTML = list.map(p => playerRow(p, expanded === p.id)).join("");
  }

  // Event delegation — survives re-renders
  container.querySelector("#playerList").addEventListener("click", e => {
    const row = e.target.closest(".player-row[data-id]");
    if (!row) return;
    const id = parseInt(row.dataset.id);
    expanded = expanded === id ? null : id;
    render();
  });

  container.querySelector("#playerSortChips").addEventListener("click", e => {
    const chip = e.target.closest("[data-sort]");
    if (!chip) return;
    sortField = chip.dataset.sort;
    container.querySelectorAll("#playerSortChips .chip").forEach(c =>
      c.classList.toggle("active", c === chip)
    );
    render();
  });

  container.querySelector("#playerSearch").addEventListener("input", e => {
    searchQ = e.target.value;
    render();
  });

  render();
}

function playerRow(p, isExpanded) {
  const s = p.season_stats ?? {};
  const goals   = s.goals?.total ?? null;
  const assists = s.goals?.assists ?? null;
  const apps = s.appearances ?? null;
  const mins = s.minutes ?? null;
  const yc   = s.cards?.yellow ?? null;
  const rc   = s.cards?.red ?? null;

  const expandedHtml = isExpanded ? `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <div class="mini-stat">
        <span class="mini-stat-val">${val(apps)}</span>
        <span class="mini-stat-lbl">Matchs</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat-val">${val(mins, "'")}</span>
        <span class="mini-stat-lbl">Minutes</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat-val">${val(s.shots?.on)}</span>
        <span class="mini-stat-lbl">Tirs cadrés</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat-val">${yc != null ? `<span style="color:var(--draw)">${yc}</span>` : NA}</span>
        <span class="mini-stat-lbl">🟨</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat-val">${rc != null ? `<span style="color:var(--loss)">${rc}</span>` : NA}</span>
        <span class="mini-stat-lbl">🟥</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat-val">${val(s.penalty?.scored)}</span>
        <span class="mini-stat-lbl">Pénaltys</span>
      </div>
      <div class="mini-stat" style="grid-column:1/-1">
        <span class="mini-stat-lbl">Compétition</span>
        <span style="font-size:.8rem;color:var(--text)">${p.season_stats?.league?.name ?? "—"} ${p.season_stats?.league?.season ?? ""}</span>
      </div>
    </div>` : "";

  return `
    <div class="player-row" data-id="${p.id}">
      ${p.photo
        ? `<img class="player-row-photo" src="${p.photo}" alt="" loading="lazy">`
        : `<div class="player-row-photo" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem">👤</div>`}
      <div style="flex:1;min-width:0">
        <div class="player-row-name">${p.name ?? "—"}</div>
        <div class="player-row-team">${p.team?.name ?? ""} · ${p.nationality ?? ""}</div>
        <div style="display:flex;gap:14px;margin-top:6px">
          <div class="mini-stat">
            <span class="mini-stat-val" style="color:var(--win)">${val(goals)}</span>
            <span class="mini-stat-lbl">Buts</span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-val" style="color:var(--accent)">${val(assists)}</span>
            <span class="mini-stat-lbl">Passes D</span>
          </div>
          <div class="mini-stat">
            ${fmtRating(s.rating)}
            <span class="mini-stat-lbl">Note</span>
          </div>
        </div>
        ${expandedHtml}
      </div>
      <div style="color:var(--text-muted);font-size:1.1rem;padding-left:8px">${isExpanded ? "▲" : "▼"}</div>
    </div>`;
}
