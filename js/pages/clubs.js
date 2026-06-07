import { loadData } from "../utils/loader.js";
import { decimal, formBadges, val, freshness } from "../utils/format.js";
import { fuzzyFilter, sortBy } from "../utils/search.js";

export default async function renderClubs(container) {
  container.innerHTML = `
    <div class="page">
      <div class="search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input class="search-input" id="clubSearch" type="search"
               placeholder="Club, championnat…" autocomplete="off">
      </div>
      <div class="filter-chips" id="clubSortChips">
        <button class="chip active" data-sort="goals_for_avg">Buts/m</button>
        <button class="chip" data-sort="wins">Victoires</button>
        <button class="chip" data-sort="goals_against_avg" data-dir="asc">Enc./m ↑</button>
        <button class="chip" data-sort="fouls_avg">Fautes/m</button>
        <button class="chip" data-sort="yellow_cards_avg">Jaunes/m</button>
      </div>
      <div id="clubList"><div class="loading-state"><div class="spinner"></div></div></div>
      <div class="freshness" id="clubFreshness"></div>
    </div>`;

  const [data, meta] = await Promise.all([
    loadData("data/teams-clubs.json"),
    loadData("data/meta.json"),
  ]);

  const freshEl = container.querySelector("#clubFreshness");
  if (meta?.last_updated?.teams_clubs) {
    freshEl.textContent = `${freshness(meta.last_updated.teams_clubs)} · Source : API-Football`;
  }

  if (!data?.clubs?.length) {
    container.querySelector("#clubList").innerHTML = `
      <div class="empty-state">
        <div class="state-icon">🏟</div>
        <p>Données clubs non encore générées.<br>Lance le workflow fetch-stats.</p>
      </div>`;
    return;
  }

  let clubs     = [...data.clubs];
  let sortField = "goals_for_avg";
  let sortDir   = "desc";
  let searchQ   = "";

  function current() {
    let c = fuzzyFilter(clubs, searchQ, cl => [cl.name, cl.country, cl.league?.name]);
    return sortBy(c, sortField, sortDir);
  }

  function render() {
    const list = current();
    const el   = container.querySelector("#clubList");

    if (!list.length) {
      el.innerHTML = `<div class="empty-state"><p>Aucun club trouvé</p></div>`;
      return;
    }

    el.innerHTML = list.map((club, i) => clubCard(club, i + 1)).join("");
  }

  container.querySelector("#clubSortChips").addEventListener("click", e => {
    const chip = e.target.closest("[data-sort]");
    if (!chip) return;
    sortField = chip.dataset.sort;
    sortDir   = chip.dataset.dir || "desc";
    container.querySelectorAll("#clubSortChips .chip").forEach(c =>
      c.classList.toggle("active", c === chip)
    );
    render();
  });

  container.querySelector("#clubSearch").addEventListener("input", e => {
    searchQ = e.target.value;
    render();
  });

  render();
}

function clubCard(club, rank) {
  return `
    <div class="team-card">
      <div class="team-card-header">
        <div style="font-size:.85rem;font-weight:800;color:var(--text-muted);min-width:24px">#${rank}</div>
        ${club.logo
          ? `<img class="team-card-logo" src="${club.logo}" alt="" loading="lazy">`
          : `<div class="team-card-logo" style="display:flex;align-items:center;justify-content:center;font-size:1.4rem">🏟</div>`}
        <div style="flex:1;min-width:0">
          <div class="team-card-name">${club.name}</div>
          <div class="team-card-league">${club.league?.name ?? ""} · ${club.country ?? ""}</div>
        </div>
        ${club.form ? `<div class="form-string">${formBadges(club.form)}</div>` : ""}
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border)">
        ${statCell(decimal(club.goals_for_avg),     "Buts/m",    "var(--win)")}
        ${statCell(decimal(club.goals_against_avg), "Enc./m",    "var(--loss)")}
        ${statCell(decimal(club.fouls_avg),         "Fautes/m",  "var(--text)")}
        ${statCell(decimal(club.yellow_cards_avg),  "Jaunes/m",  "var(--draw)")}
      </div>

      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid var(--border);font-size:.8rem;color:var(--text-muted)">
        ${club.played != null ? `<span>${club.played} matchs ·</span>` : ""}
        ${club.wins != null ? `<span style="color:var(--win)">${club.wins}V</span>` : ""}
        ${club.draws != null ? `<span style="color:var(--draw)">${club.draws}N</span>` : ""}
        ${club.losses != null ? `<span style="color:var(--loss)">${club.losses}D</span>` : ""}
        ${club.league?.season ? `<span style="margin-left:auto;color:var(--text-faint)">Saison ${club.league.season}</span>` : ""}
      </div>
    </div>`;
}

function statCell(value, label, color) {
  return `
    <div style="background:var(--surface);padding:10px 8px;text-align:center">
      <div style="font-size:1rem;font-weight:800;color:${color};line-height:1">${value}</div>
      <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-top:3px">${label}</div>
    </div>`;
}
