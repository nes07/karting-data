/**
 * APPS_SCRIPT.js — Mundial de Karting 2026
 * =========================================
 * Paste this ENTIRE file into your Google Sheets Apps Script editor:
 *   Extensions → Apps Script → replace all existing code → Save (Ctrl+S) → Run once to authorize
 *
 * What this does:
 *   1. "Equipos" sheet  → auto-colors row when an Escudería is selected from dropdown
 *   2. "Drivers Standings" → auto-sorts F1 and F2 sections (by Puntos Totales, desc)
 *      every time a Posición is entered
 *   3. "Team Standings" → auto-sorts F1 and F2 sections (by Puntos Totales, desc)
 *      every time Drivers Standings changes (triggered by the same onEdit)
 *   4. doGet() → public JSON API for the GKD Championship web app (GitHub Pages)
 *
 * Column layout — Drivers Standings (21 columns A–U):
 *   A=#  B=Piloto  C=Puntos Totales
 *   D,E=Marzo  F,G=Abril  H,I=Mayo  J,K=Junio
 *   L,M=Julio  N,O=Agosto  P,Q=Septiembre  R,S=Octubre
 *   T=Pos Promedio (tiebreaker 1)  U=Mejor Tiempo (tiebreaker 2)
 *
 * Posición columns (where user types manually): D, F, H, J, L, N, P, R
 *   → column numbers (1-indexed): 4, 6, 8, 10, 12, 14, 16, 18
 *
 * Row layout — Drivers Standings:
 *   Row 1: "NUEVA ERA — F1" category header
 *   Row 2: month sub-headers
 *   Row 3: column labels
 *   Rows 4–19: 16 F1 pilots  ← sort range
 *   Row 20: blank spacer
 *   Row 21: "ERA ANTIGUA — F2" category header
 *   Row 22: month sub-headers
 *   Row 23: column labels
 *   Rows 24–39: 16 F2 pilots/TBD  ← sort range
 *
 * Row layout — Team Standings:
 *   Row 1: "NUEVA ERA — F1" header
 *   Row 2: column labels
 *   Rows 3–10: 8 F1 teams  ← sort range
 *   Row 11: blank spacer
 *   Row 12: "ERA ANTIGUA — F2" header
 *   Row 13: column labels
 *   Rows 14–21: 8 F2 teams  ← sort range
 */


// ─── Constructor Colors (F1 2026 + classic F2 teams) ─────────────────────────
const CONSTRUCTOR_COLORS = {
  // Modern F1 2026
  "McLaren":         { bg: "#EF8733", fg: "#000000" },
  "Red Bull":        { bg: "#4570C0", fg: "#FFFFFF" },
  "Mercedes":        { bg: "#75F1D3", fg: "#000000" },
  "Ferrari":         { bg: "#D52E37", fg: "#FFFFFF" },
  "Williams":        { bg: "#3267D4", fg: "#FFFFFF" },
  "Aston Martin":    { bg: "#4B9774", fg: "#FFFFFF" },
  "Alpine":          { bg: "#479FE2", fg: "#FFFFFF" },
  "Haas":            { bg: "#DFE1E2", fg: "#000000" },
  "Racing Bulls":    { bg: "#7091F8", fg: "#FFFFFF" },
  "Audi":            { bg: "#EB4526", fg: "#FFFFFF" },
  "Cadillac":        { bg: "#AAAADD", fg: "#000000" },
  // Classic / F2 teams
  "Lotus":           { bg: "#0B3D2E", fg: "#FFD700" },
  "Sauber":          { bg: "#003A8F", fg: "#FFFFFF" },
  "BMW":             { bg: "#0066B1", fg: "#FFFFFF" },
  "Renault":         { bg: "#FFD700", fg: "#000000" },
  "Arrows":          { bg: "#FF7A00", fg: "#000000" },
  "Benetton":        { bg: "#00A94F", fg: "#FFFFFF" },
  "Ferrari Classic": { bg: "#8B0000", fg: "#FFD700" },
  "Jaguar":          { bg: "#004225", fg: "#FFFFFF" },
  "Minardi":         { bg: "#1C1C1C", fg: "#FFD700" },
  "Brawn GP":        { bg: "#E6FF00", fg: "#000000" },
  "Brabham":         { bg: "#001A57", fg: "#FFFFFF" },
};


// ─── Column numbers (1-indexed) where Posición is entered ────────────────────
const DS_POSICION_COLS = [4, 6, 8, 10, 12, 14, 16, 18]; // D,F,H,J,L,N,P,R

// ─── Drivers Standings row ranges (1-indexed, inclusive) ─────────────────────
const DS_F1_START = 4,  DS_F1_END = 19;  // 16 F1 pilots
const DS_F2_START = 24, DS_F2_END = 39;  // 16 F2 pilots/TBD
const DS_TOTAL_COLS    = 21;   // A–S (data) + T (Pos Prom) + U (Mejor Tiempo)
const DS_POS_PROM_COL  = 20;   // Column T (1-indexed) — Pos Promedio (tiebreaker 1)
const DS_BEST_TIME_COL = 21;   // Column U (1-indexed) — Mejor Tiempo (tiebreaker 2)

// ─── Team Standings row ranges (1-indexed, inclusive) ────────────────────────
const TS_F1_START = 3,  TS_F1_END = 10;  // 8 F1 teams
const TS_F2_START = 14, TS_F2_END = 21;  // 8 F2 teams
const TS_TOTAL_COLS    = 16;   // A–N (data) + O (Pos Prom) + P (Mejor Tiempo)
const TS_POS_PROM_COL  = 15;   // Column O (1-indexed) — Team Pos Promedio (tiebreaker 1)
const TS_BEST_TIME_COL = 16;   // Column P (1-indexed) — Team Mejor Tiempo (tiebreaker 2)


// ─── Main trigger ─────────────────────────────────────────────────────────────
function onEdit(e) {
  // onEdit requires a real edit event — guard against manual execution
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const name  = sheet.getName();

  // 1. Equipos: color row on Escudería dropdown change
  if (name === "Equipos") {
    _handleEquiposColor(e, sheet);
    return;
  }

  // 2. Drivers Standings: sort F1/F2 on Posición entry
  if (name === "Drivers Standings") {
    _handleDriversStandingsSort(e, sheet);
    return;
  }
}


// ─── Equipos color logic ──────────────────────────────────────────────────────
function _handleEquiposColor(e, sheet) {
  const col = e.range.getColumn();
  const row = e.range.getRow();

  // Column G (7) = Escudería dropdown
  if (col !== 7) return;

  // F1 data rows: 3–10  |  F2 data rows: 14–21
  const isDataRow = (row >= 3 && row <= 10) || (row >= 14 && row <= 21);
  if (!isDataRow) return;

  const value    = (e.value || "").trim();
  const colors   = CONSTRUCTOR_COLORS[value];
  const rowRange = sheet.getRange(row, 1, 1, 7); // columns A–G

  if (colors) {
    rowRange.setBackground(colors.bg);
    rowRange.setFontColor(colors.fg);
    rowRange.setFontWeight("bold");
  } else {
    // Dropdown cleared → reset to white
    rowRange.setBackground("#FFFFFF");
    rowRange.setFontColor("#222222");
    rowRange.setFontWeight("normal");
  }
}


// ─── Drivers Standings sort logic ────────────────────────────────────────────
function _handleDriversStandingsSort(e, sheet) {
  const col = e.range.getColumn();
  const row = e.range.getRow();

  // Only react to Posición column edits
  if (!DS_POSICION_COLS.includes(col)) return;

  // Wait a tick so formula cells can recalculate before we sort
  SpreadsheetApp.flush();

  if (row >= DS_F1_START && row <= DS_F1_END) {
    _sortSection(sheet, DS_F1_START, DS_F1_END, DS_TOTAL_COLS, 3, DS_POS_PROM_COL, DS_BEST_TIME_COL);
    _sortTeamSection("Team Standings", TS_F1_START, TS_F1_END, TS_TOTAL_COLS, 6, TS_POS_PROM_COL, TS_BEST_TIME_COL);
  } else if (row >= DS_F2_START && row <= DS_F2_END) {
    _sortSection(sheet, DS_F2_START, DS_F2_END, DS_TOTAL_COLS, 3, DS_POS_PROM_COL, DS_BEST_TIME_COL);
    _sortTeamSection("Team Standings", TS_F2_START, TS_F2_END, TS_TOTAL_COLS, 6, TS_POS_PROM_COL, TS_BEST_TIME_COL);
  }
}


// ─── Generic section sort (Drivers Standings) ────────────────────────────────
/**
 * Sorts rows [startRow, endRow] of `sheet` descending by `sortCol`.
 * Tiebreaker: ascending by `tiebreakerCol` (Pos Promedio — lower avg = better).
 * Then renumbers column A.
 */
function _sortSection(sheet, startRow, endRow, numCols, sortCol, tiebreakerCol, bestTimeCol) {
  const numRows = endRow - startRow + 1;
  const range = sheet.getRange(startRow, 1, numRows, numCols);

  const sortSpec = [
    { column: sortCol,      ascending: false }, // 1st: most points
    { column: tiebreakerCol, ascending: true },  // 2nd: lower avg position
    { column: bestTimeCol,   ascending: true },  // 3rd: faster best lap time
  ];
  range.sort(sortSpec);

  // Renumber the # column (column A = 1)
  for (let i = 0; i < numRows; i++) {
    sheet.getRange(startRow + i, 1).setValue(i + 1);
  }
}


// ─── Team Standings section sort ─────────────────────────────────────────────
/**
 * Sorts a Team Standings section descending by `sortCol` (Puntos Totales).
 * Tiebreaker: ascending by `tiebreakerCol` (Team Pos Promedio — lower = better).
 */
function _sortTeamSection(tsSheetName, startRow, endRow, numCols, sortCol, tiebreakerCol, bestTimeCol) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ts = ss.getSheetByName(tsSheetName);
  if (!ts) return;

  // Give formulas time to recalculate after DS sort
  SpreadsheetApp.flush();

  const numRows = endRow - startRow + 1;
  const range = ts.getRange(startRow, 1, numRows, numCols);

  const sortSpec = [
    { column: sortCol,       ascending: false }, // 1st: most points
    { column: tiebreakerCol, ascending: true  }, // 2nd: lower avg position
    { column: bestTimeCol,   ascending: true  }, // 3rd: faster best lap (MIN of team)
  ];
  range.sort(sortSpec);

  // Renumber # column
  for (let i = 0; i < numRows; i++) {
    ts.getRange(startRow + i, 1).setValue(i + 1);
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC JSON API — doGet()
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Serves all championship data as JSON.
 *
 * Deploy as a Web App:
 *   Extensions → Apps Script → Deploy → New deployment
 *   Type: Web App  |  Execute as: Me  |  Access: Anyone
 *
 * The generated URL goes into assets/js/app.js as GKD_API_URL.
 *
 * Returns:
 *   { drivers_f1, drivers_f2, teams_f1, teams_f2,
 *     vuelta_rapida, tiempos_2026, inscritos,
 *     equipos_f1, equipos_f2, race_dates, dotd }
 */
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const data = {
    drivers_f1:   _getDriversStandings(ss, DS_F1_START, DS_F1_END),
    drivers_f2:   _getDriversStandings(ss, DS_F2_START, DS_F2_END),
    teams_f1:     _getTeamStandings(ss, TS_F1_START, TS_F1_END),
    teams_f2:     _getTeamStandings(ss, TS_F2_START, TS_F2_END),
    vuelta_rapida: _getVueltaRapida(ss),
    tiempos_2026:  _getTiempos2026(ss),
    inscritos:     _getInscritos(ss),
    equipos_f1:    _getEquipos(ss, "F1"),
    equipos_f2:    _getEquipos(ss, "F2"),
    race_dates:    _getRaceDates(ss),
    race_results:  _getRaceResults(ss),
    dotd:          _getDotd(ss),
    race_months:   ["Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre"],
    updated_at:    new Date().toISOString(),
  };

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ─── Data readers ─────────────────────────────────────────────────────────────

function _getDriversStandings(ss, startRow, endRow) {
  const ws   = ss.getSheetByName("Drivers Standings");
  const rows = ws.getRange(startRow, 1, endRow - startRow + 1, DS_TOTAL_COLS).getValues();
  // Month headers are in row 2 of the sheet (fixed structure)
  const months = ["Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre"];

  return rows
    .filter(r => r[1] && String(r[1]).trim() !== "")
    .map(r => {
      const races = [];
      // Posición/Puntos pairs start at col index 3 (D), step 2
      for (let i = 0; i < months.length; i++) {
        const pos = r[3 + i * 2];
        const pts = r[4 + i * 2];
        races.push({
          month: months[i],
          pos:   pos !== "" ? Number(pos) : null,
          pts:   pts !== "" ? Number(pts) : null,
        });
      }
      return {
        rank:        Number(r[0]),
        pilot:       String(r[1]).trim(),
        total_pts:   r[2] !== "" ? Number(r[2]) : 0,
        races,
        pos_prom:    r[19] !== "" ? Number(r[19]) : null,  // col T
        best_time:   r[20] !== "" ? Number(r[20]) : null,  // col U
      };
    });
}


function _getTeamStandings(ss, startRow, endRow) {
  const ws   = ss.getSheetByName("Team Standings");
  const rows = ws.getRange(startRow, 1, endRow - startRow + 1, TS_TOTAL_COLS).getValues();
  const months = ["Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre"];

  return rows
    .filter(r => r[1] && String(r[1]).trim() !== "")
    .map(r => {
      const monthPts = {};
      // Team monthly points start at col index 6 (G), one per month
      for (let i = 0; i < months.length; i++) {
        const v = r[6 + i];
        monthPts[months[i]] = v !== "" ? Number(v) : null;
      }
      return {
        rank:       Number(r[0]),
        team:       String(r[1]).trim(),
        escuderia:  String(r[2]).trim(),
        pilot1:     String(r[3]).trim(),
        pilot2:     String(r[4]).trim(),
        total_pts:  r[5] !== "" ? Number(r[5]) : 0,
        months:     monthPts,
        pos_prom:   r[14] !== "" ? Number(r[14]) : null, // col O
        best_time:  r[15] !== "" ? Number(r[15]) : null, // col P
      };
    });
}


function _getVueltaRapida(ss) {
  const ws   = ss.getSheetByName("Campeonato Vuelta Rapida");
  const rows = ws.getDataRange().getValues();
  // Real layout (0-indexed): A=blank B=rank C=Piloto D=Tiempo E=Variación F=Fecha
  // Rows 0-1 blank, row 2 = headers, data starts at row 3
  return rows.slice(3)
    .filter(r => r[2] && String(r[2]).trim() !== "")
    .map(r => ({
      rank:      r[1] !== "" ? Number(r[1]) : null,
      pilot:     String(r[2]).trim(),
      time:      r[3] !== "" ? Number(String(r[3]).replace(",", ".")) : null,
      variation: r[4] !== "" ? Number(r[4]) : null,
      date:      r[5] ? String(r[5]) : null,
    }))
    .sort((a, b) => (a.time || 999) - (b.time || 999));
}


function _getTiempos2026(ss) {
  const ws   = ss.getSheetByName("Tiempos 2026");
  // Real layout (0-indexed from col A):
  //   A=blank  B=N  C=Pilotos  D=Mejor Tiempo  E=Tiempo Promedio
  // Rows 0-2 = headers, data starts at row 3 (1-indexed row 4)
  // Read 5 cols from col A so indices match: r[0]=blank r[1]=N r[2]=Piloto r[3]=best r[4]=avg
  const rows = ws.getRange(4, 1, ws.getLastRow() - 3, 5).getValues();
  return rows
    .filter(r => r[2] && String(r[2]).trim() !== "")
    .map(r => ({
      pilot:   String(r[2]).trim(),
      best:    r[3] !== "" ? Number(r[3]) : null,
      average: r[4] !== "" ? Number(r[4]) : null,
    }))
    .sort((a, b) => (a.best || 999) - (b.best || 999));
}


function _getInscritos(ss) {
  const ws   = ss.getSheetByName("Inscritos");
  const rows = ws.getDataRange().getValues();
  // Real layout: r[0]=# r[1]=Piloto(alias) r[2]=Nombre Inscrito r[3]=Correo
  // Row 0 = headers, data starts at row 1
  return rows.slice(1)
    .filter(r => r[1] && String(r[1]).trim() !== "")
    .map(r => ({
      alias: String(r[1]).trim(),
      name:  String(r[2]).trim(),
    }));
}


function _getEquipos(ss, category) {
  const ws   = ss.getSheetByName("Equipos");
  const rows = ws.getDataRange().getValues();

  // Find the section header for this category
  // F1 rows: 3–10 (0-indexed: 2–9); F2 rows: 14–21 (0-indexed: 13–20)
  const dataRows = category === "F1"
    ? rows.slice(2, 10)
    : rows.slice(13, 21);

  // Equipos column layout (0-indexed):
  // 0=#  1=?  2=Piloto1  3=?  4=Piloto2  5=?  6=Escudería
  // (matches read_equipos() in standings.py: row[2]=pilot1, row[4]=pilot2)
  return dataRows
    .filter(r => r[2] && String(r[2]).trim() !== "")
    .map(r => ({
      team_num:  r[0] !== "" ? Number(r[0]) : null,
      pilot1:    String(r[2]).trim(),
      pilot2:    String(r[4]).trim(),
      escuderia: String(r[6]).trim(),
      colors:    CONSTRUCTOR_COLORS[String(r[6]).trim()] || { bg: "#333333", fg: "#FFFFFF" },
    }));
}


function _getRaceDates(ss) {
  const ws   = ss.getSheetByName("Fecha de Carreras");
  const rows = ws.getDataRange().getValues();
  return rows.slice(1)
    .filter(r => r[1] && r[2])
    .map(r => ({
      month: String(r[1]).trim(),
      date:  String(r[2]).trim(),
    }));
}


// ─── Race Results ──────────────────────────────────────────────────────────────
/**
 * Builds race results per month from Drivers Standings.
 * For each month (column pair D/E, F/G, …) we collect the pilots who have
 * a position entered and sort them ascending (P1 first).
 * Escudería is looked up from the Equipos sheet.
 * best_time is not tracked per race in the current sheet structure, so it is null.
 *
 * Returns:
 *   [ { month, date, f1: [{pos, pilot, escuderia, pts, best_time}], f2: [...] }, … ]
 */
function _getRaceResults(ss) {
  const months = ["Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre"];

  const ws = ss.getSheetByName("Drivers Standings");
  if (!ws) return [];

  const f1Rows = ws.getRange(DS_F1_START, 1, DS_F1_END - DS_F1_START + 1, DS_TOTAL_COLS).getValues();
  const f2Rows = ws.getRange(DS_F2_START, 1, DS_F2_END - DS_F2_START + 1, DS_TOTAL_COLS).getValues();

  const escuderiaF1  = _buildEscuderiaLookup(ss, "F1");
  const escuderiaF2  = _buildEscuderiaLookup(ss, "F2");
  const tiemposMap   = _buildTiemposLookup(ss);   // pilot → best time from Tiempos 2026

  const raceDatesArr = _getRaceDates(ss);
  const dateByMonth  = {};
  raceDatesArr.forEach(r => { dateByMonth[r.month] = r.date; });

  return months.map((month, i) => {
    const posColIdx = 3 + i * 2;
    const ptsColIdx = posColIdx + 1;

    function toResults(rows, lookup) {
      return rows
        .filter(r => r[1] && String(r[1]).trim() !== "" && r[posColIdx] !== "" && r[posColIdx] !== null)
        .map(r => {
          const pilot = String(r[1]).trim();
          return {
            pos:       Number(r[posColIdx]),
            pilot,
            escuderia: lookup[pilot] || "",
            pts:       r[ptsColIdx] !== "" ? Number(r[ptsColIdx]) : null,
            best_time: tiemposMap[pilot] || null,
          };
        })
        .sort((a, b) => a.pos - b.pos);
    }

    const f1Results = toResults(f1Rows, escuderiaF1);
    const f2Results = toResults(f2Rows, escuderiaF2);

    if (!f1Results.length && !f2Results.length) return null;

    return {
      month,
      date: dateByMonth[month] || "",
      f1:   f1Results,
      f2:   f2Results,
    };
  }).filter(Boolean);
}


function _buildTiemposLookup(ss) {
  try {
    const ws = ss.getSheetByName("Tiempos 2026");
    if (!ws) return {};
    const lastRow = ws.getLastRow();
    if (lastRow < 4) return {};
    const rows = ws.getRange(4, 1, lastRow - 3, 5).getValues();
    const map  = {};
    rows
      .filter(r => r[2] && String(r[2]).trim() !== "")
      .forEach(r => {
        const pilot = String(r[2]).trim();
        const best  = r[3] !== "" ? Number(r[3]) : null;
        if (best !== null) map[pilot] = best;
      });
    return map;
  } catch(e) {
    return {};
  }
}


function _buildEscuderiaLookup(ss, category) {
  const ws   = ss.getSheetByName("Equipos");
  if (!ws) return {};
  const rows = ws.getDataRange().getValues();
  const dataRows = category === "F1" ? rows.slice(2, 10) : rows.slice(13, 21);
  const lookup = {};
  dataRows.forEach(r => {
    const p1  = String(r[2] || "").trim();
    const p2  = String(r[4] || "").trim();
    const esc = String(r[6] || "").trim();
    if (p1 && esc) lookup[p1] = esc;
    if (p2 && esc) lookup[p2] = esc;
  });
  return lookup;
}


function _getDotd(ss) {
  try {
    const ws   = ss.getSheetByName("DOTD");
    if (!ws) return [];
    const rows = ws.getDataRange().getValues();
    return rows.slice(2)
      .filter(r => r[0] && r[1] && String(r[1]).trim() !== "")
      .map(r => ({
        date:      String(r[0]).trim(),
        pilot:     String(r[1]).trim(),
        category:  String(r[2]).trim(),
        reason:    String(r[3]).trim(),
      }));
  } catch(e) {
    return [];
  }
}
