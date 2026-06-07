#!/usr/bin/env python3
"""
Fetch upcoming & recent fixtures with full detail (predictions, lineups, events).
Designed to run 4x/day via GitHub Actions.
Budget: ~200 API requests per run.
"""
import json, os, sys, time, requests
from datetime import datetime, timedelta, timezone
from pathlib import Path

API_KEY  = os.environ.get("API_FOOTBALL_KEY", "")
BASE_URL = "https://v3.football.api-sports.io"
DATA_DIR = Path("data")
CFG_DIR  = Path("config")

HEADERS  = {
    "x-rapidapi-key":  API_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
}

request_count = 0
MAX_REQUESTS  = int(os.environ.get("MAX_REQUESTS", "200"))
CALL_DELAY    = 0.35   # seconds between requests

UPCOMING_ST  = {"NS", "TBD", "PST"}
LIVE_ST      = {"1H", "HT", "2H", "ET", "BT", "P", "INT", "LIVE"}
PLAYED_ST    = {"FT", "AET", "PEN"}

# ─── API helpers ────────────────────────────────────────────────────────────

def api_get(endpoint, params=None, retries=2):
    global request_count
    if not API_KEY:
        print("  ❌ API_FOOTBALL_KEY not set — skipping API call")
        return None
    if request_count >= MAX_REQUESTS:
        print(f"  ⚠️  Hard quota limit reached ({MAX_REQUESTS})")
        return None

    url = f"{BASE_URL}{endpoint}"
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, params=params, timeout=30)
            request_count += 1
            time.sleep(CALL_DELAY)

            if r.status_code == 429:
                print(f"  ⏳ Rate limited — sleeping 10s")
                time.sleep(10)
                continue
            if r.status_code == 200:
                data = r.json()
                errors = data.get("errors", {})
                if errors and (isinstance(errors, dict) and errors or isinstance(errors, list) and errors):
                    print(f"  ⚠️  API error {endpoint}: {errors}")
                    return None
                remaining = r.headers.get("x-ratelimit-requests-remaining")
                if remaining and int(remaining) < 30:
                    print(f"  ⚠️  Low quota: {remaining} remaining")
                return data.get("response", [])
            r.raise_for_status()
        except requests.RequestException as e:
            print(f"  ❌ Request failed ({attempt+1}/{retries+1}): {e}")
            if attempt < retries:
                time.sleep(2 ** attempt)
    return None

# ─── File helpers ────────────────────────────────────────────────────────────

def write_json(path, obj):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  ✓ {p}")

def read_json(path):
    p = Path(path)
    if not p.exists():
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# ─── Data normalisation ──────────────────────────────────────────────────────

def slim_fixture(raw):
    f  = raw.get("fixture", {})
    lg = raw.get("league", {})
    t  = raw.get("teams", {})
    sc = raw.get("score", {})
    g  = raw.get("goals", {})

    ft_score = sc.get("fulltime") or g
    return {
        "id":     f.get("id"),
        "date":   f.get("date"),
        "status": f.get("status", {}).get("short"),
        "elapsed":f.get("status", {}).get("elapsed"),
        "referee":f.get("referee"),
        "venue": {
            "name": (f.get("venue") or {}).get("name"),
            "city": (f.get("venue") or {}).get("city"),
        },
        "league": {
            "id":      lg.get("id"),
            "name":    lg.get("name"),
            "country": lg.get("country"),
            "logo":    lg.get("logo"),
            "season":  lg.get("season"),
            "round":   lg.get("round"),
        },
        "teams": {
            "home": {
                "id":     (t.get("home") or {}).get("id"),
                "name":   (t.get("home") or {}).get("name"),
                "logo":   (t.get("home") or {}).get("logo"),
                "winner": (t.get("home") or {}).get("winner"),
            },
            "away": {
                "id":     (t.get("away") or {}).get("id"),
                "name":   (t.get("away") or {}).get("name"),
                "logo":   (t.get("away") or {}).get("logo"),
                "winner": (t.get("away") or {}).get("winner"),
            },
        },
        "score": {
            "halftime":  sc.get("halftime",  {"home": None, "away": None}),
            "fulltime":  ft_score if ft_score else {"home": None, "away": None},
            "extratime": sc.get("extratime", {"home": None, "away": None}),
            "penalty":   sc.get("penalty",   {"home": None, "away": None}),
        },
    }

# ─── Fetch helpers ──────────────────────────────────────────────────────────

def fetch_all_fixtures(watchlist):
    opts       = watchlist.get("options", {})
    days_ahead = opts.get("days_ahead", 7)
    days_back  = opts.get("days_behind", 5)
    today      = datetime.now(timezone.utc).date()
    date_from  = (today - timedelta(days=days_back)).isoformat()
    date_to    = (today + timedelta(days=days_ahead)).isoformat()

    fixtures = {}

    for comp in watchlist.get("competitions", []):
        print(f"  [{comp['label']}] fetching {date_from} → {date_to}")
        rows = api_get("/fixtures", {
            "league":  comp["league_id"],
            "season":  comp["season"],
            "from":    date_from,
            "to":      date_to,
        })
        if rows is None:
            continue
        for raw in rows:
            fid = (raw.get("fixture") or {}).get("id")
            if fid:
                fixtures[fid] = raw

    return fixtures

def fetch_predictions(fid):
    rows = api_get("/predictions", {"fixture": fid})
    if not rows:
        return {"available": False}
    pred = rows[0]
    p    = pred.get("predictions", {}) or {}
    cmp  = pred.get("comparison", {}) or {}
    h2h_raw = pred.get("h2h", []) or []

    h2h = []
    for raw in h2h_raw[:5]:
        ff = (raw.get("fixture") or {})
        tt = (raw.get("teams") or {})
        gg = (raw.get("goals") or {})
        h2h.append({
            "date":  ff.get("date", "")[:10],
            "home":  {"name": (tt.get("home") or {}).get("name"), "goals": gg.get("home")},
            "away":  {"name": (tt.get("away") or {}).get("name"), "goals": gg.get("away")},
        })

    winner = p.get("winner") or {}
    return {
        "available":  True,
        "winner":     {"id": winner.get("id"), "name": winner.get("name"), "comment": winner.get("comment")},
        "percent":    p.get("percent", {}),
        "advice":     p.get("advice"),
        "goals":      p.get("goals", {}),
        "comparison": {
            k: {"home": (cmp.get(k) or {}).get("home"), "away": (cmp.get(k) or {}).get("away")}
            for k in ["form","att","def","poisson_distribution","h2h","total"]
        },
        "h2h": h2h,
    }

def fetch_lineups(fid):
    rows = api_get("/fixtures/lineups", {"fixture": fid})
    if not rows or len(rows) < 1:
        return {"status": "unavailable", "home": None, "away": None}

    def parse_side(side):
        if not side:
            return None
        def parse_pl(p):
            pl = (p.get("player") or {})
            return {"id": pl.get("id"), "name": pl.get("name"),
                    "number": pl.get("number"), "pos": pl.get("pos"), "grid": pl.get("grid")}
        return {
            "formation":   side.get("formation"),
            "startXI":     [parse_pl(p) for p in (side.get("startXI") or [])],
            "substitutes": [parse_pl(p) for p in (side.get("substitutes") or [])],
        }

    home_side = rows[0]
    away_side = rows[1] if len(rows) > 1 else None
    official  = bool(home_side.get("startXI") and len(home_side.get("startXI", [])) == 11)

    return {
        "status": "official" if official else "probable",
        "home":   parse_side(home_side),
        "away":   parse_side(away_side),
    }

def fetch_events(fid):
    rows = api_get("/fixtures/events", {"fixture": fid})
    if rows is None:
        return None
    events = []
    for ev in rows:
        time_  = ev.get("time") or {}
        team   = ev.get("team") or {}
        player = ev.get("player") or {}
        assist = ev.get("assist") or {}
        events.append({
            "time":       time_.get("elapsed"),
            "time_extra": time_.get("extra"),
            "team":   {"id": team.get("id"),   "name": team.get("name")},
            "player": {"id": player.get("id"), "name": player.get("name")},
            "assist": {"id": assist.get("id"), "name": assist.get("name")},
            "type":    ev.get("type"),
            "detail":  ev.get("detail"),
        })
    return events

def fetch_statistics(fid):
    rows = api_get("/fixtures/statistics", {"fixture": fid})
    if rows is None:
        return None
    result = {}
    for team_block in rows:
        team   = team_block.get("team") or {}
        tid    = team.get("id")
        stats  = {}
        for stat in (team_block.get("statistics") or []):
            key = (stat.get("type") or "").lower().replace(" ", "_")
            stats[key] = stat.get("value")
        result[str(tid)] = {"team": {"id": tid, "name": team.get("name")}, "stats": stats}
    return result

def build_players_to_watch(lineups, player_lookup):
    result = []
    if not lineups or lineups.get("status") == "unavailable":
        return result
    for side in ["home", "away"]:
        side_data = lineups.get(side)
        if not side_data:
            continue
        candidates = []
        for p in (side_data.get("startXI") or []):
            pid = p.get("id")
            if pid and pid in player_lookup:
                pdata = player_lookup[pid]
                s = pdata.get("season_stats") or {}
                goals   = (s.get("goals") or {}).get("total") or 0
                assists = (s.get("goals") or {}).get("assists") or 0
                rating  = float(s.get("rating") or 0)
                score   = goals * 2 + assists + rating
                candidates.append({"data": pdata, "score": score})

        candidates.sort(key=lambda x: x["score"], reverse=True)
        for c in candidates[:2]:
            d = c["data"]
            s = d.get("season_stats") or {}
            result.append({
                "player": {
                    "id":    d.get("id"),
                    "name":  d.get("name"),
                    "team":  (d.get("team") or {}).get("name"),
                    "photo": d.get("photo"),
                },
                "stats": {
                    "appearances": s.get("appearances"),
                    "goals":       (s.get("goals") or {}).get("total"),
                    "assists":     (s.get("goals") or {}).get("assists"),
                    "minutes":     s.get("minutes"),
                    "rating":      s.get("rating"),
                    "yellow_cards":(s.get("cards") or {}).get("yellow"),
                    "red_cards":   (s.get("cards") or {}).get("red"),
                },
            })
    return result

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("⚽ fetch_fixtures.py starting")
    wl = read_json(CFG_DIR / "watchlist.json")
    if not wl:
        print("❌ config/watchlist.json not found")
        sys.exit(1)

    if wl.get("options", {}).get("degraded_mode"):
        print("⚠️  Degraded mode — reducing scope")
        wl["competitions"] = wl["competitions"][:1]
        wl["options"]["days_ahead"] = 3
        wl["options"]["days_behind"] = 2

    # Load enrichment data (already fetched by fetch_stats.py)
    player_lookup = {}
    players_data = read_json(DATA_DIR / "players.json")
    if players_data:
        for p in (players_data.get("players") or []):
            player_lookup[p["id"]] = p

    teams_lookup = {}
    for fname in ["teams-clubs.json", "teams-national.json"]:
        td = read_json(DATA_DIR / fname)
        if td:
            key = "clubs" if "clubs" in td else "national_teams"
            for t in (td.get(key) or []):
                teams_lookup[t["id"]] = t

    referees_lookup = {}
    refs_data = read_json(DATA_DIR / "referees.json")
    if refs_data:
        for r in (refs_data.get("referees") or []):
            referees_lookup[r["name"].lower()] = r

    # 1. Fetch fixture list
    print("\n1. Fetching fixture list…")
    raw_fixtures = fetch_all_fixtures(wl)
    print(f"   {len(raw_fixtures)} relevant fixture(s) found")

    upcoming = []
    recent   = []

    for fid, raw in raw_fixtures.items():
        status = (raw.get("fixture", {}).get("status") or {}).get("short", "")
        slim   = slim_fixture(raw)

        if status in UPCOMING_ST or status in LIVE_ST:
            upcoming.append(slim)
        elif status in PLAYED_ST:
            recent.append(slim)

    upcoming.sort(key=lambda x: x["date"] or "")
    recent.sort(key=lambda x: x["date"] or "", reverse=True)

    # 2. Build detail files
    print("\n2. Fetching match details…")
    fetch_predictions_flag = wl.get("options", {}).get("fetch_predictions", True)

    for fix in list(upcoming) + list(recent):
        fid    = fix["id"]
        status = fix["status"]
        ht_id  = (fix["teams"]["home"] or {}).get("id")
        at_id  = (fix["teams"]["away"] or {}).get("id")
        hn     = fix["teams"]["home"].get("name", "?")
        an     = fix["teams"]["away"].get("name", "?")
        print(f"  [{status:3}] {hn} vs {an}")

        detail = {
            "generated_at":    now_iso(),
            "fixture":         fix,
            "predictions":     None,
            "lineups":         None,
            "players_to_watch":[],
            "team_stats": {
                "home": teams_lookup.get(ht_id),
                "away": teams_lookup.get(at_id),
            },
            "referee_stats": None,
            "events":       None,
            "statistics":   None,
        }

        # Referee
        ref_name = fix.get("referee") or ""
        if ref_name:
            detail["referee_stats"] = referees_lookup.get(ref_name.lower(), {
                "name": ref_name, "available": False
            })
            if detail["referee_stats"] and "available" not in detail["referee_stats"]:
                detail["referee_stats"]["available"] = True

        if status in UPCOMING_ST:
            # Predictions
            if fetch_predictions_flag:
                print("    → predictions")
                detail["predictions"] = fetch_predictions(fid)

            # Lineups (probable)
            print("    → lineups")
            detail["lineups"] = fetch_lineups(fid)

            # Players to watch
            detail["players_to_watch"] = build_players_to_watch(
                detail["lineups"], player_lookup
            )

        elif status in PLAYED_ST or status in LIVE_ST:
            # Events
            print("    → events")
            detail["events"] = fetch_events(fid)

            # Statistics
            print("    → statistics")
            detail["statistics"] = fetch_statistics(fid)

            # Real lineups
            print("    → lineups")
            lineups = fetch_lineups(fid)
            if lineups:
                lineups["status"] = "official"
            detail["lineups"] = lineups

        write_json(DATA_DIR / "fixtures" / f"{fid}.json", detail)

    # 3. Write list files
    write_json(DATA_DIR / "fixtures-upcoming.json", {
        "generated_at": now_iso(),
        "fixtures":     upcoming[:30],
    })
    write_json(DATA_DIR / "fixtures-recent.json", {
        "generated_at": now_iso(),
        "fixtures":     recent[:20],
    })

    # 4. Update meta
    meta = read_json(DATA_DIR / "meta.json") or {}
    meta.setdefault("last_updated", {})
    meta["last_updated"]["fixtures_upcoming"] = now_iso()
    meta["last_updated"]["fixtures_recent"]   = now_iso()
    meta["plan"]          = os.environ.get("API_PLAN", "pro")
    meta["degraded_mode"] = wl.get("options", {}).get("degraded_mode", False)
    write_json(DATA_DIR / "meta.json", meta)

    print(f"\n✅ Done — {request_count} API request(s) used")


if __name__ == "__main__":
    main()
