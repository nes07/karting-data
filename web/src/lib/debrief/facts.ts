import {
  computeDriverStandings,
  computeTeamStandings,
  positionPoints,
} from "@/lib/scoring/engine";
import type {
  Category,
  ChampionshipData,
  DriverStandingRow,
  TeamStandingRow,
} from "@/lib/scoring/types";
import { positionsGained } from "@/lib/positions-gained";
import { computeVueltaRapida, type LapTimeInput } from "@/lib/vuelta-rapida";
import { sliceChampionship } from "./slice";
import type {
  BattleFact,
  CatFacts,
  DebriefFacts,
  FormFact,
  NamedRef,
  ResultFact,
  StandingFact,
  VrMove,
} from "./types";

const FORM_THRESHOLD = 3;
const VR_BIG = 2;

function photosOf(data: ChampionshipData): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const d of data.drivers) m.set(d.alias, d.photoUrl ?? null);
  for (const t of data.teams) {
    if (t.photoUrl && !m.has(t.escuderia)) m.set(t.escuderia, t.photoUrl);
  }
  return m;
}

function named(
  alias: string,
  escuderia: string,
  photos: Map<string, string | null>
): NamedRef {
  return { alias, escuderia, photo: photos.get(alias) ?? null };
}

function officialRoundNumber(data: ChampionshipData, raceId: string): number {
  const official = [...data.races]
    .filter((r) => r.isOfficial)
    .sort((a, b) => a.date.localeCompare(b.date));
  const i = official.findIndex((r) => r.id === raceId);
  return i >= 0 ? i + 1 : 1;
}

function driverEsc(
  data: ChampionshipData,
  cat: Category,
  driverId: string,
  teamId: string | null | undefined,
  isReserve: boolean
): string {
  if (isReserve) return "RD";
  const byTeam = new Map(data.teams.map((t) => [t.id, t.escuderia]));
  if (teamId && byTeam.has(teamId)) return byTeam.get(teamId)!;
  const team = data.teams.find(
    (t) =>
      t.category === cat && (t.driver1Id === driverId || t.driver2Id === driverId)
  );
  return team?.escuderia ?? "—";
}

function resultFacts(
  data: ChampionshipData,
  raceId: string,
  cat: Category,
  photos: Map<string, string | null>
): ResultFact[] {
  const aliasById = new Map(data.drivers.map((d) => [d.id, d.alias]));
  return data.results
    .filter((r) => r.raceId === raceId && r.category === cat)
    .sort((a, b) => a.position - b.position)
    .map((r) => {
      const alias = aliasById.get(r.driverId) ?? "?";
      const esc = driverEsc(data, cat, r.driverId, r.teamId, r.isReserve);
      return {
        ...named(alias, esc, photos),
        pos: r.position,
        grid: r.gridPosition ?? null,
        gained: positionsGained(r.gridPosition, r.position),
        time: r.bestTime ?? null,
        pts: r.isDnf ? 0 : positionPoints(r.position, cat, data.config),
        dnf: r.isDnf ?? false,
      };
    });
}

function formFacts(
  before: ChampionshipData,
  cat: Category,
  results: ResultFact[],
  photos: Map<string, string | null>
): { up: FormFact[]; down: FormFact[] } {
  const rows = computeDriverStandings(before, cat);
  const byAlias = new Map(rows.map((r) => [r.alias, r]));
  const out: FormFact[] = [];
  for (const r of results) {
    const prev = byAlias.get(r.alias);
    const cells = prev?.races.filter((c) => !c.dnf) ?? [];
    if (cells.length < 2) continue;
    const avg = cells.reduce((s, c) => s + c.position, 0) / cells.length;
    const delta = avg - r.pos; // positive = better than average
    out.push({
      ...named(r.alias, r.escuderia, photos),
      thisPos: r.pos,
      avgPos: Number(avg.toFixed(1)),
      delta: Number(delta.toFixed(1)),
      racesBefore: cells.length,
    });
  }
  const up = out.filter((f) => f.delta >= FORM_THRESHOLD).sort((a, b) => b.delta - a.delta);
  const down = out
    .filter((f) => f.delta <= -FORM_THRESHOLD)
    .sort((a, b) => a.delta - b.delta);
  return { up, down };
}

function standingFactsFrom(
  now: Array<{ alias: string; escuderia: string; rank: number; totalPoints: number }>,
  prev: Array<{ alias: string; rank: number; totalPoints: number }>,
  photos: Map<string, string | null>
): StandingFact[] {
  const prevBy = new Map(prev.map((r) => [r.alias, r]));
  const leaderPts = now[0]?.totalPoints ?? 0;
  return now.map((r) => {
    const p = prevBy.get(r.alias);
    return {
      ...named(r.alias, r.escuderia, photos),
      rank: r.rank,
      pts: r.totalPoints,
      prevRank: p?.rank ?? null,
      prevPts: p?.totalPoints ?? null,
      gapToLeader: Number((leaderPts - r.totalPoints).toFixed(1)),
    };
  });
}

function driverStandings(
  now: DriverStandingRow[],
  prev: DriverStandingRow[],
  photos: Map<string, string | null>
): StandingFact[] {
  return standingFactsFrom(now, prev, photos);
}

function teamStandings(
  now: TeamStandingRow[],
  prev: TeamStandingRow[],
  photos: Map<string, string | null>
): StandingFact[] {
  const toAlias = (r: TeamStandingRow) => ({
    alias: r.escuderia,
    escuderia: r.escuderia,
    rank: r.rank,
    totalPoints: r.totalPoints,
  });
  return standingFactsFrom(now.map(toAlias), prev.map(toAlias), photos);
}

function battles(rows: StandingFact[], prev: StandingFact[]): BattleFact[] {
  const prevBy = new Map(prev.map((r) => [r.alias, r]));
  const out: BattleFact[] = [];
  for (let i = 0; i < Math.min(rows.length - 1, 8); i++) {
    const a = rows[i];
    const b = rows[i + 1];
    const gapAfter = Number((a.pts - b.pts).toFixed(1));
    const pa = prevBy.get(a.alias);
    const pb = prevBy.get(b.alias);
    const gapBefore =
      pa != null && pb != null ? Number((pa.pts - pb.pts).toFixed(1)) : null;
    if (gapAfter > 16 && (gapBefore == null || Math.abs(gapAfter - gapBefore) < 2)) {
      continue;
    }
    let note: string;
    if (gapBefore == null) {
      note = `Quedan a ${gapAfter} pts.`;
    } else if (gapAfter < gapBefore) {
      note = `La diferencia se achicó de ${gapBefore} a ${gapAfter} pts.`;
    } else if (gapAfter > gapBefore) {
      note = `La diferencia se abrió de ${gapBefore} a ${gapAfter} pts.`;
    } else {
      note = `Siguen separados por ${gapAfter} pts.`;
    }
    out.push({ a: a.alias, b: b.alias, gapBefore, gapAfter, note });
  }
  return out.slice(0, 4);
}

function catFacts(
  data: ChampionshipData,
  raceId: string,
  cat: Category,
  photos: Map<string, string | null>
): CatFacts {
  const race = data.races.find((r) => r.id === raceId)!;
  const after = sliceChampionship(data, race.date, true);
  const before = sliceChampionship(data, race.date, false);
  const results = resultFacts(data, raceId, cat, photos);
  const form = formFacts(before, cat, results, photos);
  const driversNow = computeDriverStandings(after, cat);
  const driversPrev = computeDriverStandings(before, cat);
  const teamsNow = computeTeamStandings(after, cat);
  const teamsPrev = computeTeamStandings(before, cat);
  const drivers = driverStandings(driversNow, driversPrev, photos);
  const teams = teamStandings(teamsNow, teamsPrev, photos);
  const gainers = [...results]
    .filter((r) => (r.gained ?? 0) >= 2)
    .sort((a, b) => (b.gained ?? 0) - (a.gained ?? 0));
  const losers = [...results]
    .filter((r) => (r.gained ?? 0) <= -2)
    .sort((a, b) => (a.gained ?? 0) - (b.gained ?? 0));
  return {
    category: cat,
    winner: results[0] ?? null,
    podium: results.filter((r) => r.pos <= 3),
    results,
    gainers,
    losers,
    formUp: form.up,
    formDown: form.down,
    drivers,
    teams,
    battles: battles(drivers, driverStandings(driversPrev, [], photos)),
    teamBattles: battles(teams, teamStandings(teamsPrev, [], photos)),
  };
}

function vrMoves(
  laps: LapTimeInput[],
  aliasById: Map<string, string>,
  photos: Map<string, string | null>,
  raceDate: string
): { big: VrMove[]; small: VrMove[] } {
  const before = computeVueltaRapida(
    laps.filter((l) => l.session_date < raceDate),
    aliasById
  );
  const after = computeVueltaRapida(
    laps.filter((l) => l.session_date <= raceDate),
    aliasById
  );
  const prevRank = new Map(before.map((r) => [r.alias, r.rank]));
  const moves: VrMove[] = [];
  for (const row of after) {
    if (row.date !== raceDate) continue;
    const from = prevRank.get(row.alias) ?? null;
    const deltaRank = from != null ? from - row.rank : null;
    moves.push({
      alias: row.alias,
      photo: photos.get(row.alias) ?? null,
      from,
      to: row.rank,
      time: row.time,
      deltaRank,
    });
  }
  const big = moves
    .filter(
      (m) =>
        (m.deltaRank != null && Math.abs(m.deltaRank) >= VR_BIG) ||
        (m.from == null && m.to <= 20)
    )
    .sort((a, b) => Math.abs(b.deltaRank ?? 0) - Math.abs(a.deltaRank ?? 0));
  const small = moves
    .filter((m) => m.deltaRank === 1 || m.deltaRank === -1)
    .sort((a, b) => (b.deltaRank ?? 0) - (a.deltaRank ?? 0));
  return { big, small };
}

export function buildDebriefFacts(
  data: ChampionshipData,
  raceId: string,
  laps: LapTimeInput[]
): DebriefFacts | null {
  const race = data.races.find((r) => r.id === raceId);
  if (!race) return null;
  const hasResults = data.results.some((r) => r.raceId === raceId);
  if (!hasResults) return null;
  const photos = photosOf(data);
  const aliasById = new Map(data.drivers.map((d) => [d.id, d.alias]));
  return {
    raceId,
    date: race.date,
    monthLabel: race.monthLabel,
    roundNumber: officialRoundNumber(data, raceId),
    F1: catFacts(data, raceId, "F1", photos),
    F2: catFacts(data, raceId, "F2", photos),
    vr: vrMoves(laps, aliasById, photos, race.date),
  };
}
