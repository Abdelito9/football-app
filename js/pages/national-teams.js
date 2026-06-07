import { loadData } from "../utils/loader.js";
import { decimal, formBadges, freshness, formatDate, FIXTURE_STATUS } from "../utils/format.js";
import { fuzzyFilter } from "../utils/search.js";

export default async function renderNational(container) {
  container.innerHTML = `
    <div class="page">
      <div class="search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input class="search-input" id="natSearch" type="search"
               placeholder="Pays, fédération…" autocomplete="off">
      </div>
      <div id="natList"><div class="loading-state"><div class="spinner"></div></div></div>
      <div class="freshness" id="natFreshness"></div>
    </div>`;

  const [data, upcomingData, recentData, meta] = await Promise.all([
    loadData("data/teams-national.json"),
    loadData("data/fixtures-upcoming.json"),
    loadData("data/fixtures-recent.json"),
    loadData("data/meta.json"),
  ]);

  const freshEl = container.querySelector("#natFreshness");
  if (meta?.last_updated?.teams_national) {
    freshEl.textContent = `${freshness(meta.last_updated.teams_national)} · Source : API-Football`;
  }

  const allFixtures = [
    ...(upcomingData?.fixtures ?? []),
    ...(recentData?.fixtures ?? []),
  ];

  if (!data?.national_teams?.length) {
    container.querySelector("#natList").innerHTML = `
      <div class="empty-state">
        <div class="state-icon">🌍</div>
        <p>Données sélections non encore générées.<br>Lance le workflow fetch-stats.</p>
      </div>`;
    return;
  }

  let teams   = [...data.national_teams];
  let searchQ = "";

  function current() {
    return fuzzyFilter(teams, searchQ, t => [t.name, t.country]);
  }

  const listEl = container.querySelector("#natList");

  // Event delegation — survives re-renders
  listEl.addEventListener("click", e => {
    const row = e.target.closest(".match-row[data-id]");
    if (row) window.location.hash = `#match/${row.dataset.id}`;
  });

  function render() {
    const list = current();
    if (!list.length) {
      listEl.innerHTML = `<div class="empty-state"><p>Aucune sélection trouvée</p></div>`;
      return;
    }
    listEl.innerHTML = list.map(team => {
      const teamFixtures = allFixtures.filter(f =>
        f.teams?.home?.id === team.id || f.teams?.away?.id === team.id
      ).slice(0, 4);
      return nationalCard(team, teamFixtures);
    }).join("");
  }

  container.querySelector("#natSearch").addEventListener("input", e => {
    searchQ = e.target.value;
    render();
  });

  render();
}

function nationalCard(team, fixtures) {
  const { PLAYED } = FIXTURE_STATUS;

  const fixRows = fixtures.length
    ? fixtures.map(fix => {
        const ht     = fix.teams?.home;
        const at     = fix.teams?.away;
        const sc     = fix.score?.fulltime;
        const played = PLAYED.includes(fix.status);
        const isHome = ht?.id === team.id;

        const scoreStr = played
          ? `${sc?.home ?? "?"} - ${sc?.away ?? "?"}`
          : formatDate(fix.date, "short");

        const indicator = played
          ? resultIndicator(sc, isHome)
          : `<span style="color:var(--accent);font-size:.72rem">À jouer</span>`;

        return `
          <div class="match-row" data-id="${fix.id}" role="button" tabindex="0" style="margin-bottom:0;border-radius:0;border-left:0;border-right:0;border-top:0">
            <div class="match-row-teams">
              <div class="match-row-team">
                ${ht?.logo ? `<img src="${ht.logo}" alt="" loading="lazy">` : ""}
                <span class="match-row-team-name" style="font-size:.82rem">${ht?.name ?? "—"}</span>
              </div>
              <div class="match-row-team">
                ${at?.logo ? `<img src="${at.logo}" alt="" loading="lazy">` : ""}
                <span class="match-row-team-name" style="font-size:.82rem">${at?.name ?? "—"}</span>
              </div>
            </div>
            <div class="match-row-meta">
              <span class="match-score-value" style="font-size:.9rem">${scoreStr}</span>
              ${indicator}
            </div>
          </div>`;
      }).join("")
    : `<div class="unavail-notice" style="padding:12px 16px">Aucun match récent/à venir</div>`;

  return `
    <div class="national-card">
      <div class="national-card-header">
        ${team.logo ? `<img src="${team.logo}" alt="" style="width:40px;height:40px;object-fit:contain">` : "🌍"}
        <div style="flex:1">
          <div style="font-size:.95rem;font-weight:700">${team.name}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${team.country ?? ""}</div>
        </div>
        <div style="display:flex;gap:12px">
          ${team.form ? `<div class="mini-stat">
            <div class="form-string">${formBadges(team.form)}</div>
            <div class="mini-stat-lbl">Forme</div>
          </div>` : ""}
        </div>
      </div>
      ${team.form || team.goals_for_avg != null ? `
        <div style="display:flex;gap:16px;padding:10px 16px;background:var(--surface-2);border-bottom:1px solid var(--border)">
          ${team.goals_for_avg != null ? `<div class="mini-stat">
            <span class="mini-stat-val" style="color:var(--win)">${decimal(team.goals_for_avg)}</span>
            <span class="mini-stat-lbl">Buts/m</span>
          </div>` : ""}
          ${team.goals_against_avg != null ? `<div class="mini-stat">
            <span class="mini-stat-val" style="color:var(--loss)">${decimal(team.goals_against_avg)}</span>
            <span class="mini-stat-lbl">Enc./m</span>
          </div>` : ""}
          ${team.wins != null ? `<div class="mini-stat">
            <span class="mini-stat-val">${team.wins}V ${team.draws ?? ""}N ${team.losses ?? ""}D</span>
            <span class="mini-stat-lbl">${team.played ?? "?"} matchs</span>
          </div>` : ""}
        </div>` : ""}
      ${fixRows}
    </div>`;
}

function resultIndicator(sc, isHome) {
  if (!sc || sc.home === null) return "";
  const homeGoals = sc.home ?? 0;
  const awayGoals = sc.away ?? 0;
  let res;
  if (homeGoals === awayGoals) res = "D";
  else if (isHome) res = homeGoals > awayGoals ? "W" : "L";
  else res = awayGoals > homeGoals ? "W" : "L";
  const labels = { W: "V", D: "N", L: "D" };
  return `<span class="form-result ${res}" style="width:20px;height:20px;font-size:.68rem">${labels[res]}</span>`;
}
