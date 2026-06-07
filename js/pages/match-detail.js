import { loadFixture } from "../utils/loader.js";
import {
  val, decimal, percent, rating, formatDate, timeAgo,
  formBadges, statusBadge, score, freshness, eventIcon, posLabel,
  NA, FIXTURE_STATUS,
} from "../utils/format.js";

const { UPCOMING, LIVE, PLAYED } = FIXTURE_STATUS;

export default async function renderMatchDetail(container, fixtureId) {
  container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Chargement du match…</p></div>`;

  const data = await loadFixture(fixtureId);

  if (!data) {
    container.innerHTML = `
      <div class="error-state">
        <div class="state-icon">⚠️</div>
        <p>Match introuvable ou données non encore générées.<br>
           Lance le workflow GitHub Actions manuellement.</p>
      </div>`;
    return;
  }

  const fix    = data.fixture;
  const status = fix.status;
  const isUpcoming = UPCOMING.includes(status) || LIVE.includes(status);
  const isPlayed   = PLAYED.includes(status);

  container.innerHTML = `
    <div class="page">
      ${heroSection(fix)}
      ${isPlayed  ? eventsSection(data.events, fix) : ""}
      ${isUpcoming && data.predictions ? predictionSection(data.predictions, fix) : ""}
      ${isUpcoming && !data.predictions ? noPredictions() : ""}
      ${playersToWatchSection(data.players_to_watch)}
      ${lineupsSection(data.lineups, fix)}
      ${teamStatsSection(data.team_stats, fix)}
      ${refereeSection(data.referee_stats)}
      ${isPlayed && data.statistics ? matchStatsSection(data.statistics, fix) : ""}
      <div class="freshness">
        🕐 ${freshness(data.generated_at)} · Source : API-Football
      </div>
    </div>`;
}

/* ─── HERO ──────────────────────────────────────────────── */
function heroSection(fix) {
  const ht = fix.teams?.home;
  const at = fix.teams?.away;
  const sc = fix.score;
  const ft = sc?.fulltime;
  const status = fix.status;

  const scoreOrVs = (PLAYED.includes(status) || LIVE.includes(status))
    ? `<div class="hero-score">${ft?.home ?? 0} <span style="color:var(--text-muted)">-</span> ${ft?.away ?? 0}</div>`
    : `<div class="hero-vs">VS</div>`;

  const extraScore = sc?.penalty?.home !== null && sc?.penalty?.home !== undefined
    ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">TAB: ${sc.penalty.home} - ${sc.penalty.away}</div>`
    : "";

  return `
    <div class="match-hero">
      <div class="match-hero-teams">
        ${heroTeam(ht)}
        <div class="hero-score-block">
          ${scoreOrVs}
          ${extraScore}
          <div>${statusBadge(status, fix.elapsed)}</div>
        </div>
        ${heroTeam(at)}
      </div>
      <div class="match-hero-meta">
        <span class="meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${formatDate(fix.date, "datetime")}
        </span>
        ${fix.venue?.name ? `<span class="meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${fix.venue.name}${fix.venue.city ? `, ${fix.venue.city}` : ""}
        </span>` : ""}
        <span class="meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
          ${fix.league?.name ?? "—"} · ${fix.league?.round ?? ""}
        </span>
        ${fix.referee ? `<span class="meta-item">
          ⚖️ ${fix.referee}
        </span>` : ""}
      </div>
    </div>`;
}

function heroTeam(team) {
  return `
    <div class="hero-team">
      ${team?.logo ? `<img src="${team.logo}" alt="${team.name}" loading="lazy">` : `<div style="width:48px;height:48px;background:var(--surface-3);border-radius:50%"></div>`}
      <div class="hero-team-name">${team?.name ?? "—"}</div>
    </div>`;
}

/* ─── EVENTS (played) ────────────────────────────────────── */
function eventsSection(events, fix) {
  if (!events || !events.length) {
    return `<p class="section-title">⚡ Événements</p>
    <div class="unavail-notice">ℹ️ Événements non disponibles</div>`;
  }

  const rows = events.map(ev => {
    const time    = ev.time_extra ? `${ev.time}+${ev.time_extra}'` : `${ev.time}'`;
    const icon    = eventIcon(ev.type, ev.detail);
    const player  = ev.player?.name ?? "—";
    const assist  = ev.assist?.name ? `<div class="event-assist">🅰 ${ev.assist.name}</div>` : "";
    const teamLbl = ev.team?.name ?? "";

    return `
      <div class="event-row">
        <div class="event-time">${time}</div>
        <div class="event-icon">${icon}</div>
        <div class="event-info">
          <div class="event-player-name">${player}</div>
          ${assist}
        </div>
        <div class="event-team-label">${teamLbl}</div>
      </div>`;
  }).join("");

  return `
    <p class="section-title">⚡ Événements</p>
    <div class="card">
      <div class="events-timeline">${rows}</div>
    </div>`;
}

/* ─── PREDICTIONS (upcoming) ─────────────────────────────── */
function predictionSection(pred, fix) {
  if (!pred?.available) return noPredictions();

  const ht = fix.teams?.home;
  const at = fix.teams?.away;

  const hp = pred.percent?.home ?? "?";
  const dp = pred.percent?.draw ?? "?";
  const ap = pred.percent?.away ?? "?";
  const hv = parseFloat(hp) || 0;
  const dv = parseFloat(dp) || 0;
  const av = parseFloat(ap) || 0;

  const adviceHtml = pred.advice
    ? `<div class="advice-box">⚡ ${pred.advice}</div>`
    : "";

  const cmp = pred.comparison ?? {};

  const compareRows = [
    ["Forme récente", cmp.form],
    ["Attaque",       cmp.att],
    ["Défense",       cmp.def],
    ["Poisson",       cmp.poisson_distribution],
    ["H2H",          cmp.h2h],
    ["Total",        cmp.total],
  ].filter(([,v]) => v?.home || v?.away)
   .map(([label, v]) => `
    <div class="compare-row">
      <div class="compare-val-home">${v?.home ?? "—"}</div>
      <div class="compare-label">${label}</div>
      <div class="compare-val-away">${v?.away ?? "—"}</div>
    </div>`).join("");

  const h2hRows = (pred.h2h ?? []).map(h => `
    <div class="h2h-row">
      <div class="h2h-date">${h.date ? h.date.slice(5).replace("-","/") : "—"}</div>
      <div class="h2h-teams">
        <div class="h2h-team">${h.home?.name ?? "—"}</div>
        <div class="h2h-score">${h.home?.goals ?? "?"} - ${h.away?.goals ?? "?"}</div>
        <div class="h2h-team away">${h.away?.name ?? "—"}</div>
      </div>
    </div>`).join("") || `<div class="unavail-notice">Pas de confrontations directes disponibles</div>`;

  return `
    <p class="section-title">📊 Pronostics</p>
    <div class="card">
      <div class="card-body">
        <div class="prediction-bars">
          <div class="pred-bar-item home">
            <div class="pred-bar-label">${ht?.name?.split(" ")[0] ?? "Dom."}</div>
            <div class="pred-bar-pct">${hp}</div>
            <div class="pred-bar-track"><div class="pred-bar-fill" style="width:${hv}%"></div></div>
          </div>
          <div class="pred-bar-item draw">
            <div class="pred-bar-label">Nul</div>
            <div class="pred-bar-pct">${dp}</div>
            <div class="pred-bar-track"><div class="pred-bar-fill" style="width:${dv}%"></div></div>
          </div>
          <div class="pred-bar-item away">
            <div class="pred-bar-label">${at?.name?.split(" ")[0] ?? "Ext."}</div>
            <div class="pred-bar-pct">${ap}</div>
            <div class="pred-bar-track"><div class="pred-bar-fill" style="width:${av}%"></div></div>
          </div>
        </div>
        ${adviceHtml}
        ${compareRows ? `
          <div style="margin-bottom:14px">
            <div class="compare-row" style="border-bottom:1px solid var(--border)">
              <div class="compare-val-home" style="font-size:.72rem;color:var(--text-muted);font-weight:600">${ht?.name ?? ""}</div>
              <div class="compare-label" style="font-size:.68rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:.06em">Comparaison</div>
              <div class="compare-val-away" style="font-size:.72rem;color:var(--text-muted);font-weight:600">${at?.name ?? ""}</div>
            </div>
            ${compareRows}
          </div>` : ""}
      </div>
    </div>

    <p class="section-title">🔁 Confrontations directes</p>
    <div class="card">
      <div class="card-body" style="padding:0 16px">
        ${h2hRows}
      </div>
    </div>`;
}

function noPredictions() {
  return `
    <p class="section-title">📊 Pronostics</p>
    <div class="unavail-notice card" style="padding:16px">ℹ️ Pronostics non disponibles pour ce match</div>`;
}

/* ─── PLAYERS TO WATCH ───────────────────────────────────── */
function playersToWatchSection(players) {
  if (!players || !players.length) return "";

  const cards = players.map(p => {
    const info = p.player;
    const s    = p.stats;
    const photo = info?.photo
      ? `<img class="player-watch-photo" src="${info.photo}" alt="" loading="lazy">`
      : `<div class="player-watch-photo" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem">👤</div>`;

    return `
      <div class="player-watch-card">
        ${photo}
        <div class="player-watch-info">
          <div class="player-watch-name">${info?.name ?? "—"}</div>
          <div class="player-watch-team">${info?.team ?? ""}</div>
          <div class="player-watch-stats">
            <div class="pstat">
              <span class="pstat-val">${val(s?.goals)}</span>
              <span class="pstat-lbl">Buts</span>
            </div>
            <div class="pstat">
              <span class="pstat-val">${val(s?.assists)}</span>
              <span class="pstat-lbl">Passes D</span>
            </div>
            <div class="pstat">
              ${s?.rating != null ? rating(s.rating) : `<span class="pstat-val">${NA}</span>`}
              <span class="pstat-lbl">Note</span>
            </div>
            <div class="pstat">
              <span class="pstat-val">${val(s?.appearances)}</span>
              <span class="pstat-lbl">Matchs</span>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  return `
    <p class="section-title">⭐ Joueurs à surveiller</p>
    <div class="card">${cards}</div>`;
}

/* ─── LINEUPS ────────────────────────────────────────────── */
function lineupsSection(lineups, fix) {
  const status = lineups?.status ?? "unavailable";
  const ht = fix.teams?.home;
  const at = fix.teams?.away;

  const statusLabel = {
    official: `<span class="lineup-status-badge official">✓ Officielle</span>`,
    probable: `<span class="lineup-status-badge probable">⚠ Probable</span>`,
    unavailable: `<span class="lineup-status-badge unavailable">Non confirmée</span>`,
  }[status] ?? `<span class="lineup-status-badge unavailable">Non confirmée</span>`;

  if (status === "unavailable" || !lineups?.home) {
    return `
      <p class="section-title">📋 Compositions</p>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Compositions</span>
          ${statusLabel}
        </div>
        <div class="unavail-notice">ℹ️ Compo non confirmée — non disponible</div>
      </div>`;
  }

  return `
    <p class="section-title">📋 Compositions ${statusLabel}</p>
    <div class="card" style="overflow:hidden">
      <div class="two-col-header">
        <div class="two-col-label">
          ${ht?.logo ? `<img src="${ht.logo}" alt="">` : ""}
          ${ht?.name ?? "Domicile"}
          ${lineups.home?.formation ? `<span class="formation-tag">${lineups.home.formation}</span>` : ""}
        </div>
        <div class="two-col-label">
          ${at?.logo ? `<img src="${at.logo}" alt="">` : ""}
          ${at?.name ?? "Extérieur"}
          ${lineups.away?.formation ? `<span class="formation-tag">${lineups.away.formation}</span>` : ""}
        </div>
      </div>
      <div class="lineup-cols">
        ${lineupCol(lineups.home)}
        ${lineupCol(lineups.away)}
      </div>
    </div>
    ${status === "probable" ? `<div style="font-size:.75rem;color:var(--text-muted);padding:6px 0 0 2px">⚠ Composition probable — non confirmée officiellement</div>` : ""}`;
}

function lineupCol(side) {
  if (!side) return `<div class="lineup-col"></div>`;

  const starters = (side.startXI ?? []).map(p => lineupPlayerRow(p)).join("");
  const subs     = (side.substitutes ?? []).map(p => lineupPlayerRow(p)).join("");

  return `
    <div class="lineup-col">
      ${starters || `<div class="unavail-notice" style="padding:8px 0">—</div>`}
      ${subs ? `<div class="lineup-subs-title">Remplaçants</div>${subs}` : ""}
    </div>`;
}

function lineupPlayerRow(p) {
  const pos = p.pos ? `<span class="lineup-pos-badge ${p.pos}">${posLabel(p.pos)}</span>` : "";
  return `
    <div class="lineup-player">
      <span class="lineup-player-num">${p.number ?? ""}</span>
      ${pos}
      <span class="lineup-player-name">${p.name ?? "—"}</span>
    </div>`;
}

/* ─── TEAM STATS ─────────────────────────────────────────── */
function teamStatsSection(teamStats, fix) {
  const ht = fix.teams?.home;
  const at = fix.teams?.away;
  const home = teamStats?.home;
  const away = teamStats?.away;

  if (!home && !away) {
    return `
      <p class="section-title">📈 Stats des équipes</p>
      <div class="unavail-notice">ℹ️ Stats d'équipe non disponibles</div>`;
  }

  const rows = [
    { label: "Buts/match",      hv: decimal(home?.goals_for_avg),     av: decimal(away?.goals_for_avg),     hRaw: home?.goals_for_avg,     aRaw: away?.goals_for_avg,     better: "high" },
    { label: "Encaissés/match", hv: decimal(home?.goals_against_avg), av: decimal(away?.goals_against_avg), hRaw: home?.goals_against_avg, aRaw: away?.goals_against_avg, better: "low" },
    { label: "Fautes/match",    hv: decimal(home?.fouls_avg),         av: decimal(away?.fouls_avg),         hRaw: home?.fouls_avg,         aRaw: away?.fouls_avg,         better: "low" },
    { label: "Jaunes/match",    hv: decimal(home?.yellow_cards_avg),  av: decimal(away?.yellow_cards_avg),  hRaw: home?.yellow_cards_avg,  aRaw: away?.yellow_cards_avg,  better: "low" },
    { label: "Rouges/match",    hv: decimal(home?.red_cards_avg),     av: decimal(away?.red_cards_avg),     hRaw: home?.red_cards_avg,     aRaw: away?.red_cards_avg,     better: "low" },
  ];

  const formRow = (home?.form || away?.form)
    ? `<tr>
        <td class="val-col" style="text-align:center">${home?.form ? `<div class="form-string" style="justify-content:center">${formBadges(home.form)}</div>` : NA}</td>
        <td class="label-col">Forme</td>
        <td class="val-col" style="text-align:center">${away?.form ? `<div class="form-string" style="justify-content:center">${formBadges(away.form)}</div>` : NA}</td>
       </tr>` : "";

  const statRows = rows.map(({ label, hv, av, hRaw, aRaw, better }) => {
    let hCls = "", aCls = "";
    if (hRaw != null && aRaw != null) {
      if (better === "high") {
        if (hRaw > aRaw) hCls = "better";
        else if (aRaw > hRaw) aCls = "better";
      } else {
        if (hRaw < aRaw) hCls = "better";
        else if (aRaw < hRaw) aCls = "better";
      }
    }
    return `<tr>
      <td class="val-col ${hCls}">${hv}</td>
      <td class="label-col">${label}</td>
      <td class="val-col ${aCls}">${av}</td>
    </tr>`;
  }).join("");

  return `
    <p class="section-title">📈 Stats des équipes</p>
    <div class="card">
      <table class="stats-table">
        <thead>
          <tr>
            <th style="text-align:center">${ht?.name ?? "Dom."}</th>
            <th style="text-align:center;color:var(--text-muted)"></th>
            <th style="text-align:center">${at?.name ?? "Ext."}</th>
          </tr>
        </thead>
        <tbody>
          ${formRow}
          ${statRows}
        </tbody>
      </table>
    </div>`;
}

/* ─── REFEREE ────────────────────────────────────────────── */
function refereeSection(refStats) {
  if (!refStats) return "";

  if (!refStats.available) {
    return `
      <p class="section-title">⚖️ Contexte arbitre</p>
      <div class="card">
        <div class="unavail-notice">⚖️ ${refStats.name ?? "Arbitre"} — Stats non disponibles</div>
      </div>`;
  }

  const stats = [
    { val: val(refStats.matches),              lbl: "Matchs" },
    { val: decimal(refStats.fouls_per_match),  lbl: "Fautes/match" },
    { val: decimal(refStats.yellow_per_match), lbl: "Jaunes/match" },
    { val: decimal(refStats.red_per_match),    lbl: "Rouges/match" },
    { val: decimal(refStats.penalties_per_match), lbl: "Pénaltys/m" },
    { val: val(refStats.yellow_total),         lbl: "Jaunes total" },
  ];

  return `
    <p class="section-title">⚖️ Contexte arbitre</p>
    <div class="card">
      <div class="card-header">
        <span class="card-title">⚖️ ${refStats.name}</span>
      </div>
      <div class="card-body">
        <div class="referee-stat-grid">
          ${stats.map(s => `
            <div class="ref-stat-cell">
              <div class="ref-stat-val">${s.val}</div>
              <div class="ref-stat-lbl">${s.lbl}</div>
            </div>`).join("")}
        </div>
      </div>
    </div>`;
}

/* ─── MATCH STATS (played) ───────────────────────────────── */
function matchStatsSection(statistics, fix) {
  if (!statistics || !Object.keys(statistics).length) return "";

  const teamIds = Object.keys(statistics);
  if (teamIds.length < 2) return "";

  const s1  = statistics[teamIds[0]];
  const s2  = statistics[teamIds[1]];
  const ht  = fix.teams?.home;
  const at  = fix.teams?.away;

  const homeStats = s1.team?.id === ht?.id ? s1.stats : s2.stats;
  const awayStats = s1.team?.id === ht?.id ? s2.stats : s1.stats;

  const statKeys = [
    { key: "shots_on_goal",          label: "Tirs cadrés" },
    { key: "shots_off_goal",         label: "Tirs non cadrés" },
    { key: "total_shots",            label: "Total tirs" },
    { key: "ball_possession",        label: "Possession" },
    { key: "passes_accurate",        label: "Passes précises" },
    { key: "total_passes",           label: "Total passes" },
    { key: "fouls",                  label: "Fautes" },
    { key: "corner_kicks",           label: "Corners" },
    { key: "yellow_cards",           label: "Cartons jaunes" },
    { key: "red_cards",              label: "Cartons rouges" },
    { key: "goalkeeper_saves",       label: "Arrêts" },
    { key: "expected_goals",         label: "xG" },
  ];

  const rows = statKeys
    .filter(({ key }) => homeStats[key] != null || awayStats[key] != null)
    .map(({ key, label }) => {
      const hv = homeStats[key] ?? "—";
      const av = awayStats[key] ?? "—";
      return `<tr>
        <td class="val-col">${hv}</td>
        <td class="label-col">${label}</td>
        <td class="val-col">${av}</td>
      </tr>`;
    }).join("");

  if (!rows) return "";

  return `
    <p class="section-title">📊 Stats du match</p>
    <div class="card">
      <table class="stats-table">
        <thead>
          <tr>
            <th style="text-align:center">${ht?.name ?? "Dom."}</th>
            <th></th>
            <th style="text-align:center">${at?.name ?? "Ext."}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
