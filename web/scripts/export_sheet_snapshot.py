"""
Exports a raw snapshot of every relevant tab of "Mundial de Karting 2026"
to web/scripts/sheet_snapshot.json.

This is step 1 of the migration: a dumb, lossless dump (values only, as
rendered). The TypeScript seeder (migrate_to_supabase.ts) does all parsing
and transformation, and the parity check validates the result.

Run from the repo root (where credentials.json lives):
    python web/scripts/export_sheet_snapshot.py
"""

import json
import sys
from pathlib import Path

import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
SPREADSHEET_NAME = "Mundial de Karting 2026"

TABS = [
    "Inscritos",
    "Equipos",
    "Drivers Standings",
    "Team Standings",
    "Suplentes",
    "DOTD",
    "Media",
    "Fecha de Carreras",
    "Tiempos 2026",
]

OUT_PATH = Path(__file__).parent / "sheet_snapshot.json"


def main() -> None:
    creds = Credentials.from_service_account_file("credentials.json", scopes=SCOPES)
    client = gspread.authorize(creds)
    ss = client.open(SPREADSHEET_NAME)

    snapshot = {}
    for tab in TABS:
        try:
            ws = ss.worksheet(tab)
        except gspread.WorksheetNotFound:
            print(f"  ⚠ tab not found, skipping: {tab}", file=sys.stderr)
            continue
        values = ws.get_all_values()
        snapshot[tab] = values
        print(f"  ✓ {tab}: {len(values)} rows")

    OUT_PATH.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1))
    print(f"\nSnapshot written to {OUT_PATH}")


if __name__ == "__main__":
    main()
