"""
One-off: fill race_results.grid_position from Karteando qualifying sessions.

For each official race with results, look up clasificacion heats on that date
(and nearby dates if Karteando has nothing), pick the heat whose driver names
best overlap our grid, and write qualifying position as grid_position.
"""
from __future__ import annotations

import json
import os
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

ENV = Path(__file__).resolve().parents[1] / ".env.local"
for line in ENV.read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

SB = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
KARTEANDO = "https://www.karteando.cl/api"


def sb(method: str, path: str, body: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"{SB}/rest/v1/{path}",
        data=data,
        method=method,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def sb_get(path: str):
    req = urllib.request.Request(
        f"{SB}/rest/v1/{path}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def k_get(path: str):
    req = urllib.request.Request(
        f"{KARTEANDO}/{path}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())


def normalize(s: str) -> str:
    s = s.lower().strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"^gkd[\s_-]*", "", s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


def sessions_for(date: str) -> list[dict]:
    data = k_get(f"races-v0?date={date}")
    return data.get("races") or []


SESSION_CACHE: dict[str, list[dict]] = {}


def session_results(session_id: str) -> list[dict]:
    if session_id in SESSION_CACHE:
        return SESSION_CACHE[session_id]
    q = urllib.parse.quote(session_id, safe="")
    data = k_get(f"race-results-v0?sessionId={q}")
    drivers = data.get("race", {}).get("drivers") or data.get("results") or []
    SESSION_CACHE[session_id] = drivers
    time.sleep(0.05)
    return drivers


def nearby_dates(iso: str) -> list[str]:
    d = datetime.strptime(iso, "%Y-%m-%d")
    out = [iso]
    for delta in (1, -1, 7, -7, 6, -6):
        out.append((d + timedelta(days=delta)).strftime("%Y-%m-%d"))
    return out


def main() -> None:
    drivers = sb_get("drivers?select=id,alias")
    mappings = sb_get("name_mappings?select=web_name,driver_id")
    races = sb_get("races?select=id,date,month_label,is_official&order=date")
    results = sb_get(
        "race_results?select=id,race_id,driver_id,category,position,grid_position"
    )

    by_alias = {d["alias"].lower(): d["id"] for d in drivers}
    by_norm = {normalize(d["alias"]): d["id"] for d in drivers}
    by_map = {m["web_name"].lower(): m["driver_id"] for m in mappings}

    def resolve(name: str) -> str | None:
        if not name:
            return None
        lower = name.strip().lower()
        return by_map.get(lower) or by_alias.get(lower) or by_norm.get(normalize(name))

    results_by_race: dict[str, list[dict]] = defaultdict(list)
    for r in results:
        results_by_race[r["race_id"]].append(r)

    alias_by_id = {d["id"]: d["alias"] for d in drivers}
    updates: list[tuple[str, int]] = []  # (result_id, grid)
    report: list[str] = []

    for race in races:
        rows = results_by_race.get(race["id"], [])
        if not rows:
            continue

        heats: list[dict] = []
        used_date = None
        for d in nearby_dates(race["date"]):
            heats = sessions_for(d)
            if heats:
                used_date = d
                break
        if not heats:
            report.append(f"{race['date']} {race['month_label']}: SIN sesiones Karteando")
            continue

        quali = [s for s in heats if (s.get("sessionType") or "").lower() == "clasificacion"]
        if not quali:
            report.append(f"{race['date']}: sin clasificacion ({used_date})")
            continue

        for cat in ("F1", "F2"):
            cat_rows = [r for r in rows if r["category"] == cat]
            if not cat_rows:
                continue
            our_ids = {r["driver_id"] for r in cat_rows}

            best = None
            best_score = 0
            best_resolved: dict[str, int] = {}
            for s in quali:
                drivers_k = session_results(s["sessionId"])
                resolved: dict[str, int] = {}
                for dk in drivers_k:
                    did = resolve(str(dk.get("driverName") or ""))
                    pos = dk.get("finalPosition") or dk.get("position")
                    if did and isinstance(pos, (int, float)) and pos >= 1:
                        resolved[did] = int(pos)
                score = len(our_ids & resolved.keys())
                if score > best_score:
                    best_score = score
                    best = s
                    best_resolved = resolved

            need = max(6, int(len(our_ids) * 0.45))
            if best is None or best_score < need:
                report.append(
                    f"{race['date']} {cat}: overlap insuficiente "
                    f"({best_score}/{len(our_ids)}; min {need}) "
                    f"karteando={used_date} session={best.get('sessionName') if best else '—'}"
                )
                continue

            filled = 0
            missing = []
            for r in cat_rows:
                gp = best_resolved.get(r["driver_id"])
                if gp is None:
                    missing.append(alias_by_id.get(r["driver_id"], r["driver_id"]))
                    continue
                updates.append((r["id"], gp))
                filled += 1
            report.append(
                f"{race['date']} {cat}: {filled}/{len(cat_rows)} grillas "
                f"desde {best['sessionName']} ({used_date}, overlap {best_score}) "
                + (f"sin match: {', '.join(missing)}" if missing else "")
            )

    print("\n".join(report))
    print(f"\nPATCH {len(updates)} filas…")
    for i, (rid, gp) in enumerate(updates, 1):
        sb("PATCH", f"race_results?id=eq.{rid}", {"grid_position": gp})
        if i % 40 == 0:
            print(f"  {i}/{len(updates)}")
    print("listo")


if __name__ == "__main__":
    main()
