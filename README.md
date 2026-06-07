# FootAnalyse

Application web mobile-first d'analyse football — matchs, arbitres, sélections, joueurs, clubs.

**Données chargées par GitHub Actions → stockées dans `/data` → lues par le frontend. Aucune clé API n'est jamais exposée côté navigateur.**

---

## Mise en route (15 minutes)

### 1. Fork / clone ce dépôt

```bash
git clone https://github.com/TON-USER/football-app
cd football-app
```

### 2. Ajouter la clé API en secret GitHub

1. Va dans **Settings → Secrets and variables → Actions** de ton dépôt
2. Clique **New repository secret**
3. Nom : `API_FOOTBALL_KEY`, Valeur : ta clé [API-Football](https://www.api-football.com/)
4. (Optionnel) Ajoute `API_PLAN` = `pro` ou `free`

### 3. Éditer la watchlist

Ouvre [`config/watchlist.json`](config/watchlist.json) et renseigne :

| Champ | Description |
|-------|-------------|
| `players` | IDs joueurs API-Football |
| `clubs` | IDs clubs |
| `national_teams` | IDs sélections nationales |
| `competitions` | Compétitions + saisons à suivre |
| `options.days_ahead` | Matchs à venir (jours) |
| `options.days_behind` | Matchs récents (jours) |
| `options.degraded_mode` | `true` pour plan gratuit (100 req/j) |

**Trouver les IDs** : utilise l'endpoint `/teams?name=...` ou `/leagues?name=...` de l'API.

### 4. Activer GitHub Pages

1. **Settings → Pages**
2. Source : **Deploy from a branch**
3. Branch : `main`, dossier : `/ (root)`
4. Save → ton URL sera `https://TON-USER.github.io/football-app/`

### 5. Lancer le premier workflow manuellement

1. **Actions → Fetch Stats (1x/day)** → **Run workflow** (popule joueurs, clubs, arbitres)
2. **Actions → Fetch Fixtures (4x/day)** → **Run workflow** (popule les matchs)

Les données apparaissent dans `/data/` après ~2 minutes.

---

## Plan gratuit (100 req/jour)

Active `degraded_mode: true` dans `watchlist.json`. Le script réduira automatiquement la portée :
- 1 seule compétition
- 3 joueurs max
- 2 clubs max
- 3 jours de lookback

---

## Architecture

```
index.html          ← SPA entry point (vanilla JS, ES modules)
css/
  main.css          ← Layout mobile-first, variables CSS
  components.css    ← Cards, tableaux, badges, timeline
js/
  app.js            ← Router hash-based
  utils/
    loader.js       ← fetch() + cache mémoire
    format.js       ← Dates, stats, N/D safety
    search.js       ← Filtres, tri
  pages/
    matches.js
    match-detail.js ← Feature centrale
    referees.js
    national-teams.js
    players.js
    clubs.js
data/               ← JSON générés par GitHub Actions (jamais édités manuellement)
config/
  watchlist.json    ← Seul fichier à éditer
scripts/
  fetch_fixtures.py ← 4x/jour
  fetch_stats.py    ← 1x/jour
.github/workflows/
  fetch-fixtures.yml
  fetch-stats.yml
```

## Quota API-Football

| Workflow | Fréquence | Req. max/run | Total/jour |
|----------|-----------|--------------|-----------|
| fetch-fixtures | 4×/j | 200 | 800 |
| fetch-stats | 1×/j | 500 | 500 |
| **Total** | | | **~1 300/7 500** |

Marge confortable sur plan Pro. Réduis `days_ahead`/`days_behind` ou le nombre d'entités en watchlist pour descendre sous 7 500.

---

## Développement local

```bash
# Serveur local (nécessaire pour les modules ES)
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

Les fichiers `/data/*.json` doivent exister. Lance les scripts Python localement :

```bash
export API_FOOTBALL_KEY="ta_clé_ici"
python scripts/fetch_stats.py
python scripts/fetch_fixtures.py
```

---

## Ajouter une entité à suivre

1. Trouve l'ID via l'API : `GET /teams?name=Arsenal`
2. Ajoute l'ID dans `config/watchlist.json` (`clubs` ou `national_teams`)
3. Lance les deux workflows manuellement ou attends le prochain déclenchement automatique
