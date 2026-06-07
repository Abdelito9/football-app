import { loadData } from "../utils/loader.js";
import { formatDate, statusBadge, freshness, FIXTURE_STATUS } from "../utils/format.js";
import { filterFixtures, extractLeagues } from "../utils/search.js";

export default async function renderMatches(container) {
  container.innerHTML = `
    <div class="page">
      <div class="search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input class="search-input" id="matchSearch" type="search"
               placeholder="Équipe, compétition…" autocomplete="off">
      </div>
      <div class="filter-chips" id="statusChips">
        <button class="chip active" data-status="all">Tous</button>
        <button class="chip" data-status="upcoming">À venir</button>
        <button class="chip" data-status="played">Récents</button>
      </div>
      <div class="filter-chips" id="leagueChips"></div>
      <div id="matchList"><div class="loading-state"><div class="spinner"></div><p>Chargement…</p></div></div>
      <div class="freshness" id="matchFreshness"></div>
    </div>`;

  const [upcomingData, recentData, meta] = await Promise.all([
    loadData("data/fixtures-upcoming.json"),
    loadData("data/fixtures-recent.json"),
    loadData("data/meta.json"),
  ]);

  const upcoming = upcomingData?.fixtures ?? [];
  const recent   = recentData?.fixtures ?? [];
  const allFix   = [...upcoming, ...recent];

  const freshEl = container.querySelector("#matchFreshness");
  if (meta?.last_updated?.fixtures_upcoming) {
    freshEl.textContent = `${freshness(meta.last_updated.fixtures_upcoming)} · Source : API-Football`;
  }

  const leagues  = extractLeagues(allFix);
  const leagueEl = container.querySelector("#leagueChips");
  leagueEl.innerHTML = leagues.map(l =>
    `<button class="chip" data-league="${l.id}">${l.name}</button>`
  ).join("");

  let activeStatus = "all";
  let activeLeague = null;
  let searchQuery  = "";

  function currentList() {
    return filterFixtures(allFix, {
      leagueId: activeLeague,
      status:   activeStatus,
      query:    searchQuery,
    });
  }

  const listEl = container.querySelector("#matchList");

  // Event delegation — set up once, survives re-renders
  listEl.addEventListener("click", e => {
    const row = e.target.closest(".match-row[data-id]");
    if (row) window.location.hash = `#match/${row.dataset.id}`;
  });

  function render() {
    const list = currentList();
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="state-icon">⚽</div>
        <p>Aucun match trouvé</p>
      </div>`;
      return;
    }
    listEl.innerHTML = list.map(fix => matchRow(fix)).join("");
  }

  container.querySelector("#statusChips").addEventListener("click", e => {
    const chip = e.target.closest("[data-status]");
    if (!chip) return;
    activeStatus = chip.dataset.status;
    container.querySelectorAll("#statusChips .chip").forEach(c =>
      c.classList.toggle("active", c === chip)
    );
    render();
  });

  leagueEl.addEventListener("click", e => {
    const chip = e.target.closest("[data-league]");
    if (!chip) return;
    const id = parseInt(chip.dataset.league);
    if (activeLeague === id) {
      activeLeague = null;
      chip.classList.remove("active");
    } else {
      leagueEl.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeLeague = id;
    }
    render();
  });

  container.querySelector("#matchSearch").addEventListener("input", e => {
    searchQuery = e.target.value;
    render();
  });

  render();
}

function matchRow(fix) {
  const ht     = fix.teams?.home;
  const at     = fix.teams?.away;
  const sc     = fix.score?.fulltime;
  const status = fix.status;
  const { UPCOMING, LIVE } = FIXTURE_STATUS;

  const isUpcoming = UPCOMING.includes(status);
  const isLive     = LIVE.includes(status);

  let scoreBlock;
  if (isLive) {
    scoreBlock = `
      <div class="match-row-score">
        <div class="match-score-value">${sc?.home ?? 0} - ${sc?.away ?? 0}</div>
        <div>${statusBadge(status, fix.elapsed ?? "")}</div>
      </div>`;
  } else if (isUpcoming) {
    scoreBlock = `
      <div class="match-row-score">
        <div class="match-time">${formatDate(fix.date, "time")}</div>
        <div class="match-league-badge">${fix.league?.name ?? ""}</div>
      </div>`;
  } else {
    scoreBlock = `
      <div class="match-row-score">
        <div class="match-score-value">${sc?.home ?? "?"} - ${sc?.away ?? "?"}</div>
        <div>${statusBadge(status)}</div>
      </div>`;
  }

  return `
    <div class="match-row" data-id="${fix.id}" role="button" tabindex="0">
      <div class="match-row-teams">
        <div class="match-row-team">
          ${ht?.logo ? `<img src="${ht.logo}" alt="" loading="lazy">` : ""}
          <span class="match-row-team-name">${ht?.name ?? "—"}</span>
        </div>
        <div class="match-row-team">
          ${at?.logo ? `<img src="${at.logo}" alt="" loading="lazy">` : ""}
          <span class="match-row-team-name">${at?.name ?? "—"}</span>
        </div>
      </div>
      ${scoreBlock}
      <div class="match-row-meta">
        <span class="match-league-badge">${fix.league?.round ?? ""}</span>
        <span style="font-size:.7rem;color:var(--text-muted)">${isUpcoming ? "" : formatDate(fix.date, "short")}</span>
      </div>
    </div>`;
}
