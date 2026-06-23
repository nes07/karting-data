export type Category = "F1" | "F2";

export interface Driver {
  id: string;
  alias: string;
  fullName?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  active: boolean;
}

export interface Team {
  id: string;
  name: string;
  escuderia: string;
  category: Category;
  photoUrl?: string | null;
  /** Official seats: driver ids (1 or 2 filled). */
  driver1Id?: string | null;
  driver2Id?: string | null;
}

export interface Race {
  id: string;
  /** ISO date, e.g. "2026-03-22" */
  date: string;
  /** Display label, e.g. "Marzo" */
  monthLabel: string;
  isOfficial: boolean;
  /** Local start time HH:MM:SS (America/Santiago). */
  startTime: string;
}

export interface RaceResult {
  raceId: string;
  driverId: string;
  category: Category;
  /** 1-based finishing position. */
  position: number;
  /** Best lap in seconds (nullable). */
  bestTime?: number | null;
  /** True when the driver raced as a reserve (suplente) in this category. */
  isReserve: boolean;
  /** Team whose seat the reserve covered (required when isReserve). */
  replacedTeamId?: string | null;
}

export interface DotdAward {
  raceId: string;
  driverId: string;
  category: Category;
}

/** Penalty levels as stored in the DB enum. */
export type PenaltyLevel = "leve" | "media" | "grave" | "gravisima";

/** Points deducted per level (always negative). */
export const PENALTY_POINTS: Record<PenaltyLevel, number> = {
  leve:      -1,
  media:     -2,
  grave:     -3,
  gravisima: -4,
};

export interface Penalty {
  raceId: string;
  driverId: string;
  category: Category;
  /** Deduction in points (negative number, e.g. −1 for leve). */
  points: number;
  level: PenaltyLevel;
  reason?: string | null;
}

export interface ScoringConfig {
  /** Points for P1 per category. F1: 16, F2: 16. */
  maxPoints: Record<Category, number>;
  /** Bonus per race attended, official (non-reserve) pilots only (Art. 18). */
  participationPoint: number;
  /** Bonus per DOTD award; adds to the driver and to their team (Art. 19). */
  dotdPoint: number;
  /** Fraction of a reserve's position points credited to the replaced team. */
  reserveTeamFactor: number;
  /** Bonus per official pilot present in a race, credited to the team (Art. 20). */
  teamParticipationPoint: number;
}

// Note: F2 originally awarded max 15 (standings.py), but the live sheet now
// uses 16 for both categories (verified against real data during migration).
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  maxPoints: { F1: 16, F2: 16 },
  participationPoint: 1,
  dotdPoint: 1,
  reserveTeamFactor: 0.5,
  teamParticipationPoint: 1,
};

export interface ChampionshipData {
  drivers: Driver[];
  teams: Team[];
  /** Official races only, any order (engine sorts by date). */
  races: Race[];
  results: RaceResult[];
  dotd: DotdAward[];
  penalties: Penalty[];
  config: ScoringConfig;
}

export interface DriverRaceCell {
  raceId: string;
  monthLabel: string;
  position: number;
  /** Points earned that race: position pts + participation + DOTD − penalty (folded in). */
  points: number;
  isReserve: boolean;
  /** Total penalty deducted this race (0 if none, negative if penalized). */
  penaltyPoints: number;
}

export interface DriverStandingRow {
  rank: number;
  driverId: string;
  alias: string;
  /** Escudería of the official team, or "RD" if only reserve in this category. */
  escuderia: string;
  isReserve: boolean;
  totalPoints: number;
  positionPoints: number;
  participationPoints: number;
  dotdPoints: number;
  /** Total penalty deductions this season (negative or 0). */
  penaltyPoints: number;
  races: DriverRaceCell[];
  /** Average finishing position across attended races (tiebreaker 1). */
  posProm: number | null;
  /** Best lap across official races (tiebreaker 2). */
  bestTime: number | null;
  /** Rank change vs standings before the latest race. Null on debut. */
  variation: number | null;
}

export interface TeamRaceCell {
  raceId: string;
  monthLabel: string;
  /** Full team points for the race: position pts + reserve halves + attendance + DOTD − penalty. */
  points: number;
  officialParticipated: boolean;
  /** Total penalty deducted this race (0 if none, negative if penalized). */
  penaltyPoints: number;
}

export interface TeamStandingRow {
  rank: number;
  teamId: string;
  name: string;
  escuderia: string;
  driver1Alias: string | null;
  driver2Alias: string | null;
  totalPoints: number;
  participationPoints: number;
  /** Total penalty deductions this season (negative or 0). */
  penaltyPoints: number;
  races: TeamRaceCell[];
  posProm: number | null;
  bestTime: number | null;
  variation: number | null;
}
