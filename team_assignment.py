
#!/usr/bin/env python3
"""
team_assignment.py
------------------
Reads the "Inscritos" and "Ranking" Google Sheets, builds F1/F2 team pairs,
and writes a formatted "Equipos" sheet with official 2026 F1 constructor colors.

Usage:
    python team_assignment.py

Flow:
    1. Ensures "Inscritos" sheet exists (creates it if missing)
    2. Reads registered pilot names from "Inscritos"
    3. Reads ranking from "Ranking" sheet (exported by Karting_Analysis.ipynb)
    4. Pairs pilots: rank 1 with rank 16, rank 2 with rank 15, ... per category
    5. Writes/updates "Equipos" sheet — preserves existing Escudería selections
       and applies constructor row colors for any team that already chose one


Usage:
    python team_assignment.py           # build/update Equipos sheet
    python team_assignment.py --seed    # populate Inscritos sheet with confirmed pilot list

"""

import argparse
import math
import sys

import gspread
import pandas as pd
from google.oauth2.service_account import Credentials


# ── Constants ─────────────────────────────────────────────────────────────────

F1_SIZE     = 16       # pilots per category
TEAMS       = 8        # teams per category
PLACEHOLDER = "TBD"   # used when a category has an odd number of pilots

SPREADSHEET_NAME = "Mundial de Karting 2026"

# Official 2026 F1 timing display hex codes (source: F1.com / r/formula1)
# Audi = #EB4526 (red/orange) — 2026 silver+red livery, NOT dark blue
CONSTRUCTOR_COLORS: dict[str, dict[str, str]] = {
    "McLaren":      {"bg": "#EF8733", "fg": "#000000"},
    "Red Bull":     {"bg": "#4570C0", "fg": "#FFFFFF"},
    "Mercedes":     {"bg": "#75F1D3", "fg": "#000000"},
    "Ferrari":      {"bg": "#D52E37", "fg": "#FFFFFF"},
    "Williams":     {"bg": "#3267D4", "fg": "#FFFFFF"},
    "Aston Martin": {"bg": "#4B9774", "fg": "#FFFFFF"},
    "Alpine":       {"bg": "#479FE2", "fg": "#FFFFFF"},
    "Haas":         {"bg": "#DFE1E2", "fg": "#000000"},
    "Racing Bulls": {"bg": "#7091F8", "fg": "#FFFFFF"},
    "Audi":         {"bg": "#EB4526", "fg": "#FFFFFF"},
    "Cadillac":     {"bg": "#AAAADD", "fg": "#000000"},
}

# Equipos sheet column order
COLUMNS  = ["Elección", "Equipo #", "Piloto 1", "Mejor Tiempo P1 (C)",
            "Piloto 2", "Mejor Tiempo P2 (C)", "Escudería"]
NUM_COLS = len(COLUMNS)   # 7

# Fixed F2 team pairs — exceptions to the automatic 1↔16 pairing.
# Each tuple is (RANKING_NAME_1, RANKING_NAME_2).  The pilot that appears
# earlier in F2's ranked list determines the pick_order for the pair.
FIXED_F2_PAIRS: list[tuple[str, str]] = [
    ("ALFRE", "GIANFRANCO"),
]

# ── Sheet style: dark-navy category headers, blue column headers (matching fast_lap style) ──
_NAV  = {"red": 0.102, "green": 0.227, "blue": 0.361}   # #1A3A5C  category bg
_BLU  = {"red": 0.176, "green": 0.322, "blue": 0.471}   # #2D5278  header bg
_WHT  = {"red": 1.0,   "green": 1.0,   "blue": 1.0}     # white text / data bg
_DRK  = {"red": 0.133, "green": 0.133, "blue": 0.133}   # #222222  data text

# Column widths (pixels) — Elección, Equipo#, Piloto 1, Tiempo P1, Piloto 2, Tiempo P2, Escudería
_COL_WIDTHS = [70, 70, 180, 130, 180, 130, 130]


# ── Google Sheets auth ────────────────────────────────────────────────────────

def _get_spreadsheet() -> gspread.Spreadsheet:
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds  = Credentials.from_service_account_file("credentials.json", scopes=scopes)
    client = gspread.authorize(creds)
    return client.open(SPREADSHEET_NAME)


# ── Low-level Sheets API helpers ──────────────────────────────────────────────

def _hex_to_rgb(hex_color: str) -> dict:
    """Converts '#RRGGBB' → Sheets API color dict (0-1 float values)."""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return {"red": r / 255, "green": g / 255, "blue": b / 255}


def _range_dict(sheet_id: int, r0: int, r1: int, c0: int, c1: int) -> dict:
    return {
        "sheetId":          sheet_id,
        "startRowIndex":    r0,
        "endRowIndex":      r1,
        "startColumnIndex": c0,
        "endColumnIndex":   c1,
    }


def _fmt_request(sheet_id: int, r0: int, r1: int, c0: int, c1: int,
                 bg=None, fg=None, bold: bool = False,
                 h_align: str | None = None, font_size: int | None = None) -> dict:
    """Builds a repeatCell formatting request."""
    fmt    = {}
    fields = []

    if bg is not None:
        fmt["backgroundColor"] = bg
        fields.append("backgroundColor")

    tf = {}
    if fg is not None:
        tf["foregroundColor"] = fg
    if bold:
        tf["bold"] = True
    if font_size:
        tf["fontSize"] = font_size
    if tf:
        fmt["textFormat"] = tf
        fields.append("textFormat")

    if h_align:
        fmt["horizontalAlignment"] = h_align
        fields.append("horizontalAlignment")

    return {
        "repeatCell": {
            "range":  _range_dict(sheet_id, r0, r1, c0, c1),
            "cell":   {"userEnteredFormat": fmt},
            "fields": "userEnteredFormat(" + ",".join(fields) + ")",
        }
    }


def _merge_request(sheet_id: int, r0: int, r1: int, c0: int, c1: int) -> dict:
    return {
        "mergeCells": {
            "range":     _range_dict(sheet_id, r0, r1, c0, c1),
            "mergeType": "MERGE_ALL",
        }
    }


def _col_width_requests(sheet_id: int) -> list[dict]:
    reqs = []
    for i, w in enumerate(_COL_WIDTHS):
        reqs.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId":    sheet_id,
                    "dimension":  "COLUMNS",
                    "startIndex": i,
                    "endIndex":   i + 1,
                },
                "properties": {"pixelSize": w},
                "fields":     "pixelSize",
            }
        })
    return reqs


def _dropdown_request(sheet_id: int, r0: int, r1: int, col: int) -> dict:
    values = [{"userEnteredValue": name} for name in sorted(CONSTRUCTOR_COLORS)]
    return {
        "setDataValidation": {
            "range": _range_dict(sheet_id, r0, r1, col, col + 1),
            "rule": {
                "condition":    {"type": "ONE_OF_LIST", "values": values},
                "showCustomUi": True,
                "strict":       False,
            },
        }
    }


def _border_solid(color: dict | None = None) -> dict:
    c = color or {"red": 0.8, "green": 0.8, "blue": 0.8}
    return {"style": "SOLID", "color": c}


def _borders_request(sheet_id: int, r0: int, r1: int, c0: int, c1: int) -> dict:
    """Applies a thin solid grid border to every cell in the range."""
    border = _border_solid()
    return {
        "updateBorders": {
            "range": _range_dict(sheet_id, r0, r1, c0, c1),
            "top":          border,
            "bottom":       border,
            "left":         border,
            "right":        border,
            "innerHorizontal": border,
            "innerVertical":   border,
        }
    }


def _reset_format_request(sheet_id: int, r0: int, r1: int, c0: int, c1: int) -> dict:
    """Resets userEnteredFormat to default (empty) for a range."""
    return {
        "repeatCell": {
            "range": _range_dict(sheet_id, r0, r1, c0, c1),
            "cell": {"userEnteredFormat": {}},
            "fields": "userEnteredFormat",
        }
    }


def _freeze_request(sheet_id: int, rows: int = 0, cols: int = 0) -> dict:
    return {
        "updateSheetProperties": {
            "properties": {
                "sheetId": sheet_id,
                "gridProperties": {"frozenRowCount": rows, "frozenColumnCount": cols},
            },
            "fields": "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
        }
    }


# ── Inscritos sheet ───────────────────────────────────────────────────────────

def ensure_inscritos_sheet(spreadsheet: gspread.Spreadsheet) -> gspread.Worksheet:
    """Creates 'Inscritos' sheet if it doesn't exist, with styled # | Piloto headers."""
    try:
        ws = spreadsheet.worksheet("Inscritos")
        print("📋 Hoja 'Inscritos' ya existe.")
        return ws
    except gspread.WorksheetNotFound:
        pass

    ws = spreadsheet.add_worksheet(title="Inscritos", rows=60, cols=5)
    ws.update("A1:B1", [["#", "Piloto"]])

    sid = ws.id
    spreadsheet.batch_update({"requests": [
        _fmt_request(sid, 0, 1, 0, 2, bg=_BLU, fg=_WHT, bold=True, h_align="CENTER"),
        _freeze_request(sid, rows=1),
    ]})
    print("✅ Hoja 'Inscritos' creada con encabezados.")
    return ws


def read_inscritos(spreadsheet: gspread.Spreadsheet) -> list[str]:
    """Returns pilot names (uppercased) from the 'Inscritos' sheet."""
    ws   = spreadsheet.worksheet("Inscritos")
    rows = ws.get_all_values()
    names = [
        row[1].strip().upper()
        for row in rows[1:]          # skip header
        if len(row) >= 2 and row[1].strip()
    ]
    print(f"📋 {len(names)} pilotos inscritos.")
    return names


# ── Ranking sheet ─────────────────────────────────────────────────────────────

def read_ranking(spreadsheet: gspread.Spreadsheet) -> pd.DataFrame:
    """Reads the 'Ranking' sheet exported by the notebook."""
    try:
        ws = spreadsheet.worksheet("Ranking")
    except gspread.WorksheetNotFound:
        raise ValueError(
            "Hoja 'Ranking' no encontrada. Ejecuta la celda de exportación en el notebook primero."
        )

    rows = ws.get_all_values()
    if not rows:
        raise ValueError("Hoja 'Ranking' está vacía. Ejecuta el notebook primero.")

    df = pd.DataFrame(rows[1:], columns=rows[0])

    for col in ["final_place", "pace_pct", "peak_pct", "Performance_Index", "score_adj"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    for col in ["best_A", "best_B", "best_C", "median_C"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # imputed_C comes as "True"/"False" string from Sheets
    if "imputed_C" in df.columns:
        df["imputed_C"] = df["imputed_C"].map(
            lambda v: str(v).strip().lower() in ("true", "1")
        )

    df["Pilotos"] = df["Pilotos"].str.strip().str.upper()
    df = df.sort_values("final_place").reset_index(drop=True)

    # Diagnostic: show which time columns are present and sample values
    time_cols = [c for c in ["best_C", "median_C", "imputed_C"] if c in df.columns]
    if time_cols:
        sample = df[["Pilotos"] + time_cols].head(5)
        print(f"🏁 {len(df)} pilotos en el ranking. Columnas de tiempo: {time_cols}")
        print(sample.to_string(index=False))
    else:
        print(f"🏁 {len(df)} pilotos en el ranking.")
        print("⚠️  Columnas best_C / median_C NO encontradas en la hoja 'Ranking'.")
        print("   → Ejecuta la celda 50 del notebook y vuelve a correr el script.")

    return df


# ── Team building ─────────────────────────────────────────────────────────────

def _safe_float(val) -> float | None:
    """Returns float or None for empty/NaN values."""
    if val in ("", None, "None"):
        return None
    try:
        v = float(val)
        return None if math.isnan(v) else v
    except (TypeError, ValueError):
        return None


def _best_time_c(row: dict) -> str:
    """
    Returns the best lap time for a pilot to show in the Equipos sheet.
    Priority: real best_C → imputed median_C (marked with *) → empty.
    Trazado C is the current and most relevant track.
    """
    real = _safe_float(row.get("best_C"))
    if real is not None:
        return f"{real:.3f}"

    # Fallback: imputed median for track C
    imputed_flag = str(row.get("imputed_C", "")).strip().lower()
    median_c = _safe_float(row.get("median_C"))
    if median_c is not None:
        suffix = "*" if imputed_flag in ("true", "1") else ""
        return f"{median_c:.3f}{suffix}"

    return ""


def build_teams(
    inscritos: list[str], ranking_df: pd.DataFrame
) -> tuple[list[dict], list[dict]]:
    """
    Filters ranking to inscribed pilots, splits into F1 (top 16) and F2 (next 16),
    and pairs: rank 1 with rank 16, rank 2 with rank 15, ..., rank 8 with rank 9.
    Returns (f1_teams, f2_teams), each a list of 8 team dicts.
    """
    inscritos_set = {n.upper() for n in inscritos}
    joined = (
        ranking_df[ranking_df["Pilotos"].isin(inscritos_set)]
        .sort_values("final_place")
        .reset_index(drop=True)
    )

    if joined.empty:
        raise ValueError(
            "Ningún piloto inscrito coincide con el ranking. "
            "Verifica los nombres en la hoja 'Inscritos'."
        )

    f1_group = joined.iloc[:F1_SIZE].reset_index(drop=True)
    f2_group = joined.iloc[F1_SIZE: F1_SIZE * 2].reset_index(drop=True)

    def _make_team(pick_order: int, r1: dict | None, r2: dict | None) -> dict:
        return {
            "pick_order": pick_order,
            "team_num":   pick_order,
            "pilot1":     r1["Pilotos"] if r1 else PLACEHOLDER,
            "best1":      _best_time_c(r1) if r1 else "",
            "pilot2":     r2["Pilotos"] if r2 else PLACEHOLDER,
            "best2":      _best_time_c(r2) if r2 else "",
            "escuderia":  "",
        }

    def _pair_standard(records: list, pad_end: bool = False) -> list[dict]:
        """Pairs rank-1↔last, rank-2↔second-to-last, …, for up to TEAMS pairs.
        pad_end=True adds TBD at the END so rank-1 gets TBD as partner."""
        n = len(records)
        padded = records + [None] * max(0, F1_SIZE - n)
        eff = len(padded)
        teams = []
        for i in range(TEAMS):
            r1 = padded[i]
            r2 = padded[eff - 1 - i]
            if r1 is r2 and r1 is not None:
                r2 = None
            teams.append(_make_team(i + 1, r1, r2))
        return teams

    # ── F1: straight standard pairing ─────────────────────────────────────────
    f1_teams = _pair_standard(f1_group.to_dict("records"))

    # ── F2: standard pairing but respecting FIXED_F2_PAIRS ───────────────────
    f2_records = f2_group.to_dict("records")
    f2_names   = [r["Pilotos"] for r in f2_records]

    # Collect fixed-pair entries (preserve rank order by earliest member)
    fixed_slots: list[dict] = []       # teams inserted at determined pick positions
    fixed_handled: set[str] = set()

    for name1, name2 in FIXED_F2_PAIRS:
        if name1 not in f2_names or name2 not in f2_names:
            print(f"⚠️  Fixed pair ({name1}, {name2}) not both in F2 — skipping.")
            continue
        idx1 = f2_names.index(name1)
        idx2 = f2_names.index(name2)
        earlier, later = (idx1, idx2) if idx1 < idx2 else (idx2, idx1)
        r1 = f2_records[earlier]
        r2 = f2_records[later]
        fixed_slots.append({"insert_after_rank": earlier, "r1": r1, "r2": r2})
        fixed_handled.update({name1, name2})

    # Remaining F2 pilots (excluding fixed-pair pilots)
    remaining = [r for r in f2_records if r["Pilotos"] not in fixed_handled]

    # Pair remaining with standard logic (TBD padded at end for best pilot)
    remaining_padded = remaining + [None] * max(0, F1_SIZE - len(fixed_handled) - len(remaining))
    eff = len(remaining_padded)
    remaining_teams_raw = []
    for i in range(TEAMS - len(fixed_slots)):
        r1 = remaining_padded[i]
        r2 = remaining_padded[eff - 1 - i]
        if r1 is r2 and r1 is not None:
            r2 = None
        remaining_teams_raw.append((r1, r2))

    # Merge fixed and remaining teams, sorting by the rank of their best pilot
    all_team_entries: list[tuple[int, dict | None, dict | None]] = []

    for slot in fixed_slots:
        all_team_entries.append((slot["insert_after_rank"], slot["r1"], slot["r2"]))

    remaining_offset = 0
    for r1, r2 in remaining_teams_raw:
        rank_key = f2_records.index(r1) if r1 in f2_records else 999
        while remaining_offset in [e[0] for e in all_team_entries]:
            remaining_offset += 1
        all_team_entries.append((rank_key, r1, r2))

    all_team_entries.sort(key=lambda x: x[0])

    f2_teams = [
        _make_team(i + 1, r1, r2)
        for i, (_, r1, r2) in enumerate(all_team_entries)
    ]

    return f1_teams, f2_teams


# ── Preserve existing Escudería selections ────────────────────────────────────

def read_existing_escuderias(spreadsheet: gspread.Spreadsheet) -> dict[str, str]:
    """
    Reads the current 'Equipos' sheet and returns a dict mapping
    team keys ("F1-1" … "F1-8", "F2-1" … "F2-8") to their chosen Escudería.
    """
    try:
        ws   = spreadsheet.worksheet("Equipos")
        rows = ws.get_all_values()
    except gspread.WorksheetNotFound:
        return {}

    esc_col     = NUM_COLS - 1   # 0-based index of "Escudería" column
    current_cat = None
    team_idx    = 0
    escuderias: dict[str, str] = {}

    for row in rows:
        if not row or not any(cell.strip() for cell in row):
            current_cat = None
            team_idx    = 0
            continue

        first = row[0].strip().upper()
        if "CATEGORIA F1" in first:
            current_cat = "F1"
            team_idx    = 0
            continue
        if "CATEGORIA F2" in first:
            current_cat = "F2"
            team_idx    = 0
            continue
        if row[0].strip() in ("Elección", "Eleccion"):
            continue

        if current_cat and len(row) > esc_col:
            team_idx += 1
            esc = row[esc_col].strip()
            if esc and esc in CONSTRUCTOR_COLORS:
                escuderias[f"{current_cat}-{team_idx}"] = esc

    return escuderias


# ── Apply constructor row color ───────────────────────────────────────────────

def _color_row_request(sheet_id: int, row_0: int, colors: dict) -> dict:
    """Builds a repeatCell request that colors one row with constructor colors."""
    bg = _hex_to_rgb(colors["bg"])
    fg = _hex_to_rgb(colors["fg"])
    return {
        "repeatCell": {
            "range": _range_dict(sheet_id, row_0, row_0 + 1, 0, NUM_COLS),
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": bg,
                    "textFormat": {"foregroundColor": fg, "bold": True},
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat)",
        }
    }


def apply_row_color(
    spreadsheet: gspread.Spreadsheet,
    sheet_id: int,
    row_0: int,
    escuderia: str,
) -> None:
    """Colors a single data row (0-based) — useful for standalone calls."""
    colors = CONSTRUCTOR_COLORS.get(escuderia)
    if not colors:
        return
    spreadsheet.batch_update({"requests": [_color_row_request(sheet_id, row_0, colors)]})


# ── Write Equipos sheet ───────────────────────────────────────────────────────

def write_equipos_sheet(
    spreadsheet: gspread.Spreadsheet,
    f1_teams: list[dict],
    f2_teams: list[dict],
    existing_escuderias: dict[str, str],
) -> gspread.Worksheet:
    """
    Writes (or rewrites) the 'Equipos' sheet with F1 and F2 tables.

    Sheet layout (0-based row indices):
        0  : CATEGORIA F1 (merged, dark navy)
        1  : column headers (blue)
        2-9: 8 F1 team rows
        10 : blank
        11 : CATEGORIA F2 (merged, dark navy)
        12 : column headers (blue)
        13-20: 8 F2 team rows
    """
    # Restore saved Escudería choices from previous run
    for i, team in enumerate(f1_teams):
        team["escuderia"] = existing_escuderias.get(f"F1-{i + 1}", "")
    for i, team in enumerate(f2_teams):
        team["escuderia"] = existing_escuderias.get(f"F2-{i + 1}", "")

    # Get or create sheet
    try:
        ws  = spreadsheet.worksheet("Equipos")
        sid = ws.id
        # 1. Unmerge existing merges (required before clearing)
        spreadsheet.batch_update({"requests": [
            {"unmergeCells": {"range": _range_dict(sid, 0, 30, 0, 26)}},
            # 2. Reset ALL formatting in the used area (A1:Z30) to avoid stale styles
            _reset_format_request(sid, 0, 30, 0, 26),
        ]})
        # 3. Clear values — including stray content in columns beyond G
        ws.batch_clear(["A1:Z30"])
    except gspread.WorksheetNotFound:
        ws  = spreadsheet.add_worksheet(title="Equipos", rows=25, cols=NUM_COLS)
        sid = ws.id

    sid = ws.id

    # ── Row data ──────────────────────────────────────────────────────────────
    def _team_row(t: dict) -> list:
        return [
            t["pick_order"], t["team_num"],
            t["pilot1"],     t["best1"],
            t["pilot2"],     t["best2"],
            t["escuderia"],
        ]

    F1_CAT_ROW = 0
    F1_HDR_ROW = 1
    F1_START   = 2
    BLANK_ROW  = F1_START + TEAMS       # 10
    F2_CAT_ROW = BLANK_ROW + 1         # 11
    F2_HDR_ROW = F2_CAT_ROW + 1        # 12
    F2_START   = F2_HDR_ROW + 1        # 13

    rows_data: list[list] = []
    rows_data.append(["CATEGORIA F1"] + [""] * (NUM_COLS - 1))   # 0
    rows_data.append(COLUMNS)                                      # 1
    for t in f1_teams:
        rows_data.append(_team_row(t))                             # 2-9
    rows_data.append([""] * NUM_COLS)                              # 10 blank
    rows_data.append(["CATEGORIA F2"] + [""] * (NUM_COLS - 1))   # 11
    rows_data.append(COLUMNS)                                      # 12
    for t in f2_teams:
        rows_data.append(_team_row(t))                             # 13-20

    ws.update("A1", rows_data, value_input_option="USER_ENTERED")

    # ── Batch format requests ─────────────────────────────────────────────────
    requests: list[dict] = []

    # Category header rows (dark navy, white bold, large font)
    for r in (F1_CAT_ROW, F2_CAT_ROW):
        requests.append(_fmt_request(sid, r, r + 1, 0, NUM_COLS,
                                     bg=_NAV, fg=_WHT, bold=True,
                                     h_align="CENTER", font_size=12))

    # Column header rows (medium blue, white bold, centered)
    for r in (F1_HDR_ROW, F2_HDR_ROW):
        requests.append(_fmt_request(sid, r, r + 1, 0, NUM_COLS,
                                     bg=_BLU, fg=_WHT, bold=True, h_align="CENTER"))

    # Data rows — clean white background
    for start in (F1_START, F2_START):
        requests.append(_fmt_request(sid, start, start + TEAMS, 0, NUM_COLS,
                                     bg=_WHT, fg=_DRK))

    # Center numeric & time columns within data sections
    for start in (F1_START, F2_START):
        # Elección, Equipo #
        requests.append(_fmt_request(sid, start, start + TEAMS, 0, 2, h_align="CENTER"))
        # Mejor Tiempo P1, P2
        requests.append(_fmt_request(sid, start, start + TEAMS, 3, 4, h_align="CENTER"))
        requests.append(_fmt_request(sid, start, start + TEAMS, 5, 6, h_align="CENTER"))

    # Merge category header cells across all columns
    requests.append(_merge_request(sid, F1_CAT_ROW, F1_CAT_ROW + 1, 0, NUM_COLS))
    requests.append(_merge_request(sid, F2_CAT_ROW, F2_CAT_ROW + 1, 0, NUM_COLS))

    # Borders: thin solid grid on both data sections
    requests.append(_borders_request(sid, F1_START, F1_START + TEAMS, 0, NUM_COLS))
    requests.append(_borders_request(sid, F2_START, F2_START + TEAMS, 0, NUM_COLS))
    # Also border the header rows
    for r in (F1_HDR_ROW, F2_HDR_ROW):
        requests.append(_borders_request(sid, r, r + 1, 0, NUM_COLS))

    # Dropdown for Escudería column in both data sections
    requests.append(_dropdown_request(sid, F1_START, F1_START + TEAMS, NUM_COLS - 1))
    requests.append(_dropdown_request(sid, F2_START, F2_START + TEAMS, NUM_COLS - 1))

    # Freeze header rows (category + column headers)
    requests.append(_freeze_request(sid, rows=2))

    # Column widths
    requests += _col_width_requests(sid)

    spreadsheet.batch_update({"requests": requests})

    # Apply constructor row colors (batched in a single API call)
    color_requests = []
    for i, team in enumerate(f1_teams):
        if team["escuderia"] and team["escuderia"] in CONSTRUCTOR_COLORS:
            colors = CONSTRUCTOR_COLORS[team["escuderia"]]
            color_requests.append(_color_row_request(sid, F1_START + i, colors))
    for i, team in enumerate(f2_teams):
        if team["escuderia"] and team["escuderia"] in CONSTRUCTOR_COLORS:
            colors = CONSTRUCTOR_COLORS[team["escuderia"]]
            color_requests.append(_color_row_request(sid, F2_START + i, colors))
    if color_requests:
        spreadsheet.batch_update({"requests": color_requests})

    print(
        f"✅ Hoja 'Equipos' lista — "
        f"F1: {len(f1_teams)} equipos, F2: {len(f2_teams)} equipos"
    )
    return ws


# ── Seed Inscritos sheet ──────────────────────────────────────────────────────

# Confirmed mapping: inscribed display name → exact ranking name.
# Run with --seed to write this list to the Inscritos sheet.
INSCRITOS_SEED: list[tuple[str, str]] = [
    ("Nico E.",           "NICO E"),
    ("Adolfo I.",         "ADOLFO"),
    ("Javier V.",         "JAVIER V"),
    ("Cristobal I.",      "CRIS"),
    ("Daniel V.",         "PAJARITO"),
    ("Ilyan",             "ILYAN30F"),
    ("Vicente W.",        "WIDOW"),
    ("panchov",           "PANCHOV"),
    ("Javier M",          "JAVIER"),
    ("Consu",             "CONSUELO"),
    ("Diego E.",          "DIEGO EG"),
    ("Mike",              "MIKE"),
    ("Juanma S.",         "JUANMA"),
    ("Mihail P. (sikeze)", "SIKEZE"),
    ("Nano",              "NANUK"),
    ("Guille",            "BILLY"),
    ("Diego Garuti",      "GARUTI"),
    ("Juan C.",           "JUAN CAMPOS"),
    ("Alfredo",           "ALFRE"),
    ("Gianfranco",        "GIANFRANCO"),
    ("Jose B.",           "JOSEFA"),
    ("Stephy",            "STEPHY"),
    ("Nacho R.",          "IGNACIO R"),
    ("Israel M.",         "ISRAEL"),
    ("Giorgio",           "GIORGIO"),
    ("Seba R.",           "SEBA R"),
    ("Tomás V.",          "TOMÁS V"),
    ("Vicente S",         "VICENTE S"),
    ("Fernando S",        "FERNANDO"),
    ("Felipe M.",         "FELIPE"),
    ("Leo M.",            "LEO"),
]


def seed_inscritos_sheet(spreadsheet: gspread.Spreadsheet) -> None:
    """
    Populates the 'Inscritos' sheet with the confirmed pilot list.
    Columns: # | Piloto (ranking name) | Nombre Inscrito (display name)
    Safe to run multiple times — clears and rewrites data rows only.
    """
    ws = ensure_inscritos_sheet(spreadsheet)

    # Extend headers to 3 columns on first seed
    ws.update("A1:C1", [["#", "Piloto", "Nombre Inscrito"]])

    sid = ws.id
    spreadsheet.batch_update({"requests": [
        _fmt_request(sid, 0, 1, 0, 3, bg=_BLU, fg=_WHT, bold=True, h_align="CENTER"),
    ]})

    # Clear existing data rows and rewrite
    ws.batch_clear(["A2:C60"])

    rows = [
        [i + 1, ranking_name, display_name]
        for i, (display_name, ranking_name) in enumerate(INSCRITOS_SEED)
    ]
    ws.update("A2", rows, value_input_option="USER_ENTERED")

    print(f"✅ Hoja 'Inscritos' poblada con {len(rows)} pilotos.")
    print("   Columna 'Piloto' contiene el nombre exacto del ranking.")
    print("   Columna 'Nombre Inscrito' contiene el nombre tal como se inscribió.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Team Assignment Script")
    parser.add_argument(
        "--seed",
        action="store_true",
        help="Populate the Inscritos sheet with the confirmed 31-pilot list",
    )
    parser.add_argument(
        "--colors",
        action="store_true",
        help="Re-apply constructor row colors based on current Escudería selections (no rebuild)",
    )
    args = parser.parse_args()

    spreadsheet = _get_spreadsheet()

    if args.colors:
        print("🎨 Re-aplicando colores de escudería...")
        try:
            ws   = spreadsheet.worksheet("Equipos")
            sid  = ws.id
            existing = read_existing_escuderias(spreadsheet)
            if not existing:
                print("⚠️  No hay escuderías seleccionadas en la hoja 'Equipos'.")
                return
            F1_START_ROW = 2
            F2_START_ROW = 13
            color_requests = []
            for key, esc in existing.items():
                if esc not in CONSTRUCTOR_COLORS:
                    continue
                cat, idx = key.split("-")
                row_offset = int(idx) - 1
                row_0 = (F1_START_ROW if cat == "F1" else F2_START_ROW) + row_offset
                color_requests.append(_color_row_request(sid, row_0, CONSTRUCTOR_COLORS[esc]))
            if color_requests:
                spreadsheet.batch_update({"requests": color_requests})
                print(f"✅ {len(color_requests)} fila(s) coloreada(s).")
            else:
                print("⚠️  No se encontraron colores para aplicar.")
        except gspread.WorksheetNotFound:
            print("❌ Hoja 'Equipos' no encontrada. Corre el script sin --colors primero.")
        return

    if args.seed:
        seed_inscritos_sheet(spreadsheet)
        print("\n📋 Hoja 'Inscritos' lista. Puedes agregar/quitar pilotos manualmente.")
        print("   Luego corre: python team_assignment.py")
        return

    print("🏎  Team Assignment — iniciando...\n")

    # 1. Ensure Inscritos sheet exists
    ensure_inscritos_sheet(spreadsheet)

    # 2. Read data
    inscritos  = read_inscritos(spreadsheet)
    ranking_df = read_ranking(spreadsheet)

    if not inscritos:
        print(
            "\n⚠️  La hoja 'Inscritos' está vacía.\n"
            "   Agrega los nombres de los pilotos en la columna 'Piloto' y vuelve a ejecutar."
        )
        sys.exit(0)

    # 3. Preserve existing Escudería selections
    existing = read_existing_escuderias(spreadsheet)
    if existing:
        print(f"🔒 Conservando {len(existing)} selección(es) de escudería existente(s).")

    # 4. Build teams
    f1_teams, f2_teams = build_teams(inscritos, ranking_df)

    # 5. Write / update Equipos sheet
    write_equipos_sheet(spreadsheet, f1_teams, f2_teams, existing)

    # 6. Print summary to console
    print("\n📋 EQUIPOS F1:")
    for t in f1_teams:
        esc = t["escuderia"] or "(sin escudería)"
        print(
            f"  Elección {t['pick_order']:>2}: "
            f"{t['pilot1']:<20} ({t['best1']}s) ↔  "
            f"{t['pilot2']:<20} ({t['best2']}s)   [{esc}]"
        )

    print("\n📋 EQUIPOS F2:")
    for t in f2_teams:
        esc = t["escuderia"] or "(sin escudería)"
        print(
            f"  Elección {t['pick_order']:>2}: "
            f"{t['pilot1']:<20} ({t['best1']}s) ↔  "
            f"{t['pilot2']:<20} ({t['best2']}s)   [{esc}]"
        )

    print("\n✅ team_assignment.py completado.")


if __name__ == "__main__":
    main()
