#!/usr/bin/env python3
"""
Fetch player stats, team statistics, and aggregate referee data.
Runs once per day. Budget: ~500 API requests.
"""
import json, os, sys, time, requests
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

API_KEY  = os.environ.get("API_FOOTBALL_KEY", "")
BASE_URL = "https://v3.football.api-sports.io"
DATA_DIR = Path("data")
CFG_DIR  = Path("config")
HEADERS  = {
    "x-rapidapi-key":  API_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
}

request_count = 0
MAX_REQUESTS  = int(os.environ.get("MAX_REQUESTS", "500"))
CALL_DELAY    = 0.35

# ─── Helpers ────────────────────────────────────────────────────────────────

def api_get(endpoint, params=None, retries=2):
    global request_count
    if not API_KEY:
        return None
    if request_count >= MAX_REQUESTS:
        print(f"  ⚠️  Quota limit {MAX_REQUESTS}")
        return None
    url = f"{BASE_URL}{endpoint}"
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, params=params, timeout=30)
            request_count += 1
            time.sleep(CALL_DELAY)
            if r.status_code == 429:
                time.sleep(10); continue
            if r.status_code == 200:
                data   = r.json()
                errors = data.get("errors", {})
                if errors and (isinstance(errors, dict) and errors or isinstance(errors, list) and errors):
                    return None
                return data.get("response", [])
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"  ❌ {e}")
            if attempt < retries:
                time.sleep(2 ** attempt)
    return None

def write_json(path, obj):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  ✓ {p}")

def read_json(path):
    p = Path(path)
    return json.load(open(p, encoding="utf-8")) if p.exists() else None

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def safe_div(a, b):
    return round(a / b, 2) if b else None

# ─── Player stats ────────────────────────────────────────────────────────────

def fetch_player_stats(player_id, competitions):
    """Fetch player stats across competitions; return best season entry."""
    best = None
    best_score = -1
    for comp in competitions:
        rows = api_get("/players", {
            "id":     player_id,
            "league": comp["league_id"],
            "season": comp["season"],
        })
        if not rows:
            continue
        entry = rows[0]
        pl    = entry.get("player", {}) or {}
        stats = (entry.get("statistics") or [{}])[0]

        games   = stats.get("games", {}) or {}
        goals   = stats.get("goals", {}) or {}
        passes  = stats.get("passes", {}) or {}
        shots   = stats.get("shots", {}) or {}
        tackles = stats.get("tackles", {}) or {}
        duels   = stats.get("duels", {}) or {}
        dribbles= stats.get("dribbles", {}) or {}
        fouls   = stats.get("fouls", {}) or {}
        cards   = stats.get("cards", {}) or {}
        penalty = stats.get("penalty", {}) or {}
        team    = stats.get("team", {}) or {}
        league  = stats.get("league", {}) or {}

        score = (goals.get("total") or 0) * 2 + (goals.get("assists") or 0) + float(games.get("rating") or 0)
        if score > best_score:
            best_score = score
            best = {
                "id":          pl.get("id") or player_id,
                "name":        pl.get("name"),
                "firstname":   pl.get("firstname"),
                "lastname":    pl.get("lastname"),
                "age":         pl.get("age"),
                "nationality": pl.get("nationality"),
                "photo":       pl.get("photo"),
                "team":        {"id": team.get("id"), "name": team.get("name"), "logo": team.get("logo")},
                "season_stats": {
                    "league":      {"id": league.get("id"), "name": league.get("name"), "season": league.get("season")},
                    "appearances": games.get("appearences"),   # API typo
                    "lineups":     games.get("lineups"),
                    "minutes":     games.get("minutes"),
                    "rating":      games.get("rating"),
                    "goals":       {"total": goals.get("total"), "assists": goals.get("assists"), "conceded": goals.get("conceded")},
                    "shots":       {"total": shots.get("total"), "on": shots.get("on")},
                    "passes":      {"total": passes.get("total"), "key": passes.get("key"), "accuracy": passes.get("accuracy")},
                    "tackles":     {"total": tackles.get("total"), "blocks": tackles.get("blocks"), "interceptions": tackles.get("interceptions")},
                    "duels":       {"total": duels.get("total"), "won": duels.get("won")},
                    "dribbles":    {"attempts": dribbles.get("attempts"), "success": dribbles.get("success")},
                    "fouls":       {"drawn": fouls.get("drawn"), "committed": fouls.get("committed")},
                    "cards":       {"yellow": cards.get("yellow"), "yellowred": cards.get("yellowred"), "red": cards.get("red")},
                    "penalty":     {"won": penalty.get("won"), "scored": penalty.get("scored"), "missed": penalty.get("missed"), "saved": penalty.get("saved")},
                },
            }
    return best

# ─── Team statistics ─────────────────────────────────────────────────────────

def fetch_team_statistics(team_id, competition):
    rows = api_get("/teams/statistics", {
        "team":   team_id,
        "league": competition["league_id"],
        "season": competition["season"],
    })
    if not rows:
        return None

    stats  = rows[0] if isinstance(rows, list) else rows
    team   = stats.get("team", {}) or {}
    league = stats.get("league", {}) or {}
    form   = stats.get("form", "")
    fixtures = stats.get("fixtures", {}) or {}
    goals_for     = (stats.get("goals", {}) or {}).get("for", {}) or {}
    goals_against = (stats.get("goals", {}) or {}).get("against", {}) or {}

    played_total = (fixtures.get("played") or {}).get("total") or 0
    wins_total   = (fixtures.get("wins") or {}).get("total") or 0
    draws_total  = (fixtures.get("draws") or {}).get("total") or 0
    losses_total = (fixtures.get("loses") or {}).get("total") or 0

    gf_avg = (goals_for.get("average") or {}).get("total")
    ga_avg = (goals_against.get("average") or {}).get("total")

    # Aggregate fouls/cards from lineups not available directly here.
    # We'll fill from fixture statistics instead (populated via fetch_fixtures).
    cards = stats.get("cards", {}) or {}
    fouls = None  # not provided by /teams/statistics

    yellow_total = sum(
        (v or 0)
        for v in ((cards.get("yellow") or {}).values() if isinstance(cards.get("yellow"), dict) else [])
    )
    red_total = sum(
        (v or 0)
        for v in ((cards.get("red") or {}).values() if isinstance(cards.get("red"), dict) else [])
    )

    yellow_avg = safe_div(yellow_total, played_total)
    red_avg    = safe_div(red_total,    played_total)

    return {
        "id":      team.get("id") or team_id,
        "name":    team.get("name"),
        "logo":    team.get("logo"),
        "country": None,
        "league":  {"id": league.get("id"), "name": league.get("name"), "season": league.get("season")},
        "form":    form[-5:] if form else None,
        "goals_for_avg":     float(gf_avg) if gf_avg else None,
        "goals_against_avg": float(ga_avg) if ga_avg else None,
        "fouls_avg":         fouls,
        "yellow_cards_avg":  yellow_avg,
        "red_cards_avg":     red_avg,
        "wins":    wins_total,
        "draws":   draws_total,
        "losses":  losses_total,
        "played":  played_total,
    }

# ─── Referee aggregation from fixture data ────────────────────────────────────

def aggregate_referees():
    """
    Walk all saved fixture detail files and aggregate referee stats
    from fixture statistics (fouls, cards per match).
    """
    fixtures_dir = DATA_DIR / "fixtures"
    if not fixtures_dir.exists():
        return []

    ref_data = defaultdict(lambda: {
        "matches":       0,
        "fouls_total":   0,
        "yellow_total":  0,
        "red_total":     0,
        "penalty_total": 0,
    })

    for fpath in fixtures_dir.glob("*.json"):
        detail = read_json(fpath)
        if not detail:
            continue
        fix      = detail.get("fixture") or {}
        ref_name = fix.get("referee")
        if not ref_name:
            continue

        stats = detail.get("statistics") or {}
        if not stats:
            continue

        fouls = 0; yellow = 0; red = 0; penalties = 0
        for team_block in stats.values():
            s = team_block.get("stats") or {}
            fouls    += int(s.get("fouls") or 0)
            yellow   += int(s.get("yellow_cards") or 0)
            red      += int(s.get("red_cards") or 0)
            # Penalties: count goal events of type Penalty
        events = detail.get("events") or []
        for ev in events:
            if (ev.get("type") == "Goal" and ev.get("detail") == "Penalty") or \
               (ev.get("type") == "subst" and ev.get("detail") == "Penalty missed"):
                penalties += 1

        r = ref_data[ref_name]
        r["matches"]       += 1
        r["fouls_total"]   += fouls
        r["yellow_total"]  += yellow
        r["red_total"]     += red
        r["penalty_total"] += penalties

    referees = []
    for name, r in ref_data.items():
        m = r["matches"]
        referees.append({
            "name":                name,
            "nationality":         None,
            "available":           True,
            "matches_total":       m,
            "fouls_per_match":     safe_div(r["fouls_total"], m),
            "yellow_per_match":    safe_div(r["yellow_total"], m),
            "red_per_match":       safe_div(r["red_total"], m),
            "penalties_per_match": safe_div(r["penalty_total"], m),
            "yellow_total":        r["yellow_total"],
            "red_total":           r["red_total"],
            "penalties_total":     r["penalty_total"],
        })

    referees.sort(key=lambda x: x["yellow_per_match"] or 0, reverse=True)
    return referees

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("📊 fetch_stats.py starting")
    wl = read_json(CFG_DIR / "watchlist.json")
    if not wl:
        print("❌ config/watchlist.json not found"); sys.exit(1)

    degraded = wl.get("options", {}).get("degraded_mode", False)
    if degraded:
        print("⚠️  Degraded mode — reducing scope")
        wl["competitions"] = wl["competitions"][:1]
        wl["players"]      = wl["players"][:3]
        wl["clubs"]        = wl["clubs"][:2]
        wl["national_teams"] = wl["national_teams"][:1]

    comps = wl.get("competitions", [])

    # ── 1. Player stats ────────────────────────────────────────────────
    print("\n1. Fetching player stats…")
    players = []
    for pid in wl.get("players", []):
        print(f"   player {pid}")
        data = fetch_player_stats(pid, comps)
        if data:
            players.append(data)
        else:
            print(f"   ⚠️  No data for player {pid}")

    write_json(DATA_DIR / "players.json", {
        "generated_at": now_iso(),
        "players": players,
    })

    # ── 2. Club statistics ─────────────────────────────────────────────
    print("\n2. Fetching club stats…")
    clubs = []
    for cid in wl.get("clubs", []):
        # Try each competition until we get data
        for comp in comps:
            print(f"   club {cid} / {comp['label']}")
            data = fetch_team_statistics(cid, comp)
            if data:
                clubs.append(data)
                break

    write_json(DATA_DIR / "teams-clubs.json", {
        "generated_at": now_iso(),
        "clubs": clubs,
    })

    # ── 3. National team statistics ────────────────────────────────────
    print("\n3. Fetching national team stats…")
    national = []
    for tid in wl.get("national_teams", []):
        for comp in comps:
            print(f"   national {tid} / {comp['label']}")
            data = fetch_team_statistics(tid, comp)
            if data:
                national.append(data)
                break

    write_json(DATA_DIR / "teams-national.json", {
        "generated_at": now_iso(),
        "national_teams": national,
    })

    # ── 4. Referee aggregation ─────────────────────────────────────────
    print("\n4. Aggregating referee stats from saved fixtures…")
    referees = aggregate_referees()
    write_json(DATA_DIR / "referees.json", {
        "generated_at": now_iso(),
        "referees": referees,
    })
    print(f"   {len(referees)} referee(s) aggregated")

    # ── 5. Update meta ─────────────────────────────────────────────────
    meta = read_json(DATA_DIR / "meta.json") or {}
    meta.setdefault("last_updated", {})
    ts = now_iso()
    meta["last_updated"]["players"]       = ts
    meta["last_updated"]["teams_clubs"]   = ts
    meta["last_updated"]["teams_national"]= ts
    meta["last_updated"]["referees"]      = ts
    meta["plan"]          = os.environ.get("API_PLAN", "pro")
    meta["degraded_mode"] = degraded
    write_json(DATA_DIR / "meta.json", meta)

    print(f"\n✅ Done — {request_count} API request(s) used")


if __name__ == "__main__":
    main()
