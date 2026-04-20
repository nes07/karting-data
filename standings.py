#!/usr/bin/env python3
"""
standings.py
------------
Creates or rebuilds two championship standing sheets:
  - "Drivers Standings": renamed from "Resultados por Fecha", F1 + F2 sections
  - "Team Standings": auto-calculated via VLOOKUP formulas from Drivers Standings

Pilot and team data is read from the "Equipos" sheet (run team_assignment.py first).

Usage:
    python standings.py
"""

import gspread
from google.oauth2.service_account import Credentials


# ── Constants ─────────────────────────────────────────────────────────────────

SPREADSHEET_NAME   = "Mundial de Karting 2026"
EQUIPOS_SHEET      = "Equipos"
DS_SHEET           = "Drivers Standings"
TS_SHEET           = "Team Standings"
OLD_DS_NAME        = "Resultados por Fecha"   # rename if it exists

F1_MAX_PTS = 16   # P1 in F1 = 16 points (16 active pilots)
F2_MAX_PTS = 15   # P1 in F2 = 15 points (15 active pilots)

# ── Race calendar — edit dates here if needed ──────────────────────────────────
RACE_MONTHS = [
    "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre",
]
RACE_DATES = [
    "22/03/2026", "26/04/2026", "24/05/2026", "28/06/2026",
    "26/07/2026", "30/08/2026", "27/09/2026", "25/10/2026",
]
NUM_RACES = len(RACE_MONTHS)   # 8

# ── Drivers Standings column layout (0-indexed) ────────────────────────────────
# A=0:#  B=1:Piloto  C=2:PuntosTotal  D=3,E=4:Marzo  F=5,G=6:Abril  …  R=17,S=18:Octubre
DS_COLS = 3 + 2 * NUM_RACES   # 19 total columns

# 0-indexed col numbers for position/points of each race
def _ds_pos_col(race_idx: int) -> int:   return 3 + 2 * race_idx   # D=3, F=5, H=7 ...
def _ds_pts_col(race_idx: int) -> int:   return 4 + 2 * race_idx   # E=4, G=6, I=8 ...

# Column letters (1-indexed) → for formula strings
_COL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
def _col_letter(col_0idx: int) -> str:
    return _COL_LETTERS[col_0idx]

# ── Team Standings column layout (0-indexed) ──────────────────────────────────
# A=0:#  B=1:Equipo  C=2:Escudería  D=3:Piloto1  E=4:Piloto2  F=5:PuntosTotal
# G=6:Marzo  H=7:Abril  …  N=13:Octubre
TS_COLS = 6 + NUM_RACES   # 14 total columns

# ── Row indices (0-based) for each section ─────────────────────────────────────
# Drivers Standings:
DS_F1_CAT   = 0    # "NUEVA ERA — F1"  (row 1)
DS_F1_MONTH = 1    # month sub-headers (row 2)
DS_F1_HDR   = 2    # column labels     (row 3)
DS_F1_START = 3    # first F1 pilot    (row 4)
DS_F1_END   = 18   # last  F1 pilot    (row 19), inclusive
DS_BLANK    = 19   # blank spacer      (row 20)
DS_F2_CAT   = 20   # "ERA ANTIGUA — F2"(row 21)
DS_F2_MONTH = 21   # month sub-headers (row 22)
DS_F2_HDR   = 22   # column labels     (row 23)
DS_F2_START = 23   # first F2 pilot    (row 24)
DS_F2_END   = 38   # last  F2 pilot    (row 39), inclusive (15 + TBD = 16)

DS_TOTAL_ROWS = DS_F2_END + 1   # 39

# 1-indexed versions used in formulas / VLOOKUP ranges
DS_F1_START_1 = DS_F1_START + 1   # 4
DS_F1_END_1   = DS_F1_END   + 1   # 19
DS_F2_START_1 = DS_F2_START + 1   # 24
DS_F2_END_1   = DS_F2_END   + 1   # 39

# Team Standings:
TS_F1_CAT   = 0
TS_F1_HDR   = 1
TS_F1_START = 2
TS_F1_END   = 9    # 8 F1 teams
TS_BLANK    = 10
TS_F2_CAT   = 11
TS_F2_HDR   = 12
TS_F2_START = 13
TS_F2_END   = 20   # 8 F2 teams

TS_TOTAL_ROWS = TS_F2_END + 1   # 21

# ── Style colors (shared with team_assignment.py) ──────────────────────────────
_NAV = {"red": 0.102, "green": 0.227, "blue": 0.361}   # #1A3A5C  category
_BLU = {"red": 0.176, "green": 0.322, "blue": 0.471}   # #2D5278  header
_WHT = {"red": 1.0,   "green": 1.0,   "blue": 1.0}
_DRK = {"red": 0.133, "green": 0.133, "blue": 0.133}
_GLD = {"red": 1.0,   "green": 0.843, "blue": 0.0}     # #FFD700  1st
_YLW = {"red": 1.0,   "green": 0.949, "blue": 0.0}     # #F2F200  2nd
_BRZ = {"red": 0.804, "green": 0.498, "blue": 0.196}   # #CD7F32  3rd
_LGY = {"red": 0.953, "green": 0.953, "blue": 0.953}   # #F3F3F3  alt row
_MGY = {"red": 0.850, "green": 0.850, "blue": 0.850}   # #D9D9D9  month header


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

def _rd(sid: int, r0: int, r1: int, c0: int, c1: int) -> dict:
    return {
        "sheetId": sid, "startRowIndex": r0, "endRowIndex": r1,
        "startColumnIndex": c0, "endColumnIndex": c1,
    }


def _fmt(sid: int, r0: int, r1: int, c0: int, c1: int,
         bg=None, fg=None, bold: bool = False,
         h_align: str | None = None, font_size: int | None = None,
         italic: bool = False) -> dict:
    fmt, fields = {}, []
    if bg is not None:
        fmt["backgroundColor"] = bg
        fields.append("backgroundColor")
    tf = {}
    if fg   is not None: tf["foregroundColor"] = fg
    if bold:             tf["bold"] = True
    if italic:           tf["italic"] = True
    if font_size:        tf["fontSize"] = font_size
    if tf:
        fmt["textFormat"] = tf
        fields.append("textFormat")
    if h_align:
        fmt["horizontalAlignment"] = h_align
        fields.append("horizontalAlignment")
    return {
        "repeatCell": {
            "range":  _rd(sid, r0, r1, c0, c1),
            "cell":   {"userEnteredFormat": fmt},
            "fields": "userEnteredFormat(" + ",".join(fields) + ")",
        }
    }


def _merge(sid: int, r0: int, r1: int, c0: int, c1: int) -> dict:
    return {"mergeCells": {"range": _rd(sid, r0, r1, c0, c1), "mergeType": "MERGE_ALL"}}


def _unmerge(sid: int, r0: int, r1: int, c0: int, c1: int) -> dict:
    return {"unmergeCells": {"range": _rd(sid, r0, r1, c0, c1)}}


def _write_grid(spreadsheet: gspread.Spreadsheet, ws: gspread.Worksheet,
                grid: list[list]) -> None:
    """
    Writes a 2D grid of values using the raw updateCells API.

    Formulas (strings starting with '=') are written as formulaValue — this
    always uses English/comma syntax, bypassing the spreadsheet's locale setting
    (which would otherwise require semicolons in Spanish-locale sheets).
    Numbers are written as numberValue, text as stringValue.
    """
    def _cell(value) -> dict:
        if isinstance(value, str) and value.startswith("="):
            return {"userEnteredValue": {"formulaValue": value}}
        if isinstance(value, bool):
            return {"userEnteredValue": {"boolValue": value}}
        if isinstance(value, (int, float)):
            return {"userEnteredValue": {"numberValue": float(value)}}
        if isinstance(value, str) and value:
            return {"userEnteredValue": {"stringValue": value}}
        return {"userEnteredValue": {}}  # empty cell

    rows_data = [{"values": [_cell(v) for v in row]} for row in grid]
    spreadsheet.batch_update({"requests": [{
        "updateCells": {
            "range": {
                "sheetId":          ws.id,
                "startRowIndex":    0,
                "startColumnIndex": 0,
            },
            "rows":   rows_data,
            "fields": "userEnteredValue",
        }
    }]})


def _reset_fmt(sid: int, r0: int, r1: int, c0: int, c1: int) -> dict:
    return {
        "repeatCell": {
            "range":  _rd(sid, r0, r1, c0, c1),
            "cell":   {"userEnteredFormat": {}},
            "fields": "userEnteredFormat",
        }
    }


def _border(sid: int, r0: int, r1: int, c0: int, c1: int,
            color: dict | None = None) -> dict:
    c = color or {"red": 0.75, "green": 0.75, "blue": 0.75}
    b = {"style": "SOLID", "color": c}
    return {
        "updateBorders": {
            "range": _rd(sid, r0, r1, c0, c1),
            "top": b, "bottom": b, "left": b, "right": b,
            "innerHorizontal": b, "innerVertical": b,
        }
    }


def _col_width(sid: int, col: int, px: int) -> dict:
    return {
        "updateDimensionProperties": {
            "range": {"sheetId": sid, "dimension": "COLUMNS",
                      "startIndex": col, "endIndex": col + 1},
            "properties": {"pixelSize": px}, "fields": "pixelSize",
        }
    }


def _row_height(sid: int, row: int, px: int) -> dict:
    return {
        "updateDimensionProperties": {
            "range": {"sheetId": sid, "dimension": "ROWS",
                      "startIndex": row, "endIndex": row + 1},
            "properties": {"pixelSize": px}, "fields": "pixelSize",
        }
    }


def _freeze(sid: int, rows: int = 0, cols: int = 0) -> dict:
    return {
        "updateSheetProperties": {
            "properties": {
                "sheetId": sid,
                "gridProperties": {
                    "frozenRowCount": rows,
                    "frozenColumnCount": cols,
                },
            },
            "fields": "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
        }
    }


def _cond_format(sid: int, r0: int, r1: int, c0: int, c1: int,
                 value: int, bg: dict) -> dict:
    """Adds a NUMBER_EQ conditional formatting rule."""
    return {
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [_rd(sid, r0, r1, c0, c1)],
                "booleanRule": {
                    "condition": {
                        "type": "NUMBER_EQ",
                        "values": [{"userEnteredValue": str(value)}],
                    },
                    "format": {"backgroundColor": bg},
                },
            },
            "index": 0,
        }
    }


# ── Read Equipos sheet ────────────────────────────────────────────────────────

def read_equipos(spreadsheet: gspread.Spreadsheet):
    """
    Returns (f1_pilots, f2_pilots, f1_teams, f2_teams).
    Pilots are ordered by ranking (best → worst).
    Teams are dicts: {pick, pilot1, pilot2, escuderia}.

    Section detection is done by spotting the "Elección" column-header row
    (first occurrence = F1 section, second = F2), so it works regardless of
    whatever text is used in the category merged-header row.
    """
    ws   = spreadsheet.worksheet(EQUIPOS_SHEET)
    rows = ws.get_all_values()

    f1_raw, f2_raw = [], []
    sections_found = 0   # increments each time we see an "Elección" header row

    _HDR_MARKERS = {"elección", "eleccion", "elecciã³n", "elecció"}

    for row in rows:
        if not row:
            continue
        col_a = row[0].strip()

        # Detect the column-header row by matching "Elección" (case-insensitive)
        if col_a.lower().replace("\u00f3", "o") in _HDR_MARKERS or col_a == "Elección":
            sections_found += 1
            continue

        # Skip blank rows and non-data rows (category merged headers, etc.)
        if not any(c.strip() for c in row):
            continue
        if sections_found == 0:
            continue   # above first section header

        # Data row: col A = pick order (1-based number)
        try:
            pick = int(float(col_a)) if col_a else 0
        except (ValueError, TypeError):
            continue
        if pick == 0 or len(row) < 5:
            continue

        data = {
            "pick":      pick,
            "pilot1":    row[2].strip(),
            "pilot2":    row[4].strip(),
            "escuderia": row[6].strip() if len(row) > 6 else "",
        }
        if sections_found == 1:
            f1_raw.append(data)
        else:
            f2_raw.append(data)

    def _ordered_pilots(teams: list) -> list[str]:
        s = sorted(teams, key=lambda t: t["pick"])
        # Rank 1-8 = pilot1 of each team (in pick order)
        # Rank 9-16 = pilot2 in reverse pick order (8→1)
        return [t["pilot1"] for t in s] + [t["pilot2"] for t in reversed(s)]

    f1_pilots = _ordered_pilots(f1_raw)
    f2_pilots = _ordered_pilots(f2_raw)

    return f1_pilots, f2_pilots, sorted(f1_raw, key=lambda t: t["pick"]), \
           sorted(f2_raw, key=lambda t: t["pick"])


# ── Build Drivers Standings ───────────────────────────────────────────────────

def _ds_pts_formula(pos_cell: str, max_pts: int) -> str:
    return f'=IF({pos_cell}="","",MAX(0,{max_pts + 1}-{pos_cell}))'


def _ds_total_formula(row_1: int) -> str:
    pts_cols = [_col_letter(_ds_pts_col(i)) for i in range(NUM_RACES)]
    cells = ",".join(f"{c}{row_1}" for c in pts_cols)
    return f"=SUM({cells})"


def build_drivers_standings(
    spreadsheet: gspread.Spreadsheet,
    f1_pilots: list[str],
    f2_pilots: list[str],
) -> gspread.Worksheet:
    """
    Renames/recreates "Drivers Standings" with F1 and F2 sections.
    Posición cells are plain input; Puntos cells contain auto-calc formulas.
    """
    # ── Get or rename sheet ───────────────────────────────────────────────────
    ws = None
    try:
        ws = spreadsheet.worksheet(DS_SHEET)
    except gspread.WorksheetNotFound:
        try:
            old = spreadsheet.worksheet(OLD_DS_NAME)
            old.update_title(DS_SHEET)
            ws = old
            print(f'  Renamed "{OLD_DS_NAME}" → "{DS_SHEET}"')
        except gspread.WorksheetNotFound:
            pass

    if ws is None:
        ws = spreadsheet.add_worksheet(DS_SHEET, rows=DS_TOTAL_ROWS + 5, cols=DS_COLS)
        print(f'  Created new sheet "{DS_SHEET}"')

    sid = ws.id

    # ── Clear all existing content + formatting ───────────────────────────────
    # Unfreeze first — merging across frozen/non-frozen boundaries is rejected by the API.
    spreadsheet.batch_update({"requests": [_freeze(sid, rows=0, cols=0)]})
    spreadsheet.batch_update({"requests": [
        _unmerge(sid, 0, DS_TOTAL_ROWS + 5, 0, DS_COLS + 5),
        _reset_fmt(sid, 0, DS_TOTAL_ROWS + 5, 0, DS_COLS + 5),
    ]})
    ws.batch_clear([f"A1:{_col_letter(DS_COLS - 1)}{DS_TOTAL_ROWS + 5}"])

    # ── Build row data ────────────────────────────────────────────────────────
    def _month_header_row() -> list:
        row = ["", "", ""]
        for m, d in zip(RACE_MONTHS, RACE_DATES):
            row += [f"{m}\n{d}", ""]
        return row

    def _col_label_row() -> list:
        row = ["#", "Piloto", "Puntos Totales"]
        for _ in RACE_MONTHS:
            row += ["Posición", "Puntos"]
        return row

    def _pilot_rows(pilots: list[str], max_pts: int, start_row_1: int) -> list[list]:
        rows = []
        for i, name in enumerate(pilots):
            r = start_row_1 + i
            row: list = [i + 1, name, _ds_total_formula(r)]
            for ri in range(NUM_RACES):
                pos_col = _col_letter(_ds_pos_col(ri))
                pos_cell = f"{pos_col}{r}"
                row.append("")                              # Posición (manual input)
                row.append(_ds_pts_formula(pos_cell, max_pts))  # Puntos (formula)
            rows.append(row)
        return rows

    all_rows: list[list] = [None] * DS_TOTAL_ROWS
    all_rows[DS_F1_CAT]   = ["NUEVA ERA — F1"] + [""] * (DS_COLS - 1)
    all_rows[DS_F1_MONTH] = _month_header_row()
    all_rows[DS_F1_HDR]   = _col_label_row()

    f1_data = _pilot_rows(f1_pilots, F1_MAX_PTS, DS_F1_START_1)
    for i, row in enumerate(f1_data):
        all_rows[DS_F1_START + i] = row

    # Fill remaining F1 slots if fewer than 16 pilots
    for i in range(len(f1_data), DS_F1_END - DS_F1_START + 1):
        all_rows[DS_F1_START + i] = [""] * DS_COLS

    all_rows[DS_BLANK]    = [""] * DS_COLS
    all_rows[DS_F2_CAT]   = ["ERA ANTIGUA — F2"] + [""] * (DS_COLS - 1)
    all_rows[DS_F2_MONTH] = _month_header_row()
    all_rows[DS_F2_HDR]   = _col_label_row()

    f2_data = _pilot_rows(f2_pilots, F2_MAX_PTS, DS_F2_START_1)
    for i, row in enumerate(f2_data):
        all_rows[DS_F2_START + i] = row

    for i in range(len(f2_data), DS_F2_END - DS_F2_START + 1):
        all_rows[DS_F2_START + i] = [""] * DS_COLS

    _write_grid(spreadsheet, ws, all_rows)

    # ── Batch formatting ──────────────────────────────────────────────────────
    reqs: list[dict] = []

    for cat_row in (DS_F1_CAT, DS_F2_CAT):
        reqs.append(_fmt(sid, cat_row, cat_row + 1, 0, DS_COLS,
                         bg=_NAV, fg=_WHT, bold=True, h_align="CENTER", font_size=13))
        reqs.append(_merge(sid, cat_row, cat_row + 1, 0, DS_COLS))

    # Month sub-header rows (light gray, bold, centered; merge each Pos+Pts pair)
    for mhdr_row in (DS_F1_MONTH, DS_F2_MONTH):
        reqs.append(_fmt(sid, mhdr_row, mhdr_row + 1, 0, DS_COLS,
                         bg=_MGY, fg=_DRK, bold=True, h_align="CENTER"))
        for ri in range(NUM_RACES):
            c0 = _ds_pos_col(ri)
            reqs.append(_merge(sid, mhdr_row, mhdr_row + 1, c0, c0 + 2))

    # Column label rows
    for hdr_row in (DS_F1_HDR, DS_F2_HDR):
        reqs.append(_fmt(sid, hdr_row, hdr_row + 1, 0, DS_COLS,
                         bg=_BLU, fg=_WHT, bold=True, h_align="CENTER"))

    # Data rows: alternate white / light gray
    for section_start, section_end in (
        (DS_F1_START, DS_F1_END),
        (DS_F2_START, DS_F2_END),
    ):
        for r in range(section_start, section_end + 1):
            bg = _WHT if (r - section_start) % 2 == 0 else _LGY
            reqs.append(_fmt(sid, r, r + 1, 0, DS_COLS, bg=bg, fg=_DRK))

        # Center numeric columns: #, Puntos Totales, all Pos+Pts pairs
        reqs.append(_fmt(sid, section_start, section_end + 1, 0, 1, h_align="CENTER"))   # #
        reqs.append(_fmt(sid, section_start, section_end + 1, 2, 3, h_align="CENTER"))   # Totales
        for ri in range(NUM_RACES):
            c0 = _ds_pos_col(ri)
            reqs.append(_fmt(sid, section_start, section_end + 1, c0, c0 + 2, h_align="CENTER"))

        # Borders around data area
        reqs.append(_border(sid, section_start, section_end + 1, 0, DS_COLS))

    # Conditional formatting: gold/yellow/bronze on Posición cells
    for section_start, section_end in (
        (DS_F1_START, DS_F1_END), (DS_F2_START, DS_F2_END)
    ):
        for ri in range(NUM_RACES):
            pc = _ds_pos_col(ri)
            for rank, color in ((1, _GLD), (2, _YLW), (3, _BRZ)):
                reqs.append(_cond_format(sid, section_start, section_end + 1, pc, pc + 1, rank, color))

    # Column widths
    reqs.append(_col_width(sid, 0, 40))    # #
    reqs.append(_col_width(sid, 1, 160))   # Piloto
    reqs.append(_col_width(sid, 2, 110))   # Puntos Totales
    for ri in range(NUM_RACES):
        reqs.append(_col_width(sid, _ds_pos_col(ri), 65))   # Posición
        reqs.append(_col_width(sid, _ds_pts_col(ri), 55))   # Puntos

    # Row heights: month sub-headers taller for two-line text
    for mhdr_row in (DS_F1_MONTH, DS_F2_MONTH):
        reqs.append(_row_height(sid, mhdr_row, 40))

    # Freeze top 3 rows of F1 section
    reqs.append(_freeze(sid, rows=DS_F1_HDR + 1))   # freeze rows 1-3

    spreadsheet.batch_update({"requests": reqs})

    print(f'  "{DS_SHEET}" built — {len(f1_pilots)} F1 pilots, {len(f2_pilots)} F2 pilots')
    return ws


# ── Build Team Standings ──────────────────────────────────────────────────────

def _ts_race_formula(
    p1_cell: str, p2_cell: str,
    ds_range: str,   # e.g. "'Drivers Standings'!$B$4:$S$19"
    offset: int,     # BUSCARV column offset from col B in DS
    month: str,      # e.g. "Marzo" — used to filter Suplentes sheet
    esc_cell: str,   # Escudería cell, e.g. "C3" — matches Suplentes!$B
) -> str:
    """
    Points for a team in one race = pilot1 pts + pilot2 pts + suplente pts.
    Uses Spanish locale syntax (SI.ERROR, BUSCARV, SUMAPRODUCTO, semicolons).
    Written via USER_ENTERED so locale is respected.
    """
    # Suplentes data starts at row 3, ends at row 3+_SUP_TEMPLATE_ROWS-1 = 32.
    # Use explicit range (not full column) to exclude the text header row.
    _sup_last = 2 + _SUP_TEMPLATE_ROWS   # = 32
    return (
        f"=SI.ERROR(BUSCARV({p1_cell};{ds_range};{offset};FALSO);0)"
        f"+SI.ERROR(BUSCARV({p2_cell};{ds_range};{offset};FALSO);0)"
        f'+SUMAPRODUCTO((Suplentes!$A$3:$A${_sup_last}="{month}")'
        f'*(Suplentes!$B$3:$B${_sup_last}={esc_cell})'
        f'*Suplentes!$F$3:$F${_sup_last})'
    )


def build_team_standings(
    spreadsheet: gspread.Spreadsheet,
    f1_teams: list[dict],
    f2_teams: list[dict],
) -> gspread.Worksheet:
    """
    Creates or rebuilds "Team Standings" with VLOOKUP formulas pointing to
    Drivers Standings.  Values auto-update whenever Drivers Standings changes.
    """
    try:
        ws = spreadsheet.worksheet(TS_SHEET)
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(TS_SHEET, rows=TS_TOTAL_ROWS + 5, cols=TS_COLS)
        print(f'  Created new sheet "{TS_SHEET}"')

    sid = ws.id

    # Clear — unfreeze first to avoid merge/freeze boundary errors
    spreadsheet.batch_update({"requests": [_freeze(sid, rows=0, cols=0)]})
    spreadsheet.batch_update({"requests": [
        _unmerge(sid, 0, TS_TOTAL_ROWS + 5, 0, TS_COLS + 5),
        _reset_fmt(sid, 0, TS_TOTAL_ROWS + 5, 0, TS_COLS + 5),
    ]})
    ws.batch_clear([f"A1:{_col_letter(TS_COLS - 1)}{TS_TOTAL_ROWS + 5}"])

    # ── VLOOKUP range strings ─────────────────────────────────────────────────
    ds = DS_SHEET
    f1_rng_full = f"'{ds}'!$B${DS_F1_START_1}:$S${DS_F1_END_1}"
    f2_rng_full = f"'{ds}'!$B${DS_F2_START_1}:$S${DS_F2_END_1}"

    # TS race columns: G=6 … N=13  (6 + NUM_RACES - 1 = 13 for 8 races)
    _race_start_letter = _col_letter(6)
    _race_end_letter   = _col_letter(6 + NUM_RACES - 1)

    def _total_formula(r: int) -> str:
        """SUMA of all per-race TS columns — automatically includes suplente points."""
        return f"=SUMA({_race_start_letter}{r}:{_race_end_letter}{r})"

    # ── Build row data ────────────────────────────────────────────────────────
    def _team_rows(teams: list[dict], rng_full: str, data_start_0: int) -> list[list]:
        rows = []
        for i, team in enumerate(teams):
            r   = data_start_0 + i + 1   # 1-indexed sheet row
            p1  = f"D{r}"                # Piloto 1 cell
            p2  = f"E{r}"                # Piloto 2 cell
            esc = f"C{r}"                # Escudería cell (used for Suplentes lookup)

            race_formulas = []
            for ri, month in enumerate(RACE_MONTHS):
                offset = 4 + 2 * ri    # E=4, G=6, I=8, K=10, M=12, O=14, Q=16, S=18
                race_formulas.append(
                    _ts_race_formula(p1, p2, rng_full, offset, month, esc)
                )

            row = [
                i + 1,                   # #
                f"Equipo {team['pick']}", # Equipo
                team["escuderia"],        # Escudería
                team["pilot1"],           # Piloto 1
                team["pilot2"],           # Piloto 2
                _total_formula(r),        # Puntos Totales = SUM of race cols (incl. suplentes)
            ] + race_formulas

            rows.append(row)
        return rows

    col_hdr = (
        ["#", "Equipo", "Escudería", "Piloto 1", "Piloto 2", "Puntos Totales"]
        + RACE_MONTHS
    )

    all_rows: list[list] = [None] * TS_TOTAL_ROWS
    all_rows[TS_F1_CAT]   = ["NUEVA ERA — F1"] + [""] * (TS_COLS - 1)
    all_rows[TS_F1_HDR]   = col_hdr
    f1_rows = _team_rows(f1_teams, f1_rng_full, TS_F1_START)
    for i, row in enumerate(f1_rows):
        all_rows[TS_F1_START + i] = row
    for i in range(len(f1_rows), TS_F1_END - TS_F1_START + 1):
        all_rows[TS_F1_START + i] = [""] * TS_COLS

    all_rows[TS_BLANK]  = [""] * TS_COLS
    all_rows[TS_F2_CAT] = ["ERA ANTIGUA — F2"] + [""] * (TS_COLS - 1)
    all_rows[TS_F2_HDR] = col_hdr
    f2_rows = _team_rows(f2_teams, f2_rng_full, TS_F2_START)
    for i, row in enumerate(f2_rows):
        all_rows[TS_F2_START + i] = row
    for i in range(len(f2_rows), TS_F2_END - TS_F2_START + 1):
        all_rows[TS_F2_START + i] = [""] * TS_COLS

    # Use USER_ENTERED so Spanish function names (SI.ERROR, BUSCARV, SUMAPRODUCTO)
    # and semicolon separators are parsed correctly by the Spanish-locale spreadsheet.
    ws.update(range_name="A1", values=all_rows, value_input_option="USER_ENTERED")

    # ── Batch formatting ──────────────────────────────────────────────────────
    reqs: list[dict] = []

    for cat_row in (TS_F1_CAT, TS_F2_CAT):
        reqs.append(_fmt(sid, cat_row, cat_row + 1, 0, TS_COLS,
                         bg=_NAV, fg=_WHT, bold=True, h_align="CENTER", font_size=13))
        reqs.append(_merge(sid, cat_row, cat_row + 1, 0, TS_COLS))

    for hdr_row in (TS_F1_HDR, TS_F2_HDR):
        reqs.append(_fmt(sid, hdr_row, hdr_row + 1, 0, TS_COLS,
                         bg=_BLU, fg=_WHT, bold=True, h_align="CENTER"))

    for section_start, section_end in (
        (TS_F1_START, TS_F1_END), (TS_F2_START, TS_F2_END)
    ):
        for r in range(section_start, section_end + 1):
            bg = _WHT if (r - section_start) % 2 == 0 else _LGY
            reqs.append(_fmt(sid, r, r + 1, 0, TS_COLS, bg=bg, fg=_DRK))

        # Center all columns except Piloto names (D=3, E=4)
        reqs.append(_fmt(sid, section_start, section_end + 1, 0, 3,  h_align="CENTER"))  # #,Equipo,Esc
        reqs.append(_fmt(sid, section_start, section_end + 1, 5, TS_COLS, h_align="CENTER"))  # Pts+races
        reqs.append(_fmt(sid, section_start, section_end + 1, 5, 6,  bold=True))  # Puntos Totales bold

        reqs.append(_border(sid, section_start, section_end + 1, 0, TS_COLS))

    # Column widths
    widths = [40, 90, 130, 160, 160, 110] + [75] * NUM_RACES
    for col, px in enumerate(widths):
        reqs.append(_col_width(sid, col, px))

    reqs.append(_freeze(sid, rows=TS_F1_HDR + 1))

    spreadsheet.batch_update({"requests": reqs})

    print(f'  "{TS_SHEET}" built — {len(f1_teams)} F1 teams, {len(f2_teams)} F2 teams')
    return ws


# ── Add tiebreaker (Pos Promedio) columns ────────────────────────────────────

def add_tiebreaker_columns(spreadsheet: gspread.Spreadsheet) -> None:
    """
    Writes helper columns for tiebreaking — does NOT touch any other cell.

    Drivers Standings — column T:
      =SI.ERROR(PROMEDIO(D{r};F{r};H{r};J{r};L{r};N{r};P{r};R{r});"")
      Rows 4–19 (F1) and 24–39 (F2)

    Team Standings — column O:
      =SI.ERROR(PROMEDIO(SI.ERROR(BUSCARV(D{r};DS!$B$4:$T$19;19;FALSO);"");
                         SI.ERROR(BUSCARV(E{r};DS!$B$4:$T$19;19;FALSO);""));"")
      Rows 3–10 (F1 teams) and 14–21 (F2 teams)
    """
    # ── Drivers Standings column T ────────────────────────────────────────────
    ds = spreadsheet.worksheet(DS_SHEET)
    ds_sid = ds.id

    # Posición cells: D,F,H,J,L,N,P,R (cols 4,6,8,10,12,14,16,18 — 1-indexed)
    pos_letters = [_col_letter(3), _col_letter(5), _col_letter(7), _col_letter(9),
                   _col_letter(11), _col_letter(13), _col_letter(15), _col_letter(17)]

    def _promedio_formula(r: int) -> str:
        cells = ";".join(f"{c}{r}" for c in pos_letters)
        return f'=SI.ERROR(PROMEDIO({cells});"")'

    ds_updates = []
    for r in list(range(DS_F1_START_1, DS_F1_END_1 + 1)) + \
              list(range(DS_F2_START_1, DS_F2_END_1 + 1)):
        ds_updates.append({
            "range": f"T{r}",
            "values": [[_promedio_formula(r)]],
        })

    ds.batch_update(ds_updates, value_input_option="USER_ENTERED")
    print(f'  Columna T (Pos Promedio) escrita en "{DS_SHEET}" — '
          f'{len(ds_updates)} filas')

    # ── Column U: Best lap time on OFFICIAL RACE DATES only — 3rd tiebreaker ──
    # F1 = Carrera 2, F2 = Carrera 1 on official dates from "Fecha de Carreras".
    # Computed in Python (static values) so no locale formula issues.
    TIEMPOS_SHEET = "Tiempos 2026"

    def _normalize_date(d: str) -> str:
        """Normalize DD/MM/YYYY → always zero-padded, e.g. 6/12/2026 → 06/12/2026"""
        parts = d.strip().split("/")
        if len(parts) == 3:
            return f"{int(parts[0]):02d}/{int(parts[1]):02d}/{parts[2]}"
        return d.strip()

    # 1. Official race dates
    fc_ws = spreadsheet.worksheet("Fecha de Carreras")
    fc_rows = fc_ws.get_all_values()
    official_dates: set[str] = set()
    for row in fc_rows[1:]:          # skip blank header row
        if len(row) >= 3 and row[2]:
            official_dates.add(_normalize_date(row[2]))

    # 2. Map: date → (f2_col_0idx, f1_col_0idx) in Tiempos 2026
    #    Row 2 (index 1) = dates at the first column of each pair (Carrera 1).
    #    Carrera 2 = that column + 1.
    t2026 = spreadsheet.worksheet(TIEMPOS_SHEET)
    date_row = t2026.row_values(2)   # 1-indexed row 2
    date_to_f2_col: dict[str, int] = {}   # Carrera 1 col (0-indexed)
    date_to_f1_col: dict[str, int] = {}   # Carrera 2 col (0-indexed)
    for i, cell in enumerate(date_row):
        if cell:
            nd = _normalize_date(cell)
            if nd in official_dates:
                date_to_f2_col[nd] = i      # Carrera 1 = this col
                date_to_f1_col[nd] = i + 1  # Carrera 2 = next col

    print(f"    Official dates found in Tiempos 2026: {sorted(date_to_f1_col)}")

    # 3. Read all pilot data from Tiempos 2026 (rows 4+, pilot name at col 2 0-idx)
    all_t = t2026.get_all_values()
    pilot_name_col = 2   # 0-indexed column C = "Pilotos"
    data_start = 3       # row index 3 = row 4

    f1_cols_idx = sorted(date_to_f1_col.values())
    f2_cols_idx = sorted(date_to_f2_col.values())

    def _min_from_cols(row_vals: list[str], cols: list[int]) -> float:
        times = []
        for c in cols:
            if c < len(row_vals) and row_vals[c].strip():
                try:
                    times.append(float(row_vals[c]))
                except ValueError:
                    pass
        return min(times) if times else 999.0

    pilot_f1_best: dict[str, float] = {}
    pilot_f2_best: dict[str, float] = {}
    for row in all_t[data_start:]:
        if not row or not row[pilot_name_col].strip():
            continue
        name = row[pilot_name_col].strip()
        pilot_f1_best[name] = _min_from_cols(row, f1_cols_idx)
        pilot_f2_best[name] = _min_from_cols(row, f2_cols_idx)

    # 4. Read Drivers Standings to get pilot names per row, then write values
    ds_vals = ds.get_all_values()

    # Expand DS columns if needed (U = 21st col, 0-idx=20)
    if ds.col_count < 21:
        spreadsheet.batch_update({"requests": [{
            "appendDimension": {
                "sheetId": ds_sid,
                "dimension": "COLUMNS",
                "length": 21 - ds.col_count,
            }
        }]})
        ds = spreadsheet.worksheet(DS_SHEET)
        ds_sid = ds.id

    u_updates = []
    for r in range(DS_F1_START_1, DS_F1_END_1 + 1):   # F1 pilots → Carrera 2
        pilot_name = ds_vals[r - 1][1].strip() if len(ds_vals) >= r else ""
        best = pilot_f1_best.get(pilot_name, 999.0)
        u_updates.append({"range": f"U{r}", "values": [[best]]})

    for r in range(DS_F2_START_1, DS_F2_END_1 + 1):   # F2 pilots → Carrera 1
        pilot_name = ds_vals[r - 1][1].strip() if len(ds_vals) >= r else ""
        best = pilot_f2_best.get(pilot_name, 999.0)
        u_updates.append({"range": f"U{r}", "values": [[best]]})

    ds.batch_update(u_updates, value_input_option="RAW")
    print(f'  Columna U (Mejor Tiempo carrera oficial) escrita en "{DS_SHEET}" — '
          f'{len(u_updates)} filas')

    # Format both T and U together
    fmt_reqs = [
        _fmt(ds_sid, DS_F1_START - 1, DS_F1_END + 1,
             19, 21,
             fg={"red": 0.6, "green": 0.6, "blue": 0.6},
             h_align="CENTER", font_size=8, italic=True),
        _fmt(ds_sid, DS_F2_START - 1, DS_F2_END + 1,
             19, 21,
             fg={"red": 0.6, "green": 0.6, "blue": 0.6},
             h_align="CENTER", font_size=8, italic=True),
        _col_width(ds_sid, 19, 70),   # column T narrow
        _col_width(ds_sid, 20, 75),   # column U narrow
    ]
    spreadsheet.batch_update({"requests": fmt_reqs})
    ds.update(range_name="T3",  values=[["Pos Prom"]], value_input_option="RAW")
    ds.update(range_name="T23", values=[["Pos Prom"]], value_input_option="RAW")
    ds.update(range_name="U3",  values=[["Mejor T"]], value_input_option="RAW")
    ds.update(range_name="U23", values=[["Mejor T"]], value_input_option="RAW")

    # ── Team Standings column O ───────────────────────────────────────────────
    ts = spreadsheet.worksheet(TS_SHEET)
    ts_sid = ts.id

    # Expand the grid if needed so column O (15th) exists
    if ts.col_count < 15:
        spreadsheet.batch_update({"requests": [{
            "appendDimension": {
                "sheetId": ts_sid,
                "dimension": "COLUMNS",
                "length": 15 - ts.col_count,
            }
        }]})
        ts = spreadsheet.worksheet(TS_SHEET)  # refresh
    if ts.row_count < 26:
        spreadsheet.batch_update({"requests": [{
            "appendDimension": {
                "sheetId": ts_sid,
                "dimension": "ROWS",
                "length": 26 - ts.row_count,
            }
        }]})
        ts = spreadsheet.worksheet(TS_SHEET)  # refresh

    f1_ds_range = f"'Drivers Standings'!$B${DS_F1_START_1}:$T${DS_F1_END_1}"
    f2_ds_range = f"'Drivers Standings'!$B${DS_F2_START_1}:$T${DS_F2_END_1}"

    def _team_prom(r: int, ds_range: str) -> str:
        # Offset 19 = column T in the B:T range (T is the 19th col from B)
        p1 = f"D{r}"
        p2 = f"E{r}"
        return (
            f'=SI.ERROR(PROMEDIO('
            f'SI.ERROR(BUSCARV({p1};{ds_range};19;FALSO);"");'
            f'SI.ERROR(BUSCARV({p2};{ds_range};19;FALSO);""));"") '
        )

    ts_updates = []
    for r in range(TS_F1_START + 1, TS_F1_END + 2):  # rows 3–10 (1-indexed)
        ts_updates.append({"range": f"O{r}", "values": [[_team_prom(r, f1_ds_range)]]})
    for r in range(TS_F2_START + 1, TS_F2_END + 2):  # rows 14–21
        ts_updates.append({"range": f"O{r}", "values": [[_team_prom(r, f2_ds_range)]]})

    ts.batch_update(ts_updates, value_input_option="USER_ENTERED")
    print(f'  Columna O (Team Pos Promedio) escrita en "{TS_SHEET}" — '
          f'{len(ts_updates)} filas')

    # ── Column P in Team Standings: MIN best time of the two pilots ────────────
    # Looks up each pilot's best time from Drivers Standings column U (index 20 in B:U range)
    f1_ds_range_u = f"'Drivers Standings'!$B${DS_F1_START_1}:$U${DS_F1_END_1}"
    f2_ds_range_u = f"'Drivers Standings'!$B${DS_F2_START_1}:$U${DS_F2_END_1}"

    def _team_best_time(r: int, ds_range_u: str) -> str:
        # Average of both pilots' best official-race times.
        # Column U is the 20th column in the B:U range (B=1, C=2, ... U=20).
        # Fallback 999 keeps teams with no data at the bottom.
        p1 = f"D{r}"
        p2 = f"E{r}"
        return (
            f'=PROMEDIO('
            f'SI.ERROR(BUSCARV({p1};{ds_range_u};20;FALSO);999);'
            f'SI.ERROR(BUSCARV({p2};{ds_range_u};20;FALSO);999))'
        )

    # Expand TS columns if needed (P = 16th col)
    if ts.col_count < 16:
        spreadsheet.batch_update({"requests": [{
            "appendDimension": {
                "sheetId": ts_sid,
                "dimension": "COLUMNS",
                "length": 16 - ts.col_count,
            }
        }]})
        ts = spreadsheet.worksheet(TS_SHEET)
        ts_sid = ts.id

    p_updates = []
    for r in range(TS_F1_START + 1, TS_F1_END + 2):
        p_updates.append({"range": f"P{r}", "values": [[_team_best_time(r, f1_ds_range_u)]]})
    for r in range(TS_F2_START + 1, TS_F2_END + 2):
        p_updates.append({"range": f"P{r}", "values": [[_team_best_time(r, f2_ds_range_u)]]})

    ts.batch_update(p_updates, value_input_option="USER_ENTERED")
    print(f'  Columna P (Mejor Tiempo equipo) escrita en "{TS_SHEET}" — {len(p_updates)} filas')

    # Format columns O and P
    ts_fmt_reqs = [
        _fmt(ts_sid, TS_F1_START - 1, TS_F1_END + 1,
             14, 16,
             fg={"red": 0.6, "green": 0.6, "blue": 0.6},
             h_align="CENTER", font_size=8, italic=True),
        _fmt(ts_sid, TS_F2_START - 1, TS_F2_END + 1,
             14, 16,
             fg={"red": 0.6, "green": 0.6, "blue": 0.6},
             h_align="CENTER", font_size=8, italic=True),
        _col_width(ts_sid, 14, 70),
        _col_width(ts_sid, 15, 75),
    ]
    spreadsheet.batch_update({"requests": ts_fmt_reqs})
    ts.update(range_name="O2",  values=[["Pos Prom"]], value_input_option="RAW")
    ts.update(range_name="O13", values=[["Pos Prom"]], value_input_option="RAW")
    ts.update(range_name="P2",  values=[["Mejor T"]], value_input_option="RAW")
    ts.update(range_name="P13", values=[["Mejor T"]], value_input_option="RAW")

    print("  ✅ Columnas de desempate listas. Puedes ocultarlas con clic derecho → Ocultar.")


# ── Build Suplentes sheet ─────────────────────────────────────────────────────

SUPLENTES_SHEET  = "Suplentes"
_SUP_COLS        = ["Fecha", "Escudería", "Suplente", "Posición", "Categoría", "Puntos"]
_SUP_N_COLS      = len(_SUP_COLS)   # 6
_SUP_TEMPLATE_ROWS = 30             # blank formula rows pre-populated


def build_suplentes_sheet(spreadsheet: gspread.Spreadsheet) -> gspread.Worksheet:
    """
    Creates (or rebuilds) the "Suplentes" sheet.

    Structure:
      Row 1: merged category header (dark navy)
      Row 2: column headers (blue)
      Rows 3+: template rows with Puntos formula pre-filled

    Puntos formula: =IF(D{r}="","",IF(E{r}="F1",MAX(0,17-D{r}),MAX(0,16-D{r})))
      → auto-calculates based on position and category (F1=17pts max, F2=16pts max)

    Team Standings formula addition (Spanish locale, per race month):
      + SUMAPRODUCTO((Suplentes!$A:$A="Marzo")*(Suplentes!$B:$B=C3)*Suplentes!$F:$F)
    """
    try:
        ws = spreadsheet.worksheet(SUPLENTES_SHEET)
        print(f'  Hoja "{SUPLENTES_SHEET}" ya existe — reconstruyendo...')
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(
            SUPLENTES_SHEET,
            rows=_SUP_TEMPLATE_ROWS + 5,
            cols=_SUP_N_COLS + 2,
        )
        print(f'  Creada nueva hoja "{SUPLENTES_SHEET}"')

    sid = ws.id

    # ── Clear ─────────────────────────────────────────────────────────────────
    spreadsheet.batch_update({"requests": [_freeze(sid, rows=0, cols=0)]})
    spreadsheet.batch_update({"requests": [
        _unmerge(sid, 0, _SUP_TEMPLATE_ROWS + 5, 0, _SUP_N_COLS + 2),
        _reset_fmt(sid, 0, _SUP_TEMPLATE_ROWS + 5, 0, _SUP_N_COLS + 2),
    ]})
    ws.batch_clear([f"A1:{_col_letter(_SUP_N_COLS + 1)}{_SUP_TEMPLATE_ROWS + 5}"])

    # ── Build data grid ───────────────────────────────────────────────────────
    grid: list[list] = []
    grid.append(["SUPLENTES — PILOTOS DE REFUERZO"] + [""] * (_SUP_N_COLS - 1))
    grid.append(_SUP_COLS)

    for i in range(_SUP_TEMPLATE_ROWS):
        r = i + 3   # 1-indexed sheet row (data starts at row 3)
        # Use semicolons (Spanish locale) — written via USER_ENTERED in _write_grid fallback
        pts = (
            f'=SI(D{r}="";"";SI(E{r}="F1"'
            f';MAX(0;17-D{r});MAX(0;16-D{r})))'
        )
        grid.append(["", "", "", "", "", pts])

    # Use USER_ENTERED so Spanish function names (SI, MAX) are parsed correctly
    ws.update(range_name="A1", values=grid, value_input_option="USER_ENTERED")

    # ── Formatting ────────────────────────────────────────────────────────────
    reqs: list[dict] = []

    # Category header
    reqs.append(_fmt(sid, 0, 1, 0, _SUP_N_COLS,
                     bg=_NAV, fg=_WHT, bold=True, h_align="CENTER", font_size=13))
    reqs.append(_merge(sid, 0, 1, 0, _SUP_N_COLS))

    # Column headers
    reqs.append(_fmt(sid, 1, 2, 0, _SUP_N_COLS,
                     bg=_BLU, fg=_WHT, bold=True, h_align="CENTER"))

    # Data rows — alternating white / light gray
    for i in range(_SUP_TEMPLATE_ROWS):
        bg = _WHT if i % 2 == 0 else _LGY
        reqs.append(_fmt(sid, 2 + i, 3 + i, 0, _SUP_N_COLS, bg=bg, fg=_DRK))

    # Center: Fecha, Posición, Categoría, Puntos
    reqs.append(_fmt(sid, 2, 2 + _SUP_TEMPLATE_ROWS, 0, 1, h_align="CENTER"))  # Fecha
    reqs.append(_fmt(sid, 2, 2 + _SUP_TEMPLATE_ROWS, 3, 4, h_align="CENTER"))  # Posición
    reqs.append(_fmt(sid, 2, 2 + _SUP_TEMPLATE_ROWS, 4, 5, h_align="CENTER"))  # Categoría
    reqs.append(_fmt(sid, 2, 2 + _SUP_TEMPLATE_ROWS, 5, 6, h_align="CENTER"))  # Puntos
    reqs.append(_fmt(sid, 2, 2 + _SUP_TEMPLATE_ROWS, 5, 6, bold=True))         # Puntos bold

    # Borders
    reqs.append(_border(sid, 1, 2 + _SUP_TEMPLATE_ROWS, 0, _SUP_N_COLS))

    # Column widths: Fecha, Escudería, Suplente, Posición, Categoría, Puntos
    for col, px in enumerate([110, 140, 160, 90, 105, 80]):
        reqs.append(_col_width(sid, col, px))

    # Dropdown — Fecha (col A = index 0)
    reqs.append({
        "setDataValidation": {
            "range": _rd(sid, 2, 2 + _SUP_TEMPLATE_ROWS, 0, 1),
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [{"userEnteredValue": m} for m in RACE_MONTHS],
                },
                "showCustomUi": True,
                "strict": False,
            },
        }
    })

    # Dropdown — Escudería (col B = index 1) — same list as Equipos sheet
    _all_constructors = [
        "McLaren", "Red Bull", "Mercedes", "Ferrari", "Williams",
        "Aston Martin", "Alpine", "Haas", "Racing Bulls", "Audi", "Cadillac",
        "Lotus", "Sauber", "BMW", "Renault", "Arrows", "Benetton",
        "Ferrari Classic", "Jaguar", "Minardi", "Brawn GP", "Brabham",
    ]
    reqs.append({
        "setDataValidation": {
            "range": _rd(sid, 2, 2 + _SUP_TEMPLATE_ROWS, 1, 2),
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [{"userEnteredValue": c} for c in _all_constructors],
                },
                "showCustomUi": True,
                "strict": False,
            },
        }
    })

    # Dropdown — Categoría (col E = index 4)
    reqs.append({
        "setDataValidation": {
            "range": _rd(sid, 2, 2 + _SUP_TEMPLATE_ROWS, 4, 5),
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [{"userEnteredValue": "F1"}, {"userEnteredValue": "F2"}],
                },
                "showCustomUi": True,
                "strict": True,
            },
        }
    })

    # Freeze header + column-header rows
    reqs.append(_freeze(sid, rows=2))

    spreadsheet.batch_update({"requests": reqs})

    print(f'  "{SUPLENTES_SHEET}" lista con {_SUP_TEMPLATE_ROWS} filas de plantilla.')
    print()
    print("  📝 Para cada suplente llena: Fecha | Escudería | Suplente | Posición | Categoría")
    print("     Los Puntos se calculan automáticamente.")
    print()
    print("  📋 Actualiza Team Standings agregando al final de cada fórmula de carrera:")
    print('     +SUMAPRODUCTO((Suplentes!$A:$A="Marzo")*(Suplentes!$B:$B=C3)*Suplentes!$F:$F)')
    print("     (cambia 'Marzo' por el mes correspondiente, C3 por la celda de Escudería)")
    return ws


# ── Build DOTD (Driver of the Day) sheet ─────────────────────────────────────

DOTD_SHEET        = "DOTD"
_DOTD_COLS        = ["Fecha", "Piloto", "Categoría", "Razón"]
_DOTD_N_COLS      = len(_DOTD_COLS)
_DOTD_ROWS        = 30


def build_dotd_sheet(spreadsheet: gspread.Spreadsheet) -> gspread.Worksheet:
    """
    Creates (or rebuilds) the "DOTD" sheet.

    Structure:
      Row 1: merged header "DRIVER OF THE DAY"
      Row 2: column headers (Fecha | Piloto | Categoría | Razón)
      Rows 3+: template rows (manually filled by organizer)
    """
    try:
        ws = spreadsheet.worksheet(DOTD_SHEET)
        print(f'  Hoja "{DOTD_SHEET}" ya existe — reconstruyendo...')
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(
            DOTD_SHEET, rows=_DOTD_ROWS + 5, cols=_DOTD_N_COLS + 2,
        )
        print(f'  Creada nueva hoja "{DOTD_SHEET}"')

    sid = ws.id

    spreadsheet.batch_update({"requests": [_freeze(sid, rows=0, cols=0)]})
    spreadsheet.batch_update({"requests": [
        _unmerge(sid, 0, _DOTD_ROWS + 5, 0, _DOTD_N_COLS + 2),
        _reset_fmt(sid, 0, _DOTD_ROWS + 5, 0, _DOTD_N_COLS + 2),
    ]})
    ws.batch_clear([f"A1:{_col_letter(_DOTD_N_COLS + 1)}{_DOTD_ROWS + 5}"])

    # Data grid
    grid: list[list] = [
        ["DRIVER OF THE DAY — GKD 2026"] + [""] * (_DOTD_N_COLS - 1),
        _DOTD_COLS,
    ]
    for _ in range(_DOTD_ROWS):
        grid.append(["", "", "", ""])

    ws.update(range_name="A1", values=grid, value_input_option="RAW")

    # Formatting
    reqs: list[dict] = []

    # Header row
    _NAV = {"red": 13/255, "green": 17/255, "blue": 23/255}
    _BLU = {"red": 31/255, "green": 97/255, "blue": 141/255}
    _WHT = {"red": 1.0, "green": 1.0, "blue": 1.0}
    _GLD = {"red": 201/255, "green": 168/255, "blue": 76/255}

    reqs += [
        _merge(sid, 0, 1, 0, _DOTD_N_COLS),
        _fmt(sid, 0, 1, 0, _DOTD_N_COLS, bg=_NAV, fg=_GLD,
             bold=True, font_size=13, h_align="CENTER"),
        _fmt(sid, 1, 2, 0, _DOTD_N_COLS, bg=_BLU, fg=_WHT,
             bold=True, font_size=10, h_align="CENTER"),
        _fmt(sid, 2, _DOTD_ROWS + 2, 0, _DOTD_N_COLS,
             bg={"red": 0.12, "green": 0.14, "blue": 0.18},
             fg=_WHT, font_size=10),
        _col_width(sid, 0, 120),   # Fecha
        _col_width(sid, 1, 140),   # Piloto
        _col_width(sid, 2, 120),   # Categoría
        _col_width(sid, 3, 450),   # Razón
        _row_height(sid, 0, 36),
        _row_height(sid, 1, 28),
        _freeze(sid, rows=2),
    ]

    # Dropdown — Categoría (col C = index 2)
    reqs.append({
        "setDataValidation": {
            "range": _rd(sid, 2, 2 + _DOTD_ROWS, 2, 3),
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [
                        {"userEnteredValue": "F1 Moderna"},
                        {"userEnteredValue": "F1 Clásica"},
                    ],
                },
                "showCustomUi": True,
                "strict": False,
            },
        }
    })

    spreadsheet.batch_update({"requests": reqs})
    print(f'  "{DOTD_SHEET}" lista. Llena: Fecha | Piloto | Categoría | Razón')
    return ws


MEDIA_SHEET   = "Media"
_MEDIA_COLS   = ["Tipo", "Título", "URL", "Fecha"]
_MEDIA_N_COLS = len(_MEDIA_COLS)
_MEDIA_ROWS   = 50


def build_media_sheet(spreadsheet: gspread.Spreadsheet) -> gspread.Worksheet:
    """
    Creates (or rebuilds) the "Media" sheet.

    Structure:
      Row 1: merged header "GKD MEDIA"
      Row 2: column headers (Tipo | Título | URL | Fecha)
      Rows 3+: template rows (manually filled by organizer)
    Column A has a dropdown: Foto | YouTube | Instagram
    """
    try:
        ws = spreadsheet.worksheet(MEDIA_SHEET)
        print(f'  Hoja "{MEDIA_SHEET}" ya existe — reconstruyendo...')
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(
            MEDIA_SHEET, rows=_MEDIA_ROWS + 5, cols=_MEDIA_N_COLS + 2,
        )
        print(f'  Creada nueva hoja "{MEDIA_SHEET}"')

    sid = ws.id

    spreadsheet.batch_update({"requests": [_freeze(sid, rows=0, cols=0)]})
    spreadsheet.batch_update({"requests": [
        _unmerge(sid, 0, _MEDIA_ROWS + 5, 0, _MEDIA_N_COLS + 2),
        _reset_fmt(sid, 0, _MEDIA_ROWS + 5, 0, _MEDIA_N_COLS + 2),
    ]})
    ws.batch_clear([f"A1:{_col_letter(_MEDIA_N_COLS + 1)}{_MEDIA_ROWS + 5}"])

    # Data grid
    grid: list[list] = [
        ["GKD MEDIA — 2026"] + [""] * (_MEDIA_N_COLS - 1),
        _MEDIA_COLS,
    ]
    for _ in range(_MEDIA_ROWS):
        grid.append(["", "", "", ""])

    ws.update(range_name="A1", values=grid, value_input_option="RAW")

    # Formatting
    reqs: list[dict] = []

    _NAV = {"red": 13/255, "green": 17/255, "blue": 23/255}
    _BLU = {"red": 31/255, "green": 97/255, "blue": 141/255}
    _WHT = {"red": 1.0, "green": 1.0, "blue": 1.0}
    _GLD = {"red": 201/255, "green": 168/255, "blue": 76/255}

    reqs += [
        _merge(sid, 0, 1, 0, _MEDIA_N_COLS),
        _fmt(sid, 0, 1, 0, _MEDIA_N_COLS, bg=_NAV, fg=_GLD,
             bold=True, font_size=13, h_align="CENTER"),
        _fmt(sid, 1, 2, 0, _MEDIA_N_COLS, bg=_BLU, fg=_WHT,
             bold=True, font_size=10, h_align="CENTER"),
        _fmt(sid, 2, _MEDIA_ROWS + 2, 0, _MEDIA_N_COLS,
             bg={"red": 0.12, "green": 0.14, "blue": 0.18},
             fg=_WHT, font_size=10),
        _col_width(sid, 0, 120),   # Tipo
        _col_width(sid, 1, 220),   # Título
        _col_width(sid, 2, 420),   # URL
        _col_width(sid, 3, 120),   # Fecha
        _row_height(sid, 0, 36),
        _row_height(sid, 1, 28),
        _freeze(sid, rows=2),
    ]

    # Dropdown — Tipo (col A = index 0)
    reqs.append({
        "setDataValidation": {
            "range": _rd(sid, 2, 2 + _MEDIA_ROWS, 0, 1),
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [
                        {"userEnteredValue": "Foto"},
                        {"userEnteredValue": "YouTube"},
                        {"userEnteredValue": "Instagram"},
                    ],
                },
                "showCustomUi": True,
                "strict": False,
            },
        }
    })

    spreadsheet.batch_update({"requests": reqs})
    print(f'  "{MEDIA_SHEET}" lista. Llena: Tipo | Título | URL | Fecha')
    return ws


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Championship Standings builder")
    parser.add_argument("--suplentes", action="store_true",
                        help="Solo crear/reconstruir la hoja Suplentes")
    parser.add_argument("--team-only", action="store_true",
                        help="Solo reconstruir Team Standings (preserva Drivers Standings)")
    parser.add_argument("--tiebreaker", action="store_true",
                        help="Solo escribir columnas de desempate (T en DS, O en TS)")
    parser.add_argument("--dotd-sheet", action="store_true",
                        help="Crear/reconstruir la hoja DOTD (Driver of the Day)")
    parser.add_argument("--media-sheet", action="store_true",
                        help="Crear/reconstruir la hoja Media (fotos, YouTube, Instagram)")
    args = parser.parse_args()

    print("🏁  Championship Standings — iniciando...\n")

    spreadsheet = _get_spreadsheet()

    if args.suplentes:
        print("🔄  Construyendo hoja Suplentes...")
        build_suplentes_sheet(spreadsheet)
        print("✅ Listo.")
        return

    if args.tiebreaker:
        print("🔢  Escribiendo columnas de desempate (Pos Promedio)...")
        add_tiebreaker_columns(spreadsheet)
        print("✅ Listo.")
        return

    if args.dotd_sheet:
        print("🏆  Construyendo hoja DOTD...")
        build_dotd_sheet(spreadsheet)
        print("✅ Listo.")
        return

    if args.media_sheet:
        print("📸  Construyendo hoja Media...")
        build_media_sheet(spreadsheet)
        print("✅ Listo.")
        return

    print("📋 Leyendo hoja Equipos...")
    f1_pilots, f2_pilots, f1_teams, f2_teams = read_equipos(spreadsheet)
    print(f"   F1: {len(f1_pilots)} pilotos, {len(f1_teams)} equipos")
    print(f"   F2: {len(f2_pilots)} pilotos, {len(f2_teams)} equipos")

    if args.team_only:
        print("\n👥 Construyendo solo Team Standings (Drivers Standings intacto)...")
        build_team_standings(spreadsheet, f1_teams, f2_teams)
        print("\n✅ Listo.")
        return

    print("\n🏎  Construyendo Drivers Standings...")
    build_drivers_standings(spreadsheet, f1_pilots, f2_pilots)

    print("\n👥 Construyendo Team Standings...")
    build_team_standings(spreadsheet, f1_teams, f2_teams)

    print("\n✅ Listo. Recuerda agregar el Apps Script para auto-sorteo.")
    print("   Copia el código de APPS_SCRIPT.js y pégalo en")
    print("   Extensiones → Apps Script → (reemplaza el contenido) → Guardar.")


if __name__ == "__main__":
    main()
