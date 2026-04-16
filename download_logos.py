"""
download_logos.py — GKD Championship 2026
==========================================
Downloads official F1 team logos and saves them to assets/images/logos/<slug>.png

Uses the Wikipedia REST API (summary endpoint) to get thumbnail URLs, which is
the officially supported programmatic access method — no rate-limiting issues.

Usage:
    python download_logos.py

Re-run safely: already-downloaded files are skipped.
"""

import os
import re
import sys
import time
import json
import unicodedata
import urllib.request
import urllib.error
import urllib.parse

# ── Target folder ────────────────────────────────────────────────────────────
LOGOS_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "assets", "images", "logos"
)
os.makedirs(LOGOS_DIR, exist_ok=True)

# ── Wikipedia article titles → local slug ────────────────────────────────────
# Key   = escudería name as used in app.js / CONSTRUCTOR_COLORS
# Value = Wikipedia article title for that team (English Wikipedia)
TEAMS = {
    # Modern F1 2026
    "McLaren":         "McLaren",
    "Red Bull":        "Red Bull Racing",
    "Mercedes":        "Mercedes-AMG Petronas F1 Team",
    "Ferrari":         "Scuderia Ferrari",
    "Williams":        "Williams Racing",
    "Aston Martin":    "Aston Martin Aramco F1 Team",
    "Alpine":          "Alpine F1 Team",
    "Haas":            "Haas F1 Team",
    "Racing Bulls":    "Racing Bulls",
    "Audi":            "Audi",
    "Cadillac":        "Andretti Global",
    # Classic / F2 teams
    "Lotus":           "Lotus F1 Team",
    "Renault":         "Renault in Formula One",
    "Benetton":        "Benetton Formula",
    "Brawn GP":        "Brawn GP",
    "Jaguar":          "Jaguar Racing (Formula One)",   # correct classic F1 team article
    "BMW":             "BMW Sauber",
    "Sauber":          "Sauber Motorsport",
    "Arrows":          "Arrows Grand Prix International",
    "Brabham":         "Brabham",
}

# Fallback direct image URLs — used when Wikipedia summary has no thumbnail.
# These are direct Wikimedia Commons file URLs (SVG saved with .png extension;
# modern browsers render SVG files in <img> tags without issues).
DIRECT_URLS = {
    # ── Modern F1 ──
    "McLaren":      "https://upload.wikimedia.org/wikipedia/commons/6/6b/McLaren_Racing_logo.svg",
    "Red Bull":     "https://upload.wikimedia.org/wikipedia/commons/9/9a/Red_Bull_Racing_logo.svg",
    "Mercedes":     "https://upload.wikimedia.org/wikipedia/commons/f/fb/Mercedes_AMG_Petronas_F1_Logo.svg",
    "Ferrari":      "https://upload.wikimedia.org/wikipedia/commons/3/32/Scuderia_Ferrari_Logo.svg",
    "Williams":     "https://upload.wikimedia.org/wikipedia/commons/a/ab/Williams_Racing_2020_logo.svg",
    "Aston Martin": "https://upload.wikimedia.org/wikipedia/commons/9/9f/Aston_Martin_Aramco_Cognizant_F1_Logo.svg",
    "Alpine":       "https://upload.wikimedia.org/wikipedia/commons/a/a2/Alpine_F1_Logo.svg",
    "Haas":         "https://upload.wikimedia.org/wikipedia/commons/7/7c/Haas_F1_Team_logo.svg",
    "Racing Bulls": "https://upload.wikimedia.org/wikipedia/commons/e/e3/Visa_Cash_App_RB_logo.svg",
    "Audi":         "https://upload.wikimedia.org/wikipedia/commons/9/92/Audi-Logo_2016.svg",
    "Cadillac":     "https://upload.wikimedia.org/wikipedia/commons/f/f6/Cadillac_logo.svg",
    # ── Classic / F2 ──
    "Lotus":        "https://upload.wikimedia.org/wikipedia/commons/0/03/Lotus_F1_Team_logo.svg",
    "Renault":      "https://upload.wikimedia.org/wikipedia/commons/b/b7/Renault_F1_Team_logo.svg",
    "Benetton":     "https://upload.wikimedia.org/wikipedia/commons/8/85/Benetton_Formula_logo.svg",
    "Brawn GP":     "https://upload.wikimedia.org/wikipedia/commons/2/23/Brawn_GP_Logo.svg",
    # Jaguar Racing classic F1 (2000-2004) — NOT the current Jaguar TCS Racing EV team
    "Jaguar":       "https://upload.wikimedia.org/wikipedia/en/3/3e/Jaguar_Racing_F1_logo.png",
    "BMW":          "https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg",
    "Sauber":       "https://upload.wikimedia.org/wikipedia/commons/9/94/Logo_sauber_f1.svg",
    "Arrows":       "https://upload.wikimedia.org/wikipedia/commons/b/b5/Arrows_Grand_Prix_International_logo.svg",
    "Brabham":      "https://upload.wikimedia.org/wikipedia/en/6/6e/Brabham_logo.png",
    "Ferrari Classic": "https://upload.wikimedia.org/wikipedia/commons/3/32/Scuderia_Ferrari_Logo.svg",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}

WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary/{}"


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().strip()
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^a-z0-9-]", "", s)
    return s


def fetch_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return None


def fetch_bytes(url: str) -> bytes | None:
    h = {
        **HEADERS,
        "Accept": "image/png,image/svg+xml,image/webp,image/*;q=0.8",
        "Referer": "https://en.wikipedia.org/",
    }
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read()
    except Exception as e:
        print(f"       fetch failed: {e}")
        return None


def download_team(name: str, article: str) -> bool:
    slug = slugify(name)
    dest = os.path.join(LOGOS_DIR, f"{slug}.png")

    if os.path.exists(dest) and os.path.getsize(dest) > 500:
        print(f"  [skip]  {slug}.png")
        return True

    # 1. Try Wikipedia REST API summary → thumbnail.source
    api_url = WIKI_API.format(urllib.parse.quote(article))
    data = fetch_json(api_url)
    img_url = None

    if data and "thumbnail" in data:
        img_url = data["thumbnail"].get("source")

    if img_url:
        print(f"  [wiki]  {slug}  — {img_url[:70]}…")
        raw = fetch_bytes(img_url)
        if raw and len(raw) > 500:
            with open(dest, "wb") as f:
                f.write(raw)
            print(f"  [ok]    {slug}.png  ({len(raw)//1024} KB)")
            return True

    # 2. Fallback: direct SVG from Wikimedia Commons (saved as .png; browsers accept SVG)
    if name in DIRECT_URLS:
        svg_url = DIRECT_URLS[name]
        # Save SVG with .png extension — app.js will try it and it renders fine in <img>
        svg_dest = dest  # keep .png extension; the file will actually be SVG
        print(f"  [svg]   {slug}  — trying direct SVG…")
        raw = fetch_bytes(svg_url)
        if raw and len(raw) > 200:
            with open(svg_dest, "wb") as f:
                f.write(raw)
            print(f"  [ok]    {slug}.png (SVG)  ({len(raw)//1024} KB)")
            return True

    print(f"  [fail]  {slug}  — no image found")
    return False


def main():
    print(f"\nDownloading {len(TEAMS)} F1 / classic team logos → {LOGOS_DIR}\n")

    # Force re-download of specific logos that had wrong sources before
    force_refresh = ["jaguar", "brabham"]
    for slug in force_refresh:
        old = os.path.join(LOGOS_DIR, f"{slug}.png")
        if os.path.exists(old):
            os.remove(old)
            print(f"  [reset] {slug}.png  (forcing re-download with correct source)")

    ok = fail = 0

    for name, article in TEAMS.items():
        success = download_team(name, article)
        if success:
            ok += 1
        else:
            fail += 1
        time.sleep(0.5)   # polite delay; Wikipedia API allows ~200 req/s with proper UA

    print(f"\nDone: {ok} downloaded, {fail} failed.")
    if fail:
        print(
            "\nTeams without a logo file will render their name as styled\n"
            "text on the brand colour in the podium (graceful fallback).\n"
            "Re-run this script to retry any failures."
        )
    print(f"\nLogos saved to:\n  {LOGOS_DIR}\n")


if __name__ == "__main__":
    main()
