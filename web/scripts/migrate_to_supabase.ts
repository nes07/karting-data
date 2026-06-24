/**
 * GKD Championship — sheet → Supabase migration with parity validation.
 *
 * Usage (from web/):
 *   npx tsx scripts/migrate_to_supabase.ts --check   # offline parity check only
 *   npx tsx scripts/migrate_to_supabase.ts --seed    # parity check + write to Supabase
 *
 * Prerequisites:
 *   1. python web/scripts/export_sheet_snapshot.py   (creates sheet_snapshot.json)
 *   2. For --seed: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in web/.env.local
 *
 * The parity check recomputes every driver and team total with the SAME
 * points engine the web app uses (src/lib/scoring/engine.ts) and diffs the
 * results against the live sheet values (Drivers Standings col C, Team
 * Standings col F). Seeding is refused while any discrepancy exists.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeDriverStandings,
  computeTeamStandings,
} from "../src/lib/scoring/engine";
import {
  Category,
  ChampionshipData,
  DEFAULT_SCORING_CONFIG,
  DotdAward,
  Driver,
  Race,
  RaceResult,
  Team,
} from "../src/lib/scoring/types";

const __dir = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(__dir, "sheet_snapshot.json");

type Grid = string[][];
type Snapshot = Record<string, Grid>;

const MONTHS = [
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
];

// Drivers Standings position columns (0-indexed): D,F,H,J,L,N,P,R
const DS_POS_COLS = [3, 5, 7, 9, 11, 13, 15, 17];

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "22/03/2026" → "2026-03-22" */
function parseDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function cleanAlias(raw: string): string {
  // Drivers Standings shows reserves as "JUAN (RD)"
  return raw.replace(/\s*\(RD\)\s*$/i, "").trim();
}

function normCategory(raw: string): Category | null {
  const s = raw.trim().toUpperCase();
  if (s === "F1" || s.includes("MODERNA")) return "F1";
  if (s === "F2" || s.includes("CLÁSICA") || s.includes("CLASICA")) return "F2";
  return null;
}

/**
 * Finds contiguous data sections in Drivers Standings (port of
 * _findDataSections in APPS_SCRIPT.js): rows where col A is numeric
 * and col B has a pilot name.
 */
function findSections(grid: Grid): Array<{ start: number; end: number }> {
  const sections: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  for (let i = 0; i < grid.length; i++) {
    const rank = (grid[i][0] ?? "").trim();
    const pilot = (grid[i][1] ?? "").trim();
    const isData = rank !== "" && !Number.isNaN(Number(rank)) && pilot !== "";
    if (isData && start === null) start = i;
    if (!isData && start !== null) {
      sections.push({ start, end: i - 1 });
      start = null;
    }
  }
  if (start !== null) sections.push({ start, end: grid.length - 1 });
  return sections;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

interface Parsed extends ChampionshipData {
  /** alias → sheet total (Drivers Standings col C), per category */
  sheetDriverTotals: Record<Category, Map<string, number>>;
  /** team name → sheet total (Team Standings col F), per category */
  sheetTeamTotals: Record<Category, Map<string, number>>;
  lapTimes: Array<{ alias: string; date: string; time: number }>;
  mediaRows: Array<{ tipo: string; titulo: string; url: string; fecha: string | null }>;
  dotdReasons: Map<string, string>; // `${raceId}|${category}` → reason
}

function parse(snap: Snapshot): Parsed {
  // Keyed case-insensitively: "Javier V" (DOTD) === "JAVIER V" (standings).
  // The first-seen casing wins (Inscritos is parsed first).
  const drivers = new Map<string, Driver>(); // by UPPERCASE alias
  const idOf = (alias: string): string => {
    const a = cleanAlias(alias);
    const key = a.toUpperCase();
    if (!drivers.has(key)) {
      drivers.set(key, { id: `drv:${key}`, alias: a, active: true });
    }
    return drivers.get(key)!.id;
  };

  // Inscritos: # | Piloto | Nombre Inscrito | Correo  (data from row 2)
  for (const row of (snap["Inscritos"] ?? []).slice(1)) {
    const alias = (row[1] ?? "").trim();
    if (!alias) continue;
    idOf(alias);
    const d = drivers.get(alias.toUpperCase())!;
    d.fullName = (row[2] ?? "").trim() || null;
    d.email = (row[3] ?? "").trim() || null;
  }

  // Fecha de Carreras: month names are lowercase and column positions vary,
  // so scan each row for a cell matching a championship month followed by a
  // parseable date in a later cell. Non-championship rows (noviembre, asado…)
  // are ignored.
  const races: Race[] = [];
  const raceByMonth = new Map<string, Race>(); // canonical month label → race
  for (const row of snap["Fecha de Carreras"] ?? []) {
    for (let c = 0; c < row.length; c++) {
      const month = MONTHS.find(
        (m) => m.toLowerCase() === (row[c] ?? "").trim().toLowerCase()
      );
      if (!month || raceByMonth.has(month)) continue;
      const date = row
        .slice(c + 1)
        .map((cell) => parseDate(cell ?? ""))
        .find((d) => d != null);
      if (!date) continue;
      const race: Race = {
        id: `race:${month}`,
        date,
        monthLabel: month,
        isOfficial: true,
        startTime: "12:00:00",
      };
      races.push(race);
      raceByMonth.set(month, race);
    }
  }

  // Equipos: rows 3-10 = F1, rows 14-21 = F2 (1-indexed) → 0-indexed 2-9, 13-20
  // Cols: A Elección | B Equipo # | C Piloto1 | D t1 | E Piloto2 | F t2 | G Escudería
  const teams: Team[] = [];
  const equipos = snap["Equipos"] ?? [];
  const teamSections: Array<{ rows: [number, number]; cat: Category }> = [
    { rows: [2, 9], cat: "F1" },
    { rows: [13, 20], cat: "F2" },
  ];
  for (const { rows, cat } of teamSections) {
    for (let i = rows[0]; i <= rows[1] && i < equipos.length; i++) {
      const row = equipos[i];
      const num = (row[1] ?? "").trim();
      const p1 = (row[2] ?? "").trim();
      const p2 = (row[4] ?? "").trim();
      const esc = (row[6] ?? "").trim();
      if (!num || (!p1 && !p2)) continue;
      teams.push({
        id: `team:${cat}:${num}`,
        name: `Equipo ${num.replace(/^Equipo\s*/i, "")}`,
        escuderia: esc || "—",
        category: cat,
        driver1Id: p1 && p1 !== "TBD" ? idOf(p1) : null,
        driver2Id: p2 && p2 !== "TBD" ? idOf(p2) : null,
      });
    }
  }
  const teamByEscuderia = (cat: Category, esc: string) =>
    teams.find(
      (t) => t.category === cat && t.escuderia.toLowerCase() === esc.toLowerCase()
    ) ?? null;

  // Suplentes: Fecha | Escudería | Suplente | Posición | Categoría | Puntos (row 3+)
  // Used to attach replaced_team to reserve results.
  const reserveKey = (cat: Category, month: string, alias: string) =>
    `${cat}|${month}|${alias}`;
  const reserveTeam = new Map<string, string>(); // key → teamId
  for (const row of (snap["Suplentes"] ?? []).slice(2)) {
    const month = (row[0] ?? "").trim();
    const esc = (row[1] ?? "").trim();
    const alias = cleanAlias(row[2] ?? "");
    const cat = normCategory(row[4] ?? "");
    if (!month || !esc || !alias || !cat) continue;
    const team = teamByEscuderia(cat, esc);
    if (team) reserveTeam.set(reserveKey(cat, month, alias), team.id);
  }

  // Drivers Standings: dynamic sections (F1 first, F2 second).
  const ds = snap["Drivers Standings"] ?? [];
  const sections = findSections(ds);
  if (sections.length < 2) {
    throw new Error(
      `Expected 2 sections in Drivers Standings, found ${sections.length}`
    );
  }

  const results: RaceResult[] = [];
  const sheetDriverTotals: Record<Category, Map<string, number>> = {
    F1: new Map(),
    F2: new Map(),
  };

  const officialIds: Record<Category, Set<string>> = { F1: new Set(), F2: new Set() };
  for (const t of teams) {
    for (const id of [t.driver1Id, t.driver2Id]) {
      if (id) officialIds[t.category].add(id);
    }
  }

  (["F1", "F2"] as Category[]).forEach((cat, si) => {
    const { start, end } = sections[si];
    for (let i = start; i <= end; i++) {
      const row = ds[i];
      const alias = cleanAlias(row[1] ?? "");
      if (!alias) continue;
      const driverId = idOf(alias);
      const total = parseNum(row[2] ?? "");
      if (total != null) sheetDriverTotals[cat].set(alias, total);

      DS_POS_COLS.forEach((col, mi) => {
        const pos = parseNum(row[col] ?? "");
        if (pos == null) return;
        const month = MONTHS[mi];
        const race = raceByMonth.get(month);
        if (!race) throw new Error(`No race date for month ${month}`);
        const isReserve = !officialIds[cat].has(driverId);
        results.push({
          raceId: race.id,
          driverId,
          category: cat,
          position: pos,
          bestTime: null,
          isReserve,
          replacedTeamId: isReserve
            ? reserveTeam.get(reserveKey(cat, month, alias)) ?? null
            : null,
        });
      });
    }
  });

  // Validate: every reserve result must map to a replaced team.
  const orphanReserves = results.filter((r) => r.isReserve && !r.replacedTeamId);
  if (orphanReserves.length > 0) {
    const detail = orphanReserves
      .map((r) => {
        const alias = [...drivers.values()].find((d) => d.id === r.driverId)?.alias;
        return `  - ${alias} (${r.category}, ${r.raceId})`;
      })
      .join("\n");
    throw new Error(
      `Reserve results without a matching Suplentes row (cannot determine replaced team):\n${detail}`
    );
  }

  // Team Standings sheet totals: rows 3-10 F1, 14-21 F2 (1-indexed); col B name, col F total.
  const ts = snap["Team Standings"] ?? [];
  const sheetTeamTotals: Record<Category, Map<string, number>> = {
    F1: new Map(),
    F2: new Map(),
  };
  for (const { rows, cat } of teamSections) {
    for (let i = rows[0]; i <= rows[1] && i < ts.length; i++) {
      const name = (ts[i][1] ?? "").trim();
      const total = parseNum(ts[i][5] ?? "");
      if (name && total != null) {
        sheetTeamTotals[cat].set(name.replace(/^Equipo\s*/i, "Equipo "), total);
      }
    }
  }

  // DOTD: Fecha | Piloto | Categoría | Razón (row 3+; Fecha = month or date)
  const dotd: DotdAward[] = [];
  const dotdReasons = new Map<string, string>();
  for (const row of (snap["DOTD"] ?? []).slice(2)) {
    const fecha = (row[0] ?? "").trim();
    const alias = cleanAlias(row[1] ?? "");
    const cat = normCategory(row[2] ?? "");
    if (!fecha || !alias || !cat) continue;
    const race =
      raceByMonth.get(fecha) ??
      races.find((r) => r.date === parseDate(fecha)) ??
      null;
    if (!race) throw new Error(`DOTD row with unrecognized Fecha: "${fecha}"`);
    dotd.push({ raceId: race.id, driverId: idOf(alias), category: cat });
    const reason = (row[3] ?? "").trim();
    if (reason) dotdReasons.set(`${race.id}|${cat}`, reason);
  }

  // Media: title row, then header row, then data (row 3+)
  const mediaRows = (snap["Media"] ?? [])
    .slice(2)
    .filter((r) => (r[0] ?? "").trim() && (r[2] ?? "").trim())
    .map((r) => ({
      tipo: r[0].trim(),
      titulo: (r[1] ?? "").trim(),
      url: r[2].trim(),
      fecha: parseDate(r[3] ?? ""),
    }));

  // Tiempos 2026: row 2 dates (1-indexed) at first col of each race pair from col S (19).
  // Pilots in col C from row 4. Best of the pair per date.
  const tiempos = snap["Tiempos 2026"] ?? [];
  const lapTimes: Array<{ alias: string; date: string; time: number }> = [];
  if (tiempos.length > 3) {
    const dateRow = tiempos[1] ?? [];
    const dateCols: Array<{ col: number; date: string }> = [];
    for (let c = 18; c < dateRow.length; c++) {
      const d = parseDate(dateRow[c] ?? "");
      if (d) dateCols.push({ col: c, date: d });
    }
    for (let i = 3; i < tiempos.length; i++) {
      const alias = cleanAlias(tiempos[i][2] ?? "");
      if (!alias) continue;
      for (const { col, date } of dateCols) {
        const t1 = parseNum(tiempos[i][col] ?? "");
        const t2 = parseNum(tiempos[i][col + 1] ?? "");
        const best = [t1, t2].filter((x): x is number => x != null && x > 0);
        if (best.length > 0) {
          lapTimes.push({ alias, date, time: Math.min(...best) });
        }
      }
    }
  }

  return {
    drivers: [...drivers.values()],
    teams,
    races,
    results,
    dotd,
    penalties: [],
    config: DEFAULT_SCORING_CONFIG,
    sheetDriverTotals,
    sheetTeamTotals,
    lapTimes,
    mediaRows,
    dotdReasons,
  };
}

// ── Parity check ─────────────────────────────────────────────────────────────

/**
 * Documented errors in the live sheet, confirmed by the championship admin.
 * When engine and sheet disagree, these entries assert the ENGINE value is
 * the correct one (the sheet itself is wrong).
 *
 * Mayo F2: the Suplentes tab swapped FRANCISCO K (real P9) and CHAPARRO
 * (real P4), so the sheet credits BMW +2.5 team pts too many and Brabham
 * 2.5 too few. Drivers Standings has the correct positions.
 */
const KNOWN_SHEET_ERRORS: Array<{
  kind: "team" | "driver";
  category: Category;
  name: string;
  sheetValue: number;
  correctValue: number;
}> = [
  { kind: "team", category: "F2", name: "Equipo 3", sheetValue: 52, correctValue: 49.5 },
  { kind: "team", category: "F2", name: "Equipo 7", sheetValue: 75, correctValue: 77.5 },
];

function knownError(
  kind: "team" | "driver",
  category: Category,
  name: string,
  sheetValue: number,
  engineValue: number
): boolean {
  return KNOWN_SHEET_ERRORS.some(
    (e) =>
      e.kind === kind &&
      e.category === category &&
      e.name === name &&
      Math.abs(e.sheetValue - sheetValue) < 1e-9 &&
      Math.abs(e.correctValue - engineValue) < 1e-9
  );
}

function parityCheck(p: Parsed): boolean {
  let diffs = 0;

  for (const cat of ["F1", "F2"] as Category[]) {
    const computed = computeDriverStandings(p, cat);
    console.log(`\n── Drivers ${cat} ──`);
    for (const row of computed) {
      const sheetTotal = p.sheetDriverTotals[cat].get(row.alias);
      if (sheetTotal == null) {
        console.log(`  ⚠ ${row.alias}: not found in sheet`);
        diffs++;
      } else if (Math.abs(sheetTotal - row.totalPoints) > 1e-9) {
        console.log(
          `  ✗ ${row.alias}: engine=${row.totalPoints} sheet=${sheetTotal}`
        );
        diffs++;
      }
    }
    const onlySheet = [...p.sheetDriverTotals[cat].keys()].filter(
      (a) => !computed.some((r) => r.alias === a)
    );
    for (const a of onlySheet) {
      console.log(`  ⚠ ${a}: in sheet but engine produced no row`);
      diffs++;
    }
    if (diffs === 0) console.log(`  ✓ all ${computed.length} drivers match`);

    const computedTeams = computeTeamStandings(p, cat);
    console.log(`── Teams ${cat} ──`);
    for (const row of computedTeams) {
      const sheetTotal = p.sheetTeamTotals[cat].get(row.name);
      if (sheetTotal == null) {
        console.log(`  ⚠ ${row.name}: not found in sheet`);
        diffs++;
      } else if (Math.abs(sheetTotal - row.totalPoints) > 1e-9) {
        if (knownError("team", cat, row.name, sheetTotal, row.totalPoints)) {
          console.log(
            `  ☑ ${row.name}: engine=${row.totalPoints} differs from sheet=${sheetTotal} ` +
              `(documented sheet error — engine value is correct)`
          );
        } else {
          console.log(
            `  ✗ ${row.name}: engine=${row.totalPoints} sheet=${sheetTotal}`
          );
          diffs++;
        }
      }
    }
    if (diffs === 0) console.log(`  ✓ all ${computedTeams.length} teams match`);
  }

  console.log(
    diffs === 0
      ? "\n✅ PARITY OK — engine reproduces the sheet exactly."
      : `\n❌ ${diffs} discrepancies — fix before seeding.`
  );
  return diffs === 0;
}

// ── Seeding ──────────────────────────────────────────────────────────────────

async function seed(p: Parsed): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (web/.env.local)"
    );
  }
  const db = createClient(url, key);

  const fail = (step: string, error: unknown) => {
    throw new Error(`${step}: ${JSON.stringify(error)}`);
  };

  // Drivers
  const { data: drv, error: e1 } = await db
    .from("drivers")
    .upsert(
      p.drivers.map((d) => ({
        alias: d.alias,
        full_name: d.fullName ?? null,
        email: d.email ?? null,
        active: true,
      })),
      { onConflict: "alias" }
    )
    .select("id, alias");
  if (e1) fail("drivers", e1);
  const driverDbId = new Map(drv!.map((d) => [d.alias, d.id]));
  const toDbDriver = (localId: string) => {
    const alias = p.drivers.find((d) => d.id === localId)!.alias;
    return driverDbId.get(alias)!;
  };

  // Races
  const { data: rcs, error: e2 } = await db
    .from("races")
    .upsert(
      p.races.map((r) => ({
        date: r.date,
        month_label: r.monthLabel,
        is_official: true,
        start_time: r.startTime,
      })),
      { onConflict: "date" }
    )
    .select("id, month_label");
  if (e2) fail("races", e2);
  const raceDbId = new Map(rcs!.map((r) => [r.month_label, r.id]));
  const toDbRace = (localId: string) => {
    const month = p.races.find((r) => r.id === localId)!.monthLabel;
    return raceDbId.get(month)!;
  };

  // Teams
  const { data: tms, error: e3 } = await db
    .from("teams")
    .upsert(
      p.teams.map((t) => ({
        name: t.name,
        escuderia: t.escuderia,
        category: t.category,
        driver1_id: t.driver1Id ? toDbDriver(t.driver1Id) : null,
        driver2_id: t.driver2Id ? toDbDriver(t.driver2Id) : null,
      })),
      { onConflict: "name,category" }
    )
    .select("id, name, category");
  if (e3) fail("teams", e3);
  const teamDbId = new Map(tms!.map((t) => [`${t.category}:${t.name}`, t.id]));
  const toDbTeam = (localId: string) => {
    const t = p.teams.find((x) => x.id === localId)!;
    return teamDbId.get(`${t.category}:${t.name}`)!;
  };

  // Race results
  const { error: e4 } = await db.from("race_results").upsert(
    p.results.map((r) => ({
      race_id: toDbRace(r.raceId),
      driver_id: toDbDriver(r.driverId),
      category: r.category,
      position: r.position,
      best_time: r.bestTime ?? null,
      is_reserve: r.isReserve,
      replaced_team_id: r.replacedTeamId ? toDbTeam(r.replacedTeamId) : null,
    })),
    { onConflict: "race_id,driver_id,category" }
  );
  if (e4) fail("race_results", e4);

  // DOTD
  const { error: e5 } = await db.from("dotd").upsert(
    p.dotd.map((d) => ({
      race_id: toDbRace(d.raceId),
      driver_id: toDbDriver(d.driverId),
      category: d.category,
      reason: p.dotdReasons.get(`${d.raceId}|${d.category}`) ?? null,
    })),
    { onConflict: "race_id,category" }
  );
  if (e5) fail("dotd", e5);

  // Lap times
  const { error: e6 } = await db.from("lap_times").upsert(
    p.lapTimes
      .filter((l) => driverDbId.has(l.alias))
      .map((l) => ({
        driver_id: driverDbId.get(l.alias)!,
        session_date: l.date,
        best_time: l.time,
      })),
    { onConflict: "driver_id,session_date" }
  );
  if (e6) fail("lap_times", e6);

  // Media
  if (p.mediaRows.length > 0) {
    const { error: e7 } = await db.from("media").insert(
      p.mediaRows.map((m) => ({
        tipo: m.tipo,
        titulo: m.titulo,
        url: m.url,
        fecha: m.fecha,
      }))
    );
    if (e7) fail("media", e7);
  }

  console.log(
    `\n✅ Seeded: ${p.drivers.length} drivers, ${p.teams.length} teams, ` +
      `${p.races.length} races, ${p.results.length} results, ` +
      `${p.dotd.length} DOTD, ${p.lapTimes.length} lap times, ` +
      `${p.mediaRows.length} media`
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mode = process.argv[2];
  if (mode !== "--check" && mode !== "--seed") {
    console.error("Usage: tsx scripts/migrate_to_supabase.ts --check | --seed");
    process.exit(1);
  }

  const snap: Snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
  const parsed = parse(snap);
  console.log(
    `Parsed: ${parsed.drivers.length} drivers, ${parsed.teams.length} teams, ` +
      `${parsed.races.length} races, ${parsed.results.length} results, ` +
      `${parsed.dotd.length} DOTD awards, ${parsed.lapTimes.length} lap times`
  );

  const ok = parityCheck(parsed);
  if (!ok) process.exit(2);

  if (mode === "--seed") await seed(parsed);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
