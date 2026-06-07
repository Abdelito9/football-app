import { loadData } from "../utils/loader.js";
import { decimal, val, freshness } from "../utils/format.js";
import { fuzzyFilter, sortBy, attachSortHandlers } from "../utils/search.js";

export default async function renderReferees(container) {
  container.innerHTML = `
    <div class="page">
      <div class="search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input class="search-input" id="refSearch" type="search"
               placeholder="Nom de l'arbitre…" autocomplete="off">
      </div>
      <div class="filter-chips" id="sortChips">
        <button class="chip active" data-sort="yellow_per_match">Jaunes</button>
        <button class="chip" data-sort="red_per_match">Rouges</button>
        <button class="chip" data-sort="fouls_per_match">Fautes</button>
        <button class="chip" data-sort="penalties_per_match">Pénaltys</button>
        <button class="chip" data-sort="matches_total">Matchs</button>
      </div>
      <div id="refList"><div class="loading-state"><div class="spinner"></div></div></div>
      <div class="freshness" id="refFreshness"></div>
    </div>`;

  const [data, meta] = await Promise.all([
    loadData("data/referees.json"),
    loadData("data/meta.json"),
  ]);

  const freshEl = container.querySelector("#refFreshness");
  if (meta?.last_updated?.referees) {
    freshEl.textContent = `${freshness(meta.last_updated.referees)} · Source : API-Football`;
  }

  if (!data?.referees?.length) {
    container.querySelector("#refList").innerHTML = `
      <div class="empty-state">
        <div class="state-icon">⚖️</div>
        <p>Données arbitres non encore générées.<br>Lance le workflow fetch-stats.</p>
      </div>`;
    return;
  }

  let refs       = [...data.referees];
  let sortField  = "yellow_per_match";
  let searchQ    = "";

  function current() {
    let r = fuzzyFilter(refs, searchQ, ref => [ref.name, ref.nationality]);
    return sortBy(r, sortField, "desc");
  }

  function render() {
    const list = current();
    const el   = container.querySelector("#refList");

    if (!list.length) {
      el.innerHTML = `<div class="empty-state"><p>Aucun résultat</p></div>`;
      return;
    }

    el.innerHTML = list.map((ref, i) => refereeRow(ref, i + 1)).join("");
  }

  container.querySelector("#sortChips").addEventListener("click", e => {
    const chip = e.target.closest("[data-sort]");
    if (!chip) return;
    sortField = chip.dataset.sort;
    container.querySelectorAll("#sortChips .chip").forEach(c =>
      c.classList.toggle("active", c === chip)
    );
    render();
  });

  container.querySelector("#refSearch").addEventListener("input", e => {
    searchQ = e.target.value;
    render();
  });

  render();
}

function refereeRow(ref, rank) {
  return `
    <div class="referee-row">
      <div class="referee-rank">#${rank}</div>
      <div class="referee-info">
        <div class="referee-name">⚖️ ${ref.name}</div>
        <div class="referee-nat">${ref.nationality ?? ""} · ${ref.matches_total ?? "?"} matchs</div>
      </div>
      <div class="referee-stats">
        <div class="mini-stat">
          <span class="mini-stat-val" style="color:var(--draw)">${decimal(ref.yellow_per_match)}</span>
          <span class="mini-stat-lbl">🟨/m</span>
        </div>
        <div class="mini-stat">
          <span class="mini-stat-val" style="color:var(--loss)">${decimal(ref.red_per_match)}</span>
          <span class="mini-stat-lbl">🟥/m</span>
        </div>
        <div class="mini-stat">
          <span class="mini-stat-val">${decimal(ref.fouls_per_match)}</span>
          <span class="mini-stat-lbl">F/m</span>
        </div>
        ${ref.penalties_per_match != null ? `
        <div class="mini-stat">
          <span class="mini-stat-val">${decimal(ref.penalties_per_match)}</span>
          <span class="mini-stat-lbl">P/m</span>
        </div>` : ""}
      </div>
    </div>`;
}
