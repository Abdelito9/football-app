import { loadMeta } from "./utils/loader.js";
import renderMatches      from "./pages/matches.js";
import renderMatchDetail  from "./pages/match-detail.js";
import renderReferees     from "./pages/referees.js";
import renderNational     from "./pages/national-teams.js";
import renderPlayers      from "./pages/players.js";
import renderClubs        from "./pages/clubs.js";

/* ─── DOM refs ─────────────────────────────────────────── */
const mainContent = document.getElementById("mainContent");
const backBtn     = document.getElementById("backBtn");
const pageTitle   = document.getElementById("pageTitle");
const navItems    = document.querySelectorAll(".nav-item");

/* ─── Page config ───────────────────────────────────────── */
const PAGES = {
  matches:  { title: "Matchs",          nav: "matches",  render: renderMatches },
  clubs:    { title: "Clubs",            nav: "clubs",    render: renderClubs },
  referees: { title: "Arbitres",         nav: "referees", render: renderReferees },
  national: { title: "Sélections nat.",  nav: "national", render: renderNational },
  players:  { title: "Joueurs",          nav: "players",  render: renderPlayers },
};

/* ─── Router ────────────────────────────────────────────── */
async function route() {
  const hash   = window.location.hash.slice(1) || "matches";
  const parts  = hash.split("/");
  const page   = parts[0];
  const param  = parts[1];

  // Update nav active state
  navItems.forEach(item => {
    item.classList.toggle("active", item.dataset.page === page);
  });

  if (page === "match" && param) {
    // Detail page
    pageTitle.textContent = "Détail du match";
    backBtn.classList.remove("hidden");
    mainContent.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Chargement…</p></div>`;

    // Back button goes to matches
    backBtn.onclick = () => { window.location.hash = "#matches"; };

    await renderMatchDetail(mainContent, parseInt(param));
    return;
  }

  const cfg = PAGES[page] ?? PAGES.matches;
  pageTitle.textContent = cfg.title;
  backBtn.classList.add("hidden");

  mainContent.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Chargement…</p></div>`;
  await cfg.render(mainContent);
}

/* ─── Degraded mode banner ──────────────────────────────── */
async function checkDegradedMode() {
  const meta = await loadMeta();
  if (meta?.degraded_mode) {
    const banner = document.createElement("div");
    banner.className = "degraded-banner";
    banner.style.cssText = "position:fixed;top:52px;left:0;right:0;z-index:150;margin:0;border-radius:0";
    banner.textContent = "⚠️ Mode dégradé actif — données limitées (plan gratuit)";
    document.body.appendChild(banner);
  }
}

/* ─── Init ──────────────────────────────────────────────── */
window.addEventListener("hashchange", route);
document.addEventListener("DOMContentLoaded", () => {
  checkDegradedMode();
  route();
});

// Handle keyboard navigation on match rows
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && document.activeElement?.classList.contains("match-row")) {
    document.activeElement.click();
  }
});
