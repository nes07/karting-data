/**
 * Pure selectors that shape championship data into share-image payloads.
 * Kept free of JSX/IO so they are unit-testable with vitest.
 */
import { positionPoints } from "@/lib/scoring/engine";
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

/** Max table rows per format (podium renders separately on top). */
export const MAX_TABLE_ROWS: Record<ShareFormat, number> = {
  story: 16,
  post: 10,
};

/** Post pagination: page 1 keeps the podium, later pages are table-only. */
export const POST_FIRST_PAGE_ROWS = 8;
export const POST_NEXT_PAGE_ROWS = 12;

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
  /** 1-based page for multi-image posts. */
  page: number;
  pageCount: number;
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
 * Pick at most `max` rows keeping the highlighted rank visible: when the
 * highlight falls outside the head of the table, it replaces the last slot.
 */
export function selectRows<T extends { rank: number }>(
  rows: T[],
  max: number,
  highlightRank: number | null
): { rows: T[]; truncated: boolean } {
  if (rows.length <= max) return { rows, truncated: false };
  const head = rows.slice(0, max);
  if (highlightRank == null || head.some((r) => r.rank === highlightRank)) {
    return { rows: head, truncated: true };
  }
  const target = rows.find((r) => r.rank === highlightRank);
  if (!target) return { rows: head, truncated: true };
  return { rows: [...rows.slice(0, max - 1), target], truncated: true };
}

export interface PagedRows<T> {
  rows: T[];
  page: number;
  pageCount: number;
  truncated: boolean;
}

/**
 * Split rows into shareable pages. Stories and highlights are single-image;
 * posts without highlight become a carousel: page 1 shows the podium plus the
 * first rows, later pages continue the table.
 */
export function paginateRows<T extends { rank: number }>(
  rows: T[],
  format: ShareFormat,
  highlightRank: number | null,
  page: number
): PagedRows<T> {
  if (format === "story" || highlightRank != null) {
    const picked = selectRows(rows, MAX_TABLE_ROWS[format], highlightRank);
    return { rows: picked.rows, page: 1, pageCount: 1, truncated: picked.truncated };
  }
  const pageCount =
    rows.length <= POST_FIRST_PAGE_ROWS
      ? 1
      : 1 + Math.ceil((rows.length - POST_FIRST_PAGE_ROWS) / POST_NEXT_PAGE_ROWS);
  const p = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const slice =
    p === 1
      ? rows.slice(0, POST_FIRST_PAGE_ROWS)
      : rows.slice(
          POST_FIRST_PAGE_ROWS + (p - 2) * POST_NEXT_PAGE_ROWS,
          POST_FIRST_PAGE_ROWS + (p - 1) * POST_NEXT_PAGE_ROWS
        );
  return { rows: slice, page: p, pageCount, truncated: pageCount > 1 };
}

export function buildDriversShare(
  rows: DriverStandingRow[],
  cat: Category,
  photos: Record<string, string>,
  format: ShareFormat,
  highlightAlias?: string | null,
  page = 1
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
  const paged = paginateRows(all, format, highlight?.rank ?? null, page);
  return {
    title: "STANDINGS",
    subtitle: `PILOTOS ${cat}`,
    valueLabel: "PTS",
    labelHeader: "PILOTO",
    rows: paged.rows,
    highlight,
    truncated: paged.truncated,
    page: paged.page,
    pageCount: paged.pageCount,
  };
}

export function buildTeamsShare(
  rows: TeamStandingRow[],
  cat: Category,
  teamPhotos: Record<string, string>,
  format: ShareFormat,
  highlightTeam?: string | null,
  page = 1
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
  const paged = paginateRows(all, format, highlight?.rank ?? null, page);
  return {
    title: "STANDINGS",
    subtitle: `EQUIPOS ${cat}`,
    valueLabel: "PTS",
    labelHeader: "EQUIPO",
    rows: paged.rows,
    highlight,
    truncated: paged.truncated,
    page: paged.page,
    pageCount: paged.pageCount,
  };
}

export function buildVrShare(
  rows: VueltaRapidaRow[],
  photos: Record<string, string>,
  escuderias: Record<string, string>,
  format: ShareFormat,
  highlightAlias?: string | null,
  page = 1
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
  const paged = paginateRows(all, format, highlight?.rank ?? null, page);
  return {
    title: "VUELTA RÁPIDA",
    subtitle: "RANKING GKD",
    valueLabel: "TIEMPO",
    labelHeader: "PILOTO",
    rows: paged.rows,
    highlight,
    truncated: paged.truncated,
    page: paged.page,
    pageCount: paged.pageCount,
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
}

function ordinalEs(n: number): string {
  if (n === 1) return "1er";
  if (n === 3) return "3er";
  return `${n}º`;
}

export function buildDriverProfile(
  driversF1: DriverStandingRow[],
  driversF2: DriverStandingRow[],
  vueltaRapida: VueltaRapidaRow[],
  photos: Record<string, string>,
  alias: string
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
}

export interface RoundShare {
  monthLabel: string;
  date: string;
  category: Category;
  roundNumber: number;
  rows: RoundShareRow[];
  truncated: boolean;
  page: number;
  pageCount: number;
}

export function buildRoundShare(
  data: ChampionshipData,
  date: string,
  cat: Category,
  photos: Record<string, string>,
  format: ShareFormat,
  page = 1
): RoundShare | null {
  const race = data.races.find((r) => r.date === date);
  if (!race) return null;

  const aliasById = new Map(data.drivers.map((d) => [d.id, d.alias]));
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
      escuderia: r.isReserve ? "RD" : escByDriver.get(r.driverId) ?? "—",
      photo: photos[alias] ?? null,
      time: fmtShareTime(r.bestTime),
      dif:
        r.bestTime != null && best != null
          ? `+${(r.bestTime - best).toFixed(3)}`
          : "—",
      pts: positionPoints(r.position, cat, data.config),
    };
  });

  const paged = paginateRows(
    all.map((r) => ({ ...r, rank: r.pos })),
    format,
    null,
    page
  );
  return {
    monthLabel: race.monthLabel,
    date: race.date,
    category: cat,
    roundNumber: roundNumber > 0 ? roundNumber : 1,
    rows: paged.rows,
    truncated: paged.truncated,
    page: paged.page,
    pageCount: paged.pageCount,
  };
}
