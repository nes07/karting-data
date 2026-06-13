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
 *   Rows 4–N: F1 pilots + reserve drivers  ← sort range (detected dynamically)
 *   Blank spacer row(s)
 *   "ERA ANTIGUA — F2" category header + sub-headers + labels
 *   Rows M–P: F2 pilots + reserve drivers  ← sort range (detected dynamically)
 *
 *   Section boundaries are found by _findDataSections(): any row with a
 *   positive integer in col A and a non-empty pilot name in col B is a data
 *   row.  You can add pilots or reserve drivers freely without touching the
 *   script constants.
 *
 *   Reserve drivers (escudería = "RD" in the API) are pilots who appear in
 *   a standings section but are NOT registered in the Equipos sheet for that
 *   category.  Their points count fully for their own ranking and at half-
 *   value for the team they replace (handled by the Suplentes sheet formulas).
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
  // Reserve / replacement drivers
  "RD":              { bg: "#E2E8F0", fg: "#475569" },
};


// ─── Column numbers (1-indexed) where Posición is entered ────────────────────
const DS_POSICION_COLS = [4, 6, 8, 10, 12, 14, 16, 18]; // D,F,H,J,L,N,P,R

// ─── Drivers Standings — fallback row ranges (used only if sheet is empty) ───
// Section boundaries are detected dynamically by _findDataSections() so that
// adding more pilots or reserve drivers never requires touching these constants.
const DS_F1_START = 4,  DS_F1_END = 19;
const DS_F2_START = 24, DS_F2_END = 39;
const DS_TOTAL_COLS    = 21;   // A–S (data) + T (Pos Prom) + U (Mejor Tiempo)
const DS_POS_PROM_COL  = 20;   // Column T (1-indexed) — Pos Promedio (tiebreaker 1)
const DS_BEST_TIME_COL = 21;   // Column U (1-indexed) — Mejor Tiempo (tiebreaker 2)

// ─── Team Standings row ranges (1-indexed, inclusive) ────────────────────────
const TS_F1_START = 3,  TS_F1_END = 10;  // 8 F1 teams
const TS_F2_START = 14, TS_F2_END = 21;  // 8 F2 teams
const TS_TOTAL_COLS    = 16;   // A–N (data) + O (Pos Prom) + P (Mejor Tiempo)
const TS_POS_PROM_COL  = 15;   // Column O (1-indexed) — Team Pos Promedio (tiebreaker 1)
const TS_BEST_TIME_COL = 16;   // Column P (1-indexed) — Team Mejor Tiempo (tiebreaker 2)

// ─── Tiempos 2026 / reset de trazado ──────────────────────────────────────────
const TRACK_RESET_DATE      = "2026-05-10";
const TIEMPOS_DATE_ROW      = 2;   // fila con fechas (1-indexed)
const TIEMPOS_FIRST_DATA_ROW= 4;   // primera fila de pilotos
const TIEMPOS_PILOT_COL     = 3;   // C = Piloto
const TIEMPOS_FIRST_RACE_COL= 19;  // S = primera columna de carrera


// ─── Dynamic section detector ────────────────────────────────────────────────
/**
 * Scans a Drivers Standings sheet and returns the row bounds of every pilot
 * data section (F1, F2, and any future sections) without relying on hardcoded
 * row numbers.
 *
 * A row is considered a data row when:
 *   col A = positive integer (the rank #)
 *   col B = non-empty string that is not the column header "Piloto"
 *
 * Header rows, merged title rows, month sub-headers, and blank buffer rows all
 * fail at least one of those conditions, so they are automatically excluded.
 *
 * Returns: [ { start: N, end: M }, … ]  (1-indexed, inclusive, one entry per section)
 */
function _findDataSections(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];

  const vals = sheet.getRange(1, 1, lastRow, 2).getValues();
  const sections = [];
  let sectionStart = null;

  for (let i = 0; i < vals.length; i++) {
    const aRaw = vals[i][0];
    const bVal = String(vals[i][1] || "").trim();
    const aNum = Number(aRaw);
    const isData = aRaw !== "" && !isNaN(aNum) && Number.isInteger(aNum) && aNum > 0
                   && bVal !== "" && bVal !== "Piloto";

    if (isData && sectionStart === null) {
      sectionStart = i + 1; // convert to 1-indexed
    } else if (!isData && sectionStart !== null) {
      sections.push({ start: sectionStart, end: i }); // i is the first non-data row (1-indexed = i+1-1 = i)
      sectionStart = null;
    }
  }
  if (sectionStart !== null) {
    sections.push({ start: sectionStart, end: lastRow });
  }
  return sections;
}


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

  // Detect section boundaries dynamically — works regardless of how many
  // pilots or reserve drivers have been added to each section.
  const sections   = _findDataSections(sheet);
  const sectionIdx = sections.findIndex(s => row >= s.start && row <= s.end);
  if (sectionIdx === -1) return;

  const s = sections[sectionIdx];
  _sortSection(sheet, s.start, s.end, DS_TOTAL_COLS, 3, DS_POS_PROM_COL, DS_BEST_TIME_COL);

  // Mirror to Team Standings: section 0 → F1 teams, section 1 → F2 teams
  const tsStart = sectionIdx === 0 ? TS_F1_START : sectionIdx === 1 ? TS_F2_START : null;
  const tsEnd   = sectionIdx === 0 ? TS_F1_END   : sectionIdx === 1 ? TS_F2_END   : null;
  if (tsStart !== null) {
    _sortTeamSection("Team Standings", tsStart, tsEnd, TS_TOTAL_COLS, 6, TS_POS_PROM_COL, TS_BEST_TIME_COL);
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
    { column: sortCol,       ascending: false }, // 1st: most points
    { column: tiebreakerCol, ascending: true  }, // 2nd: lower avg position
    { column: bestTimeCol,   ascending: true  }, // 3rd: faster best lap time
  ];
  range.sort(sortSpec);

  // Batch-read pilot names and write sequential rank numbers only for
  // non-empty rows — buffer rows (empty pilot name) get their # cleared.
  const pilots = sheet.getRange(startRow, 2, numRows, 1).getValues();
  const ranks  = [];
  let rank = 1;
  for (let i = 0; i < numRows; i++) {
    ranks.push([String(pilots[i][0]).trim() !== "" ? rank++ : ""]);
  }
  sheet.getRange(startRow, 1, numRows, 1).setValues(ranks);
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

  // Batch-read team names and write sequential rank numbers only for non-empty rows
  const teams = ts.getRange(startRow, 2, numRows, 1).getValues();
  const ranks = [];
  let rank = 1;
  for (let i = 0; i < numRows; i++) {
    ranks.push([String(teams[i][0]).trim() !== "" ? rank++ : ""]);
  }
  ts.getRange(startRow, 1, numRows, 1).setValues(ranks);
}


// ─── DOTD formula setup ───────────────────────────────────────────────────────
/**
 * One-shot setup: replaces the manual value in col W (DOTD points) with a
 * COUNTIF formula that counts how many times each pilot appears in the DOTD
 * tab.  After running this, adding a new row to the DOTD sheet automatically
 * updates the pilot's W and their Puntos Totales (col C) — no manual step.
 *
 * Run once from Apps Script:
 *   Extensions → Apps Script → select setupDotdFormulas → ▶ Run
 *
 * Idempotent — safe to run multiple times.
 */
function setupDotdFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName("Drivers Standings");
  if (!ws) {
    SpreadsheetApp.getUi().alert('❌ Hoja "Drivers Standings" no encontrada.');
    return;
  }

  const sections = _findDataSections(ws);
  if (!sections.length) {
    SpreadsheetApp.getUi().alert("❌ No se encontraron secciones de datos en Drivers Standings.");
    return;
  }

  let updated = 0;

  for (const section of sections) {
    const numRows = section.end - section.start + 1;

    // Batch read: all pilot names in this section (1 API call)
    const pilots = ws.getRange(section.start, 2, numRows, 1).getValues();

    // Build the full column-W formulas array in memory
    const formulas = [];
    for (let i = 0; i < numRows; i++) {
      const pilot = String(pilots[i][0] || "").trim();
      const r     = section.start + i;
      if (pilot) {
        formulas.push([`=COUNTIF(DOTD!$B:$B;B${r})`]);
        updated++;
      } else {
        formulas.push([""]); // empty buffer row — leave blank
      }
    }

    // Batch write: entire col W for this section (1 API call)
    ws.getRange(section.start, 23, numRows, 1).setFormulas(formulas);
  }

  SpreadsheetApp.getUi().alert(
    `✅ Fórmula DOTD configurada en ${updated} pilotos.\n` +
    `Col W ahora se actualiza automáticamente desde la tab DOTD.`
  );
}


// ─── Participation points migration ───────────────────────────────────────────
/**
 * One-shot migration: rewrites the Puntos Totales formula (col C) for every
 * pilot row in Drivers Standings so that each race attended adds +1 point.
 *
 * Run once from Apps Script:
 *   Extensions → Apps Script → select addParticipationPoints → ▶ Run
 *
 * The function is idempotent — running it multiple times produces the same
 * result because it always rebuilds the formula from scratch.
 *
 * New formula per row:
 *   =SUM(E#,G#,I#,K#,M#,O#,Q#,S#)
 *   +(D#<>"")*1+(F#<>"")*1+(H#<>"")*1+(J#<>"")*1
 *   +(L#<>"")*1+(N#<>"")*1+(P#<>"")*1+(R#<>"")*1
 *
 * Covers both F1 and F2, all past and future races.
 * Reserve drivers (RD) are included — they also earn the participation point.
 */
function addParticipationPoints() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName("Drivers Standings");
  if (!ws) {
    SpreadsheetApp.getUi().alert('❌ Hoja "Drivers Standings" no encontrada.');
    return;
  }

  // Race points columns (formula-calculated from position)
  const PTS_COLS = ["E","G","I","K","M","O","Q","S"];
  // Race position columns (manually entered)
  const POS_COLS = ["D","F","H","J","L","N","P","R"];

  const sections = _findDataSections(ws);
  if (!sections.length) {
    SpreadsheetApp.getUi().alert("❌ No se encontraron secciones de datos en Drivers Standings.");
    return;
  }

  let updated = 0;

  for (const section of sections) {
    const numRows = section.end - section.start + 1;

    // Batch read: pilot names only (1 API call per section)
    const pilots = ws.getRange(section.start, 2, numRows, 1).getValues();

    // Build complete col C formulas from scratch — avoids locale mismatch
    // issues that arise from reading and modifying the existing Spanish-locale
    // formula (SUMA/semicolons vs SUM/commas expected by setFormulas).
    //
    // Formula:  =SUM(race points, W) + participation count
    //   race points = E,G,I,K,M,O,Q,S (formula per month, set by Sheets)
    //   W           = DOTD bonus (auto-COUNTIF set by setupDotdFormulas)
    //   participation = +1 for each non-empty position column D,F,H,J,L,N,P,R
    const newFormulas = [];
    for (let i = 0; i < numRows; i++) {
      const pilot = String(pilots[i][0] || "").trim();
      const r     = section.start + i;
      if (pilot) {
        const sumPart  = [...PTS_COLS, "W"].map(c => `${c}${r}`).join(";");
        const partPart = POS_COLS.map(c => `(${c}${r}<>"")*1`).join("+");
        newFormulas.push([`=SUM(${sumPart})+${partPart}`]);
        updated++;
      } else {
        newFormulas.push([""]); // buffer row — clear
      }
    }

    // Batch write: entire col C for this section (1 API call per section)
    ws.getRange(section.start, 3, numRows, 1).setFormulas(newFormulas);
  }

  SpreadsheetApp.getUi().alert(
    `✅ Fórmula actualizada en ${updated} pilotos.\n` +
    `Cada piloto recibe +1 punto por cada fecha a la que asistió.`
  );
}


// ─── Variation (Var) formula setup ────────────────────────────────────────────
/**
 * One-shot setup: writes a self-contained formula to column V (Var) for every
 * pilot row in Drivers Standings.
 *
 * "Var" = change in ranking position compared to the previous race session.
 *   Positive → moved UP the standings (e.g. +2 = gained 2 positions).
 *   Negative → moved DOWN.
 *   Zero     → no change.
 *
 * How it works (on-the-fly approach, no helper columns needed):
 *   1. Identify the most recent race a pilot competed in by checking the
 *      position columns D,F,H,J,L,N,P,R from last (Octubre) to first (Marzo).
 *   2. "Previous points" = current total (C) minus that race's position pts
 *      (col E/G/…/S) minus the 1-point participation bonus for that race.
 *   3. Compute the previous rank by counting, within the same section, how
 *      many pilots had strictly more previous points (SUMPRODUCT).
 *   4. Var = previous_rank − current_rank (col A).
 *
 * DOTD points (col W) are intentionally left in both current and previous
 * totals because DOTD awards are not tied to a single race in the formula.
 *
 * Run once from Apps Script:
 *   Extensions → Apps Script → select setupVariationFormulas → ▶ Run
 *
 * Idempotent — safe to run multiple times.
 */
function setupVariationFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName("Drivers Standings");
  if (!ws) {
    SpreadsheetApp.getUi().alert('❌ Hoja "Drivers Standings" no encontrada.');
    return;
  }

  // Race pairs in chronological order: [positionCol, pointsCol]
  const RACE_PAIRS = [
    ["D","E"], ["F","G"], ["H","I"], ["J","K"],
    ["L","M"], ["N","O"], ["P","Q"], ["R","S"]
  ];

  /**
   * Builds nested IFs so the OUTERMOST condition is the NEWEST race (Octubre),
   * falling back through earlier months.  This ensures we always pick up the
   * most recent race a pilot competed in, not the earliest.
   *
   * Strategy: iterate forward (Marzo → Octubre), wrapping each new IF around
   * the previous expression.  The last iteration (Octubre) becomes the
   * outermost IF and is therefore evaluated first by Google Sheets.
   */
  function lastContribSingle(r) {
    let f = "0";
    for (let i = 0; i < RACE_PAIRS.length; i++) {   // Marzo first → Octubre last
      const [pos, pts] = RACE_PAIRS[i];
      f = `IF(${pos}${r}<>"";${pts}${r}+1;${f})`;
    }
    return f;
  }

  /**
   * Same logic but for an entire section range (absolute rows), producing an
   * element-wise array suitable for use inside SUMPRODUCT.
   */
  function lastContribArray(sStart, sEnd) {
    let f = "0";
    for (let i = 0; i < RACE_PAIRS.length; i++) {   // Marzo first → Octubre last
      const [pos, pts] = RACE_PAIRS[i];
      f = `IF(${pos}$${sStart}:${pos}$${sEnd}<>"";${pts}$${sStart}:${pts}$${sEnd}+1;${f})`;
    }
    return f;
  }

  const sections = _findDataSections(ws);
  if (!sections.length) {
    SpreadsheetApp.getUi().alert("❌ No se encontraron secciones de datos en Drivers Standings.");
    return;
  }

  let updated = 0;

  for (const section of sections) {
    const { start: sStart, end: sEnd } = section;
    const numRows = sEnd - sStart + 1;

    // Batch read pilot names (1 API call per section)
    const pilots = ws.getRange(sStart, 2, numRows, 1).getValues();

    // Pre-build the section-wide "previous points" array expression — shared
    // by all pilots in this section, only the row suffix differs per pilot.
    const prevPtsArr = `(C$${sStart}:C$${sEnd}-${lastContribArray(sStart, sEnd)})`;

    const formulas = [];
    for (let i = 0; i < numRows; i++) {
      const pilot = String(pilots[i][0] || "").trim();
      const r = sStart + i;
      if (pilot) {
        // Number of races this pilot has attended
        const attendedCount = RACE_PAIRS.map(([pos]) => `(${pos}${r}<>"")*1`).join("+");
        // Previous points for this specific pilot row
        const myPrevPts = `(C${r}-${lastContribSingle(r)})`;
        // If the pilot has only 0 or 1 race there is no previous ranking to
        // compare to (debut), so leave Var blank.  Otherwise compute normally:
        //   Previous rank = 1 + how many section pilots had strictly more prev_pts
        //   Variation     = previous_rank − current_rank (col A)
        const formula =
          `=IF(${attendedCount}<=1;"";` +
          `1+SUMPRODUCT((${prevPtsArr}>${myPrevPts})*1)-A${r})`;
        formulas.push([formula]);
        updated++;
      } else {
        formulas.push([""]); // buffer / empty row — clear
      }
    }

    // Batch write col V (column 22) — 1 API call per section
    ws.getRange(sStart, 22, numRows, 1).setFormulas(formulas);
  }

  SpreadsheetApp.getUi().alert(
    `✅ Variación configurada en ${updated} pilotos.\n` +
    `Col V muestra el cambio de posición respecto a la carrera anterior.\n` +
    `(+) subió posiciones  |  (−) bajó  |  0 sin cambio`
  );
}


// ─── Team Standings — Participation points migration ─────────────────────────
/**
 * One-shot migration: rewrites the Puntos Totales formula (col F) for every
 * team row in Team Standings so that each race where at least one OFFICIAL
 * pilot attended adds +1 point to the team.
 *
 * Correct detection: look up each official pilot's POSITION column (not points)
 * in Drivers Standings.  A pilot who finished last scores 0 race points but
 * still has a position value ≥ 1 — checking points > 0 would miss them.
 * If VLOOKUP returns a value > 0 for col D or col E in the corresponding DS
 * section, an official pilot competed that month → +1 bonus.
 *
 * DS position column offsets (counting col B as 1):
 *   Marzo=3, Abril=5, Mayo=7, Junio=9, Julio=11, Agosto=13, Sept=15, Oct=17
 *
 * New formula per row:
 *   =SUM(G#;…;N#)
 *   + (pilot1_or_pilot2_has_Marzo_pos)*1
 *   + … × 8 months
 *
 * Run once from Apps Script:
 *   Extensions → Apps Script → select addTeamParticipationPoints → ▶ Run
 *
 * Idempotent — safe to run multiple times.
 */
function addTeamParticipationPoints() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const wsTS = ss.getSheetByName("Team Standings");
  const wsDS = ss.getSheetByName("Drivers Standings");
  if (!wsTS) {
    SpreadsheetApp.getUi().alert('❌ Hoja "Team Standings" no encontrada.');
    return;
  }
  if (!wsDS) {
    SpreadsheetApp.getUi().alert('❌ Hoja "Drivers Standings" no encontrada.');
    return;
  }

  // Monthly points columns + DS position offset (col B = offset 1)
  const RACE_MONTHS = [
    { col: "G", posOffset: 3  },  // Marzo
    { col: "H", posOffset: 5  },  // Abril
    { col: "I", posOffset: 7  },  // Mayo
    { col: "J", posOffset: 9  },  // Junio
    { col: "K", posOffset: 11 },  // Julio
    { col: "L", posOffset: 13 },  // Agosto
    { col: "M", posOffset: 15 },  // Septiembre
    { col: "N", posOffset: 17 },  // Octubre
  ];

  // Detect actual DS section bounds so the VLOOKUP range is always correct
  const dsSections = _findDataSections(wsDS);
  if (dsSections.length < 2) {
    SpreadsheetApp.getUi().alert("❌ No se encontraron las 2 secciones en Drivers Standings.");
    return;
  }

  const SECTIONS = [
    { start: TS_F1_START, end: TS_F1_END, dsStart: dsSections[0].start, dsEnd: dsSections[0].end },
    { start: TS_F2_START, end: TS_F2_END, dsStart: dsSections[1].start, dsEnd: dsSections[1].end },
  ];

  let updated = 0;

  for (const { start: sStart, end: sEnd, dsStart, dsEnd } of SECTIONS) {
    const numRows  = sEnd - sStart + 1;
    // VLOOKUP range in Drivers Standings for this category's pilots
    const dsRange  = `'Drivers Standings'!$B$${dsStart}:$S$${dsEnd}`;

    // Batch read team names from col B (Equipo)
    const teams = wsTS.getRange(sStart, 2, numRows, 1).getValues();

    const newFormulas = [];
    for (let i = 0; i < numRows; i++) {
      const team = String(teams[i][0] || "").trim();
      const r    = sStart + i;
      if (team) {
        const sumPart = RACE_MONTHS.map(({ col }) => `${col}${r}`).join(";");

        // Per month: +1 if either official pilot has a position > 0 in DS.
        // Position ≥ 1 means the pilot competed (even scoring 0 race points).
        // IFERROR returns 0 if the pilot is not found (empty seat or name mismatch).
        const partPart = RACE_MONTHS.map(({ posOffset }) => {
          const p1 = `IFERROR(VLOOKUP(D${r};${dsRange};${posOffset};FALSE);0)`;
          const p2 = `IFERROR(VLOOKUP(E${r};${dsRange};${posOffset};FALSE);0)`;
          return `((${p1}>0)+(${p2}>0)>0)*1`;
        }).join("+");

        newFormulas.push([`=SUM(${sumPart})+${partPart}`]);
        updated++;
      } else {
        newFormulas.push([""]); // empty row — clear
      }
    }

    // Batch write col F (column 6) — 1 API call per section
    wsTS.getRange(sStart, 6, numRows, 1).setFormulas(newFormulas);
  }

  SpreadsheetApp.getUi().alert(
    `✅ Participación de equipo actualizada en ${updated} equipos.\n` +
    `+1 punto por carrera donde al menos un piloto OFICIAL compitió\n` +
    `(incluyendo pilotos que terminaron últimos con 0 puntos de posición).\n` +
    `Recuerda también correr setupTeamVariationFormulas para actualizar Var.`
  );
}


// ─── Team Standings — Variation (Var) formula setup ──────────────────────────
/**
 * One-shot setup: writes the Var formula to column Q of Team Standings,
 * mirroring the same logic used for Drivers Standings.
 *
 * Differences from the Drivers version:
 *   • Each month has only ONE points column (G–N), no separate position column.
 *   • Future months are represented as 0 (not empty), so the "raced?" check
 *     uses <> 0 instead of <> "".
 *   • No participation bonus to subtract.
 *   • Total = col F  |  Rank = col A  |  Var = col Q (column 17).
 *
 * Debut guard: teams with only 1 race so far get a blank Var cell.
 *
 * Run once from Apps Script:
 *   Extensions → Apps Script → select setupTeamVariationFormulas → ▶ Run
 *
 * Idempotent — safe to run multiple times.
 */
function setupTeamVariationFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ws = ss.getSheetByName("Team Standings");
  if (!ws) {
    SpreadsheetApp.getUi().alert('❌ Hoja "Team Standings" no encontrada.');
    return;
  }

  // Monthly points columns in chronological order (G=Marzo → N=Octubre)
  const RACE_COLS = ["G","H","I","J","K","L","M","N"];

  // Fixed sections (Team Standings rows don't change dynamically)
  const SECTIONS = [
    { start: TS_F1_START, end: TS_F1_END },
    { start: TS_F2_START, end: TS_F2_END },
  ];

  /**
   * Builds nested IFs for a single row so the NEWEST month (Octubre/N) is the
   * outermost condition — checked first, falls back toward Marzo.
   * Uses <> 0 because future months hold 0, not "".
   */
  function lastContribSingle(r) {
    let f = "0";
    for (let i = 0; i < RACE_COLS.length; i++) {   // Marzo first → Octubre last
      const col = RACE_COLS[i];
      // +1 accounts for the team participation bonus added by addTeamParticipationPoints
      f = `IF(${col}${r}<>0;${col}${r}+1;${f})`;
    }
    return f;
  }

  /**
   * Same but returns an element-wise array expression for use in SUMPRODUCT.
   */
  function lastContribArray(sStart, sEnd) {
    let f = "0";
    for (let i = 0; i < RACE_COLS.length; i++) {
      const col = RACE_COLS[i];
      // +1 accounts for the team participation bonus
      f = `IF(${col}$${sStart}:${col}$${sEnd}<>0;${col}$${sStart}:${col}$${sEnd}+1;${f})`;
    }
    return f;
  }

  let updated = 0;

  for (const { start: sStart, end: sEnd } of SECTIONS) {
    const numRows = sEnd - sStart + 1;

    // Batch read team names from col B (Equipo)
    const teams = ws.getRange(sStart, 2, numRows, 1).getValues();

    // Section-wide "previous points" array (reused for every row in section)
    const prevPtsArr = `(F$${sStart}:F$${sEnd}-${lastContribArray(sStart, sEnd)})`;

    const formulas = [];
    for (let i = 0; i < numRows; i++) {
      const team = String(teams[i][0] || "").trim();
      const r = sStart + i;
      if (team) {
        // Count races with non-zero score for debut guard
        const attendedCount = RACE_COLS.map(c => `(${c}${r}<>0)*1`).join("+");
        const myPrevPts = `(F${r}-${lastContribSingle(r)})`;
        // Blank if debut (≤1 race), otherwise: prev_rank − current_rank
        const formula =
          `=IF(${attendedCount}<=1;"";` +
          `1+SUMPRODUCT((${prevPtsArr}>${myPrevPts})*1)-A${r})`;
        formulas.push([formula]);
        updated++;
      } else {
        formulas.push([""]); // empty row — clear
      }
    }

    // Batch write col Q (column 17) — 1 API call per section
    ws.getRange(sStart, 17, numRows, 1).setFormulas(formulas);
  }

  SpreadsheetApp.getUi().alert(
    `✅ Variación de equipos configurada en ${updated} equipos.\n` +
    `Col Q muestra el cambio de posición respecto a la carrera anterior.\n` +
    `(+) subió posiciones  |  (−) bajó  |  0 sin cambio`
  );
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

  // Detect F1/F2 section boundaries dynamically so the API always reflects
  // the real sheet layout regardless of how many pilots are present.
  const dsSheet  = ss.getSheetByName("Drivers Standings");
  const sections = dsSheet ? _findDataSections(dsSheet) : [];
  const f1Bounds = sections[0] || { start: DS_F1_START, end: DS_F1_END };
  const f2Bounds = sections[1] || { start: DS_F2_START, end: DS_F2_END };

  const data = {
    drivers_f1:   _getDriversStandings(ss, f1Bounds.start, f1Bounds.end, "F1"),
    drivers_f2:   _getDriversStandings(ss, f2Bounds.start, f2Bounds.end, "F2"),
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
    media:         _getMedia(ss),
    drive_images:  _getDriveImages(),
    race_months:   ["Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre"],
    updated_at:    new Date().toISOString(),
  };

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ─── Data readers ─────────────────────────────────────────────────────────────

/**
 * @param {string} category  "F1" or "F2" — used to determine which pilots are
 *   regular starters vs. reserve drivers (RDs).  A pilot who appears in this
 *   section but is NOT registered in the Equipos sheet for this category is
 *   flagged as is_reserve: true (e.g. an F2 pilot standing in for an F1 driver).
 */
function _getDriversStandings(ss, startRow, endRow, category) {
  const ws   = ss.getSheetByName("Drivers Standings");
  const rows = ws.getRange(startRow, 1, endRow - startRow + 1, DS_TOTAL_COLS).getValues();
  const months = ["Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre"];

  // Build escudería map for regular starters in this category so we can
  // (a) detect reserve drivers and (b) expose escudería in the API.
  const escuderiaMap = category ? _buildEscuderiaLookup(ss, category) : {};

  return rows
    .filter(r => r[1] && String(r[1]).trim() !== "")
    .map(r => {
      const pilot = String(r[1]).trim();
      const races = [];
      for (let i = 0; i < months.length; i++) {
        const pos = r[3 + i * 2];
        const pts = r[4 + i * 2];
        races.push({
          month: months[i],
          pos:   pos !== "" ? Number(pos) : null,
          pts:   pts !== "" ? Number(pts) : null,
        });
      }
      const escuderia  = escuderiaMap[pilot] || "RD";
      const isReserve  = !escuderiaMap[pilot];
      return {
        rank:        Number(r[0]),
        pilot,
        escuderia,
        is_reserve:  isReserve,
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
  // Read by header names when possible (robust to column shifts).
  // Rows 0-1 blank, row 2 = headers, data starts at row 3.
  const header = rows[2] || [];
  const norm = function(v) {
    return String(v || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim();
  };
  const idxByHeader = {};
  header.forEach(function(h, i) { idxByHeader[norm(h)] = i; });

  const idxRank = idxByHeader["lugar"] !== undefined ? idxByHeader["lugar"] : 2;
  const idxPilot = idxByHeader["piloto"] !== undefined ? idxByHeader["piloto"] : 3;
  const idxTime = idxByHeader["tiempo"] !== undefined ? idxByHeader["tiempo"] : 4;
  const idxVariation = idxByHeader["variacion"] !== undefined ? idxByHeader["variacion"] : 5;
  const idxDate = idxByHeader["fecha"] !== undefined ? idxByHeader["fecha"] : 5;

  return rows.slice(3)
    .map(function(r) {
      const pilot = String(r[idxPilot] || "").trim();
      if (!pilot) return null;

      const rankRaw = r[idxRank];
      const timeRaw = r[idxTime];
      const variationRaw = idxVariation < r.length ? r[idxVariation] : null;
      const dateRaw = idxDate < r.length ? r[idxDate] : null;

      let variation = null;
      if (variationRaw !== "" && variationRaw !== null && variationRaw !== undefined) {
        const v = Number(variationRaw);
        // Guard against mis-read layouts (e.g. time parsed as variation = 38.x)
        if (!isNaN(v) && Math.abs(v) <= 20) variation = v;
      }

      return {
        rank: rankRaw !== "" && rankRaw !== null && rankRaw !== undefined ? Number(rankRaw) : null,
        pilot: pilot,
        time: _toSeconds(timeRaw),
        variation: variation,
        date: dateRaw ? Utilities.formatDate(new Date(dateRaw), Session.getScriptTimeZone(), "dd/MM/yyyy") : null,
      };
    })
    .filter(r => r !== null)
    .sort((a, b) => (a.time || 999) - (b.time || 999));
}


function _toIsoDate(value) {
  if (!value) return null;

  // Native date cell
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  // Text date
  const str = String(value).trim();
  if (!str) return null;

  // dd/MM/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split("/");
    const d = Number(parts[0]);
    const m = Number(parts[1]);
    const y = Number(parts[2]);
    if (d && m && y) {
      const dt = new Date(y, m - 1, d, 12, 0, 0);
      if (!isNaN(dt.getTime())) {
        return Utilities.formatDate(dt, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
    }
  }

  // Fallback parse (e.g. Sun Apr 12 2026 ...)
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), "yyyy-MM-dd");
}


function _toSeconds(value) {
  if (value === "" || value === null || value === undefined) return null;

  if (typeof value === "number") {
    return value > 1000 ? value / 1000 : value;
  }

  const n = Number(String(value).trim().replace(",", "."));
  if (isNaN(n)) return null;
  return n > 1000 ? n / 1000 : n;
}


/**
 * Computes best/average times per pilot from race columns in "Tiempos 2026",
 * considering ONLY sessions on/after TRACK_RESET_DATE.
 *
 * Returns:
 *   { "PILOT": { best, average }, ... }
 */
function _computeResetTiemposByPilot(ss) {
  const ws = ss.getSheetByName("Tiempos 2026");
  if (!ws) return {};

  const lastRow = ws.getLastRow();
  const lastCol = ws.getLastColumn();
  if (lastRow < TIEMPOS_FIRST_DATA_ROW) return {};

  const grid = ws.getRange(1, 1, lastRow, lastCol).getValues();
  const datesRow = grid[TIEMPOS_DATE_ROW - 1] || [];

  const weeks = [];
  let col = TIEMPOS_FIRST_RACE_COL - 1; // 0-indexed
  while (col < datesRow.length) {
    const iso = _toIsoDate(datesRow[col]);
    if (iso) {
      if (iso >= TRACK_RESET_DATE) {
        weeks.push({ date: iso, c1: col, c2: col + 1 });
      }
      col += 2;
    } else {
      col += 1;
    }
  }

  const result = {};
  for (let r = TIEMPOS_FIRST_DATA_ROW - 1; r < grid.length; r++) {
    const pilot = String(grid[r][TIEMPOS_PILOT_COL - 1] || "").trim();
    if (!pilot) continue;

    let best = null;
    let sum = 0;
    let count = 0;

    weeks.forEach(function(w) {
      [w.c1, w.c2].forEach(function(c) {
        if (c >= grid[r].length) return;
        const t = _toSeconds(grid[r][c]);
        if (t === null) return;
        if (best === null || t < best) best = t;
        sum += t;
        count += 1;
      });
    });

    result[pilot] = {
      best: best,
      average: count ? (sum / count) : null,
    };
  }

  return result;
}


function _getTiempos2026(ss) {
  const byPilot = _computeResetTiemposByPilot(ss);
  return Object.keys(byPilot)
    .map(function(pilot) {
      return {
        pilot: pilot,
        best: byPilot[pilot].best,
        average: byPilot[pilot].average,
      };
    })
    .filter(function(r) { return r.best !== null; })
    .sort(function(a, b) { return (a.best || 999) - (b.best || 999); });
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

  // Use dynamic section detection so results stay correct as rows are added
  const sections = _findDataSections(ws);
  const f1Bounds = sections[0] || { start: DS_F1_START, end: DS_F1_END };
  const f2Bounds = sections[1] || { start: DS_F2_START, end: DS_F2_END };

  const f1Rows = ws.getRange(f1Bounds.start, 1, f1Bounds.end - f1Bounds.start + 1, DS_TOTAL_COLS).getValues();
  const f2Rows = ws.getRange(f2Bounds.start, 1, f2Bounds.end - f2Bounds.start + 1, DS_TOTAL_COLS).getValues();

  const escuderiaF1  = _buildEscuderiaLookup(ss, "F1");
  const escuderiaF2  = _buildEscuderiaLookup(ss, "F2");
  const tiemposMap   = _buildTiemposLookup(ss);

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
            pos:        Number(r[posColIdx]),
            pilot,
            escuderia:  lookup[pilot] || "RD",
            is_reserve: !lookup[pilot],
            pts:        r[ptsColIdx] !== "" ? Number(r[ptsColIdx]) : null,
            best_time:  tiemposMap[pilot] || tiemposMap[pilot.toLowerCase()] || null,
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


// ─── Google Drive image integration ───────────────────────────────────────────
const GKD_MEDIA_FOLDER_ID = "1tZbsg9j-TRuhAbwTvfg5aZ8sFEda83mQ";

/**
 * Scans the GKD Media Drive folder and returns:
 *   pilots  — { "nico-e": { id, original }, … }  (matched by slugified filename)
 *   teams   — { "mclaren": { id, original }, … }
 *   media   — [ { folder, files: [{id, name}] }, … ]  (all other subfolders)
 * Results are cached in CacheService for 6 hours to avoid slow Drive API calls.
 */
function _getDriveImages() {
  const cache  = CacheService.getScriptCache();
  const cached = cache.get("gkd_drive_images");
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }

  try {
    const root   = DriveApp.getFolderById(GKD_MEDIA_FOLDER_ID);
    const result = { pilots: {}, teams: {}, media: [] };
    const subs   = root.getFolders();

    while (subs.hasNext()) {
      const folder = subs.next();
      const name   = folder.getName();

      if (name === "Fotos Pilotos 2026") {
        result.pilots = _slugIndexFolder(folder);
      } else if (name === "Fotos Equipos 2026") {
        result.teams = _slugIndexFolder(folder);
      } else {
        // Race date folders (Fecha 2 [2026-04-12], Camera Tests, …) → carousel
        const files = _listImageFiles(folder);
        if (files.length) result.media.push({ folder: name, files: files });
      }
    }

    cache.put("gkd_drive_images", JSON.stringify(result), 21600); // 6 h
    return result;
  } catch(e) {
    return { pilots: {}, teams: {}, media: [], error: e.toString() };
  }
}

/**
 * Returns { "nico-e": { id: "FILE_ID", original: "NICO E - ASTON MARTIN.jpg" }, … }
 * keyed by slugified PILOT/TEAM alias extracted from the filename.
 *
 * Filename convention:  "ALIAS - CONSTRUCTOR.jpg"  OR  "ALIAS.jpg"
 * Only the part BEFORE the first " - " is used as the lookup key so that
 * "NICO E - ASTON MARTIN.jpg" maps to slug "nico-e".
 *
 * Also recurses into any direct subfolders (e.g. "PILOTOS - MODERNA" inside
 * "Fotos Pilotos 2026") so categories are handled automatically.
 */
function _slugIndexFolder(folder) {
  var map   = {};
  var mimes = [MimeType.JPEG, MimeType.PNG, "image/webp"];

  function _indexFiles(f) {
    mimes.forEach(function(mime) {
      var it = f.getFilesByType(mime);
      while (it.hasNext()) {
        var file     = it.next();
        var nameNoExt = file.getName().replace(/\.[^.]+$/, "");
        // Use only the part before the first " - " separator (pilot alias or team name)
        var base     = nameNoExt.indexOf(" - ") !== -1
          ? nameNoExt.split(" - ")[0]
          : nameNoExt;
        var slug     = base
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        if (slug) map[slug] = { id: file.getId(), original: file.getName() };
      }
    });

    // Recurse into subfolders (e.g. "PILOTOS - MODERNA" inside "Fotos Pilotos 2026")
    var subs = f.getFolders();
    while (subs.hasNext()) {
      _indexFiles(subs.next());
    }
  }

  _indexFiles(folder);
  return map;
}

/** Returns [{id, name}] for every image file in a folder (JPEG, PNG, WEBP, HEIC, HEIF). */
function _listImageFiles(folder) {
  var files = [];
  var mimes = [MimeType.JPEG, MimeType.PNG, "image/webp", "image/heic", "image/heif"];
  mimes.forEach(function(mime) {
    try {
      var it = folder.getFilesByType(mime);
      while (it.hasNext()) {
        var f = it.next();
        files.push({ id: f.getId(), name: f.getName() });
      }
    } catch(e) { /* unsupported mime type — skip */ }
  });
  return files;
}


// ─── Media sheet ──────────────────────────────────────────────────────────────
/**
 * Reads the "Media" sheet.
 * Columns: A=Tipo  B=Título  C=URL  D=Fecha
 * Tipo values: "Foto" | "YouTube" | "Instagram"
 */
function _getMedia(ss) {
  try {
    const ws = ss.getSheetByName("Media");
    if (!ws) return [];
    return ws.getDataRange().getValues().slice(1)
      .filter(r => r[0] && r[2] && String(r[0]).trim() !== "")
      .map(r => ({
        tipo:   String(r[0]).trim(),
        titulo: String(r[1]).trim(),
        url:    String(r[2]).trim(),
        fecha:  String(r[3]).trim(),
      }));
  } catch(e) {
    return [];
  }
}


function _buildTiemposLookup(ss) {
  try {
    const byPilot = _computeResetTiemposByPilot(ss);
    const map  = {};
    Object.keys(byPilot).forEach(function(pilot) {
      const best = byPilot[pilot].best;
      if (best === null) return;
      // Store with original and lowercase key for case-insensitive matching
      map[pilot] = best;
      map[pilot.toLowerCase()] = best;
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
