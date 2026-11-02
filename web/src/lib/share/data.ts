/**
 * Pure selectors that shape championship data into share-image payloads.
 * Kept free of JSX/IO so they are unit-testable with vitest.
 */
import { positionPoints } from "@/lib/scoring/engine";
import { positionsGained } from "@/lib/positions-gained";
import type {
  Category,
  ChampionshipData,
  DriverStandingRow,
  TeamStandingRow,
} from "@/lib/scoring/types";
import type { VueltaRapidaRow } from "@/lib/vuelta-rapida";

export type ShareFormat = "story" | "post";

export const SHARE_SIZES: Record<ShareFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
};

/** Max table rows in a single image (podium renders separately on generic shares). */
export const MAX_TABLE_ROWS: Record<ShareFormat, number> = {
  story: 16,
  post: 10,
};

/**
 * Highlighted drivers/teams inside this rank stay in the top-of-table view.
 * Outside it, the image shows podium + a context window around the target.
 */
export const HIGHLIGHT_TOP = 10;

export interface ShareRow {
  rank: number;
  label: string;
  escuderia: string | null;
  /** Right column: points or lap time, already formatted. */
  value: string;
  photo: string | null;
  variation: number | null;
  highlighted: boolean;
  /** Gap to the leader for time rankings, e.g. "+0.287" (null elsewhere). */
  gap?: string | null;
  /** Optional trailing column (e.g. round points next to lap time). */
  extra?: string | null;
}

export interface StandingsShare {
  title: string;
  subtitle: string;
  valueLabel: string;
  /** Header for the name column: PILOTO or EQUIPO. */
  labelHeader: string;
  rows: ShareRow[];
  /** Featured row when sharing a single driver/team position. */
  highlight: ShareRow | null;
  /** True when rows were truncated to fit the format. */
  truncated: boolean;
}

export function fmtShareTime(t: number | null | undefined): string {
  if (t == null || t >= 999) return "—";
  return Number(t).toFixed(3);
}

export function fmtSharePts(p: number | null | undefined): string {
  if (p == null) return "—";
  return String(p);
}

/**
 * Single-image row picker.
 *
 * - No highlight / highlight inside HIGHLIGHT_TOP: head of the table (top 10
 *   post, top 16 story).
 * - Highlight outside the top 10: podium (1–3) + a symmetric window around
 *   the target filling the remaining slots (edges fill toward the available side).
 */
export function selectRowsWithContext<T extends { rank: number }>(
  rows: T[],
  highlightRank: number | null,
  max: number,
  topCutoff = HIGHLIGHT_TOP
): { rows: T[]; truncated: boolean } {
  if (rows.length <= max) return { rows, truncated: false };

  if (highlightRank == null || highlightRank <= topCutoff) {
    return { rows: rows.slice(0, max), truncated: true };
  }

  const podium = rows.filter((r) => r.rank <= 3);
  const restBudget = Math.max(1, max - podium.length);
  const candidates = rows.filter((r) => r.rank > 3);
  const center = candidates.findIndex((r) => r.rank === highlightRank);
  if (center < 0) return { rows: rows.slice(0, max), truncated: true };

  let lo = center;
  let hi = center;
  while (hi - lo + 1 < restBudget) {
    const leftRoom = lo > 0;
    const rightRoom = hi < candidates.length - 1;
    if (!leftRoom && !rightRoom) break;
    const leftDist = center - lo;
    const rightDist = hi - center;
    if (leftRoom && (!rightRoom || leftDist <= rightDist)) lo -= 1;
    else hi += 1;
  }

  return {
    rows: [...podium, ...candidates.slice(lo, hi + 1)],
    truncated: true,
  };
}

export function buildDriversShare(
  rows: DriverStandingRow[],
  cat: Category,
  photos: Record<string, string>,
  format: ShareFormat,
  highlightAlias?: string | null
): StandingsShare {
  const all: ShareRow[] = rows.map((r) => ({
    rank: r.rank,
    label: r.alias,
    escuderia: r.escuderia,
    value: fmtSharePts(r.totalPoints),
    photo: photos[r.alias] ?? null,
    variation: r.variation ?? null,
    highlighted: highlightAlias != null && r.alias === highlightAlias,
  }));
  const highlight = all.find((r) => r.highlighted) ?? null;
  const picked = selectRowsWithContext(all, highlight?.rank ?? null, MAX_TABLE_ROWS[format]);
  return {
    title: "STANDINGS",
    subtitle: `PILOTOS ${cat}`,
    valueLabel: "PTS",
    labelHeader: "PILOTO",
    rows: picked.rows,
    highlight,
    truncated: picked.truncated,
  };
}

export function buildTeamsShare(
  rows: TeamStandingRow[],
  cat: Category,
  teamPhotos: Record<string, string>,
  format: ShareFormat,
  highlightTeam?: string | null
): StandingsShare {
  const all: ShareRow[] = rows.map((r) => ({
    rank: r.rank,
    label: r.escuderia,
    escuderia: r.escuderia,
    value: fmtSharePts(r.totalPoints),
    photo: teamPhotos[r.escuderia] ?? null,
    variation: r.variation ?? null,
    highlighted: highlightTeam != null && r.escuderia === highlightTeam,
  }));
  const highlight = all.find((r) => r.highlighted) ?? null;
  const picked = selectRowsWithContext(all, highlight?.rank ?? null, MAX_TABLE_ROWS[format]);
  return {
    title: "STANDINGS",
    subtitle: `EQUIPOS ${cat}`,
    valueLabel: "PTS",
    labelHeader: "EQUIPO",
    rows: picked.rows,
    highlight,
    truncated: picked.truncated,
  };
}

export function buildVrShare(
  rows: VueltaRapidaRow[],
  photos: Record<string, string>,
  escuderias: Record<string, string>,
  format: ShareFormat,
  highlightAlias?: string | null
): StandingsShare {
  const leaderTime = rows.find((r) => r.rank === 1)?.time ?? null;
  const all: ShareRow[] = rows.map((r) => ({
    rank: r.rank,
    label: r.alias,
    escuderia: escuderias[r.alias] ?? null,
    value: fmtShareTime(r.time),
    photo: photos[r.alias] ?? null,
    variation: r.variation,
    highlighted: highlightAlias != null && r.alias === highlightAlias,
    gap:
      r.rank === 1
        ? "—"
        : leaderTime != null
          ? `+${(r.time - leaderTime).toFixed(3)}`
          : null,
  }));
  const highlight = all.find((r) => r.highlighted) ?? null;
  const picked = selectRowsWithContext(all, highlight?.rank ?? null, MAX_TABLE_ROWS[format]);
  return {
    title: "VUELTA RÁPIDA",
    subtitle: "RANKING GKD",
    valueLabel: "TIEMPO",
    labelHeader: "PILOTO",
    rows: picked.rows,
    highlight,
    truncated: picked.truncated,
  };
}

export interface DriverProfileShare {
  alias: string;
  photo: string | null;
  escuderia: string | null;
  category: Category;
  categoryLabel: string;
  champRank: number;
  /** Rank change vs previous race, null on debut. */
  variation: number | null;
  totalPoints: string;
  bestTime: string;
  /** Rank in the Vuelta Rápida standings, or null when no laps recorded. */
  vrRank: number | null;
  vrLabel: string | null;
  /** Positions gained in the latest official race the driver contested. */
  positionsGained: number | null;
}

function ordinalEs(n: number): string {
  if (n === 1) return "1er";
  if (n === 3) return "3er";
  return `${n}º`;
}

export function lastOfficialPositionsGained(
  data: ChampionshipData,
  driverId: string
): number | null {
  const official = [...data.races]
    .filter((r) => r.isOfficial)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const race of official) {
    const res = data.results.find(
      (r) => r.raceId === race.id && r.driverId === driverId
    );
    if (res) return positionsGained(res.gridPosition, res.position);
  }
  return null;
}

export function buildDriverProfile(
  driversF1: DriverStandingRow[],
  driversF2: DriverStandingRow[],
  vueltaRapida: VueltaRapidaRow[],
  photos: Record<string, string>,
  alias: string,
  data?: ChampionshipData
): DriverProfileShare | null {
  const inF1 = driversF1.find((d) => d.alias === alias);
  const inF2 = driversF2.find((d) => d.alias === alias);
  const row = inF1 ?? inF2;
  if (!row) return null;
  const category: Category = inF1 ? "F1" : "F2";
  const vr = vueltaRapida.find((v) => v.alias === alias) ?? null;
  return {
    alias,
    photo: photos[alias] ?? null,
    escuderia: row.escuderia === "RD" ? null : row.escuderia,
    category,
    categoryLabel: category === "F1" ? "F1 MODERNA" : "F1 CLÁSICA",
    champRank: row.rank,
    variation: row.variation ?? null,
    totalPoints: fmtSharePts(row.totalPoints),
    bestTime: fmtShareTime(vr?.time ?? row.bestTime),
    vrRank: vr?.rank ?? null,
    vrLabel: vr ? `${ordinalEs(vr.rank)} mejor tiempo GKD` : null,
    positionsGained: data ? lastOfficialPositionsGained(data, row.driverId) : null,
  };
}

export interface RoundShareRow {
  pos: number;
  alias: string;
  escuderia: string;
  photo: string | null;
  time: string;
  /** Gap vs the round's best lap, e.g. "+0.360"; "+0.000" for the best. */
  dif: string;
  pts: number;
  /** Positions gained vs qualifying grid. */
  gained: number | null;
}

export interface RoundShare {
  monthLabel: string;
  date: string;
  category: Category;
  roundNumber: number;
  rows: RoundShareRow[];
  truncated: boolean;
}

export function buildRoundShare(
  data: ChampionshipData,
  date: string,
  cat: Category,
  photos: Record<string, string>,
  format: ShareFormat
): RoundShare | null {
  const race = data.races.find((r) => r.date === date);
  if (!race) return null;

  const aliasById = new Map(data.drivers.map((d) => [d.id, d.alias]));
  const escByTeam = new Map(data.teams.map((t) => [t.id, t.escuderia]));
  const escByDriver = new Map<string, string>();
  for (const t of data.teams) {
    if (t.category !== cat) continue;
    for (const id of [t.driver1Id, t.driver2Id]) {
      if (id) escByDriver.set(id, t.escuderia);
    }
  }

  const results = data.results
    .filter((r) => r.raceId === race.id && r.category === cat)
    .sort((a, b) => a.position - b.position);
  if (results.length === 0) return null;

  const times = results
    .map((r) => r.bestTime)
    .filter((t): t is number => t != null && t < 999);
  const best = times.length > 0 ? Math.min(...times) : null;

  const officialRaces = data.races
    .filter((r) => r.isOfficial)
    .sort((a, b) => a.date.localeCompare(b.date));
  const roundNumber = officialRaces.findIndex((r) => r.id === race.id) + 1;

  const all: RoundShareRow[] = results.map((r) => {
    const alias = aliasById.get(r.driverId) ?? "?";
    return {
      pos: r.position,
      alias,
      // Snapshot team first (survives seat changes), then current seats.
      escuderia: r.isReserve
        ? "RD"
        : (r.teamId ? escByTeam.get(r.teamId) : undefined) ??
          escByDriver.get(r.driverId) ??
          "—",
      photo: photos[alias] ?? null,
      time: fmtShareTime(r.bestTime),
      dif:
        r.bestTime != null && best != null
          ? `+${(r.bestTime - best).toFixed(3)}`
          : "—",
      // DNF: started but didn't finish, no position points.
      pts: r.isDnf ? 0 : positionPoints(r.position, cat, data.config),
      gained: positionsGained(r.gridPosition, r.position),
    };
  });

  const picked = selectRowsWithContext(
    all.map((r) => ({ ...r, rank: r.pos })),
    null,
    MAX_TABLE_ROWS[format]
  );
  return {
    monthLabel: race.monthLabel,
    date: race.date,
    category: cat,
    roundNumber: roundNumber > 0 ? roundNumber : 1,
    rows: picked.rows,
    truncated: picked.truncated,
  };
}
