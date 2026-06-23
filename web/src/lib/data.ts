/**
 * Data layer: loads championship data from Supabase and computes standings
 * with the points engine. Used by public pages (anon key, RLS public read).
 */
import { createClient as createSupabase } from "@supabase/supabase-js";
import {
  computeDriverStandings,
  computeTeamStandings,
} from "@/lib/scoring/engine";
import {
  Category,
  ChampionshipData,
  DEFAULT_SCORING_CONFIG,
  DotdAward,
  Driver,
  DriverStandingRow,
  Penalty,
  PENALTY_POINTS,
  PenaltyLevel,
  Race,
  RaceResult,
  ScoringConfig,
  Team,
  TeamStandingRow,
} from "@/lib/scoring/types";

import { computeVueltaRapida, type VueltaRapidaRow } from "@/lib/vuelta-rapida";
import { normalizeStartTime } from "@/lib/race-datetime";
export { TRACK_RESET_DATE, type VueltaRapidaRow } from "@/lib/vuelta-rapida";

function db() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface DotdEntry {
  date: string;
  monthLabel: string;
  alias: string;
  photoUrl: string | null;
  category: Category;
  reason: string | null;
}

export interface MediaEntry {
  tipo: string;
  titulo: string;
  url: string;
  fecha: string | null;
}

export interface PenaltyEntry {
  date: string;
  monthLabel: string;
  alias: string;
  category: Category;
  level: PenaltyLevel;
  /** Deduction (negative, e.g. −1). */
  points: number;
  reason: string | null;
}

export interface SiteData {
  data: ChampionshipData;
  driversF1: DriverStandingRow[];
  driversF2: DriverStandingRow[];
  teamsF1: TeamStandingRow[];
  teamsF2: TeamStandingRow[];
  vueltaRapida: VueltaRapidaRow[];
  dotd: DotdEntry[];
  penalties: PenaltyEntry[];
  media: MediaEntry[];
  raceDates: Array<{ monthLabel: string; date: string; startTime: string }>;
  updatedAt: string;
}

interface LapTimeRow {
  driver_id: string;
  session_date: string;
  best_time: number;
}

export async function loadSiteData(): Promise<SiteData> {
  const client = db();

  const [drv, tms, rcs, res, dt, pen, lap, med, cfg] = await Promise.all([
    client.from("drivers").select("*"),
    client.from("teams").select("*").eq("active", true),
    client.from("races").select("*").order("date"),
    client.from("race_results").select("*"),
    client.from("dotd").select("*"),
    client.from("penalties").select("*").order("created_at"),
    client.from("lap_times").select("driver_id, session_date, best_time"),
    client.from("media").select("*").order("fecha", { ascending: false }),
    client.from("scoring_config").select("*").single(),
  ]);

  for (const r of [drv, tms, rcs, res, dt, pen, lap, med]) {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }

  const drivers: Driver[] = (drv.data ?? []).map((d) => ({
    id: d.id,
    alias: d.alias,
    fullName: d.full_name,
    email: d.email,
    photoUrl: d.photo_url ?? null,
    active: d.active,
  }));
  const teams: Team[] = (tms.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    escuderia: t.escuderia,
    category: t.category,
    photoUrl: t.photo_url ?? null,
    driver1Id: t.driver1_id,
    driver2Id: t.driver2_id,
  }));
  const races: Race[] = (rcs.data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    monthLabel: r.month_label,
    isOfficial: r.is_official,
    startTime: normalizeStartTime(r.start_time ?? "12:00:00"),
  }));
  const results: RaceResult[] = (res.data ?? []).map((r) => ({
    raceId: r.race_id,
    driverId: r.driver_id,
    category: r.category,
    position: r.position,
    bestTime: r.best_time,
    isReserve: r.is_reserve,
    replacedTeamId: r.replaced_team_id,
  }));
  const dotdAwards: DotdAward[] = (dt.data ?? []).map((d) => ({
    raceId: d.race_id,
    driverId: d.driver_id,
    category: d.category,
  }));

  const penaltyItems: Penalty[] = (pen.data ?? []).map((p) => ({
    raceId: p.race_id,
    driverId: p.driver_id,
    category: p.category as Category,
    level: p.level as PenaltyLevel,
    points: PENALTY_POINTS[p.level as PenaltyLevel],
    reason: p.reason ?? null,
  }));

  const config: ScoringConfig = cfg.data
    ? {
        maxPoints: { F1: cfg.data.f1_max_points, F2: cfg.data.f2_max_points },
        participationPoint: Number(cfg.data.participation_point),
        dotdPoint: Number(cfg.data.dotd_point),
        reserveTeamFactor: Number(cfg.data.reserve_team_factor),
        teamParticipationPoint: Number(cfg.data.team_participation_point),
      }
    : DEFAULT_SCORING_CONFIG;

  const data: ChampionshipData = {
    drivers,
    teams,
    races,
    results,
    dotd: dotdAwards,
    penalties: penaltyItems,
    config,
  };

  const aliasById = new Map(drivers.map((d) => [d.id, d.alias]));
  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const raceById = new Map(races.map((r) => [r.id, r]));

  const penaltyEntries: PenaltyEntry[] = (pen.data ?? [])
    .map((p) => {
      const race = raceById.get(p.race_id);
      return {
        date: race?.date ?? "",
        monthLabel: race?.monthLabel ?? "",
        alias: aliasById.get(p.driver_id) ?? "?",
        category: p.category as Category,
        level: p.level as PenaltyLevel,
        points: PENALTY_POINTS[p.level as PenaltyLevel],
        reason: p.reason ?? null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const dotdEntries: DotdEntry[] = (dt.data ?? [])
    .map((d) => {
      const race = raceById.get(d.race_id);
      return {
        date: race?.date ?? "",
        monthLabel: race?.monthLabel ?? "",
        alias: aliasById.get(d.driver_id) ?? "?",
        photoUrl: driverById.get(d.driver_id)?.photoUrl ?? null,
        category: d.category as Category,
        reason: d.reason,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    data,
    driversF1: computeDriverStandings(data, "F1"),
    driversF2: computeDriverStandings(data, "F2"),
    teamsF1: computeTeamStandings(data, "F1"),
    teamsF2: computeTeamStandings(data, "F2"),
    vueltaRapida: computeVueltaRapida((lap.data ?? []) as LapTimeRow[], aliasById),
    dotd: dotdEntries,
    penalties: penaltyEntries,
    media: (med.data ?? []).map((m) => ({
      tipo: m.tipo,
      titulo: m.titulo,
      url: m.url,
      fecha: m.fecha,
    })),
    raceDates: races
      .filter((r) => r.isOfficial)
      .map((r) => ({
        monthLabel: r.monthLabel,
        date: r.date,
        startTime: r.startTime,
      })),
    updatedAt: new Date().toISOString(),
  };
}
