"""One-shot import of pilot/team photos from Google Drive into Supabase Storage.

Uses the karting-sheets-bot service account (credentials.json at the repo
root, must have read access to the photo folders) to download the original
files via the Drive API — no public sharing required.

The file index (slug -> Drive file id) comes from the deployed Apps Script
JSON API, which already maps "ALIAS - CONSTRUCTOR.jpg" filenames to slugs.

Usage (from repo root):
    set -a; source web/.env.local; set +a
    .venv/bin/python web/scripts/import_drive_photos.py

Re-runnable: uploads use upsert and URLs are overwritten.
"""

import os
import re
import sys
import unicodedata

import requests
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials

GKD_API_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbyF8cSTm6lRmXDImIHXKvnh4EPHo27Ubk80NKKrW28NmX4zCeUFFYqWd0kLNcMYOic/exec"
)
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CREDENTIALS_FILE = os.path.join(REPO_ROOT, "credentials.json")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# DB alias -> Drive filename slug, when they don't match.
ALIAS_OVERRIDES = {
    "JUAN CAMPOS": "juan",
    "JOSE MANUEL": "manolo",
}


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = re.sub(r"\s+", "-", s)
    return re.sub(r"[^a-z0-9-]", "", s)


def drive_token() -> str:
    creds = Credentials.from_service_account_file(
        CREDENTIALS_FILE,
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )
    creds.refresh(Request())
    return creds.token


def supa_headers(extra=None):
    h = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    if extra:
        h.update(extra)
    return h


def download_drive_file(token: str, file_id: str) -> bytes | None:
    r = requests.get(
        f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    if r.status_code != 200:
        return None
    return r.content


def upload_to_storage(path: str, data: bytes, content_type: str) -> str:
    r = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/fotos/{path}",
        headers=supa_headers({"Content-Type": content_type, "x-upsert": "true"}),
        data=data,
        timeout=60,
    )
    r.raise_for_status()
    return f"{SUPABASE_URL}/storage/v1/object/public/fotos/{path}"


def import_entities(token, index, table, name_col, label):
    rows = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}?select=id,{name_col}",
        headers=supa_headers(),
        timeout=30,
    ).json()

    ok, missing = 0, []
    folder = "pilots" if table == "drivers" else "teams"
    for row in rows:
        name = row[name_col]
        slug = ALIAS_OVERRIDES.get(name, slugify(name)) if table == "drivers" else slugify(name)
        entry = index.get(slug)
        if not entry:
            missing.append(name)
            continue
        data = download_drive_file(token, entry["id"])
        if data is None:
            print(f"  ✗ {name}: descarga falló (¿la SA tiene acceso al archivo?)")
            continue
        ext = "png" if entry["original"].lower().endswith(".png") else "jpg"
        ctype = "image/png" if ext == "png" else "image/jpeg"
        url = upload_to_storage(f"{folder}/{slugify(name)}.{ext}", data, ctype)
        patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{row['id']}",
            headers=supa_headers({"Content-Type": "application/json"}),
            json={"photo_url": url},
            timeout=30,
        )
        patch.raise_for_status()
        ok += 1
    print(f"{label}: {ok} fotos importadas.")
    if missing:
        print(f"  Sin foto en Drive: {', '.join(missing)}")


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        sys.exit("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (source web/.env.local)")

    token = drive_token()
    print("Consultando el Apps Script (puede tardar ~20s)…")
    api = requests.get(GKD_API_URL, timeout=120).json()
    pilots = api.get("drive_images", {}).get("pilots", {})
    teams = api.get("drive_images", {}).get("teams", {})
    print(f"Drive index: {len(pilots)} fotos de pilotos, {len(teams)} de equipos")

    import_entities(token, pilots, "drivers", "alias", "Pilotos")
    import_entities(token, teams, "teams", "escuderia", "Equipos")


if __name__ == "__main__":
    main()
