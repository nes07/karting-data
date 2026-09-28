/**
 * GKD Championship points engine.
 *
 * Single source of truth for all scoring rules, matching the official rulebook
 * (Art. 18/19/20):
 *   - Position points:      max(0, (maxPts + 1) - position); F1 max 16, F2 max 16.
 *   - Participation (Art18): +1 per race attended, OFFICIAL pilots only.
 *                           Invited/reserve pilots never earn it.
 *   - DOTD (Art. 19):       +1 per award to the driver AND +1 to their team.
 *   - Reserve drivers:      full position points in their own driver ranking
 *                           (no participation bonus); position points x 0.5 to
 *                           the replaced team; escudería shown as "RD" when not
 *                           official in the category.
 *   - Team participation:   +1 per OFFICIAL pilot present in a race (so both
 *                           present -> +2; a 0-point last place still counts; an
 *                           invited replacement contributes none).
 *   - Per-race cell points: include the bonuses earned that race (participation,
 *                           DOTD, reserve halves) so cells sum to the total.
 *   - Tiebreakers:          total points desc -> avg position asc -> best time asc.
 *   - Variation (Var):      rank now minus rank before the latest completed race;
 *                           null for debutants (fewer than 2 races attended).
 *   - Worst-result drop:    once a category has 2+ completed races, each driver's
 *                           worst performance to date is dropped automatically.
 *                           Absences count as a 0-point performance, so a driver
 *                           only drops an attended race when they attended every
 *                           race, or when an attended cell is negative (penalties).
 *                           Teams inherit the drop: the dropped pilot's
 *                           contribution that race (position pts + attendance +
 *                           DOTD − penalty) is subtracted from the team total.
 *                           Reserve (RD) drops never affect teams. posProm and
 *                           best time keep counting every race.
 */

import {
  Category,
  ChampionshipData,
  DotdAward,
  DriverRaceCell,
  DriverStandingRow,
  Penalty,
  Race,
  RaceResult,
  ScoringConfig,
  Team,
  TeamRaceCell,
  TeamStandingRow,
} from "./types";

export function positionPoints(
  position: number,
  category: Category,
  config: ScoringConfig
): number {
  return Math.max(0, config.maxPoints[category] + 1 - position);
}

function sortedOfficialRaces(races: Race[]): Race[] {
  return races
    .filter((r) => r.isOfficial)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Races that already have at least one result in the given category. */
function completedRaces(
  races: Race[],
  results: RaceResult[],
  category: Category
): Race[] {
  const withResults = new Set(
    results.filter((r) => r.category === category).map((r) => r.raceId)
  );
  return sortedOfficialRaces(races).filter((r) => withResults.has(r.id));
}

interface DriverAggregate {
  driverId: string;
  cells: DriverRaceCell[];
  positionPoints: number;
  participationPoints: number;
  dotdPoints: number;
  penaltyPoints: number;
  totalPoints: number;
  droppedPoints: number;
  posProm: number | null;
  bestTime: number | null;
}

function emptyAggregate(driverId: string): DriverAggregate {
  return {
    driverId,
    cells: [],
    positionPoints: 0,
    participationPoints: 0,
    dotdPoints: 0,
    penaltyPoints: 0,
    totalPoints: 0,
    droppedPoints: 0,
    posProm: null,
    bestTime: null,
  };
}

/** Minimum completed races in a category before the worst-result drop applies. */
const DROP_WORST_MIN_RACES = 2;

/**
 * Applies the automatic worst-result drop to driver aggregates (mutating them)
 * and returns the dropped raceId per driver.
 *
 * An absence counts as a 0-point performance: a driver with absences only
 * drops an attended race when that cell is negative (penalties made it worse
 * than not showing up). Drops that fall on an absence subtract nothing and are
 * not returned. posProm and bestTime are intentionally left untouched.
 */
function applyWorstDrop(
  byDriver: Map<string, DriverAggregate>,
  raceCount: number
): Map<string, string> {
  const droppedRace = new Map<string, string>();
  if (raceCount < DROP_WORST_MIN_RACES) return droppedRace;

  for (const agg of byDriver.values()) {
    if (agg.cells.length === 0) continue;
    let worst = agg.cells[0];
    for (const cell of agg.cells) {
      if (cell.points < worst.points) worst = cell;
    }
    const hasAbsence = agg.cells.length < raceCount;
    // With an absence on record, the 0-point no-show is already the worst
    // result unless some attended race scored below zero.
    if (hasAbsence && worst.points >= 0) continue;

    worst.dropped = true;
    agg.droppedPoints = worst.points;
    agg.totalPoints -= worst.points;
    droppedRace.set(agg.driverId, worst.raceId);
  }
  return droppedRace;
}

function aggregateDrivers(
  races: Race[],
  results: RaceResult[],
  dotd: DotdAward[],
  penalties: Penalty[],
  teams: Team[],
  category: Category,
  config: ScoringConfig
): Map<string, DriverAggregate> {
  const raceOrder = new Map(races.map((r, i) => [r.id, i]));
  const byDriver = new Map<string, DriverAggregate>();

  // DOTD awards in scope, keyed by "driverId|raceId" so the bonus can be folded
  // into the matching per-race cell.
  const dotdByDriverRace = new Set<string>();
  for (const d of dotd) {
    if (d.category === category && raceOrder.has(d.raceId)) {
      dotdByDriverRace.add(`${d.driverId}|${d.raceId}`);
    }
  }

  // Penalty deductions in scope, summed per "driverId|raceId" (multiple allowed).
  const penaltyByDriverRace = new Map<string, number>();
  for (const p of penalties) {
    if (p.category === category && raceOrder.has(p.raceId)) {
      const key = `${p.driverId}|${p.raceId}`;
      penaltyByDriverRace.set(key, (penaltyByDriverRace.get(key) ?? 0) + p.points);
    }
  }

  // Official seat holders always appear in the standings, even with 0 races.
  for (const team of teams) {
    if (team.category !== category) continue;
    for (const id of [team.driver1Id, team.driver2Id]) {
      if (id && !byDriver.has(id)) byDriver.set(id, emptyAggregate(id));
    }
  }

  for (const res of results) {
    if (res.category !== category) continue;
    if (!raceOrder.has(res.raceId)) continue;

    let agg = byDriver.get(res.driverId);
    if (!agg) {
      agg = emptyAggregate(res.driverId);
      byDriver.set(res.driverId, agg);
    }

    const race = races[raceOrder.get(res.raceId)!];
    const posPts = positionPoints(res.position, category, config);
    // Art. 18: only official (non-reserve) pilots earn the participation bonus.
    const partPts = res.isReserve ? 0 : config.participationPoint;
    // Art. 19: DOTD adds to the individual total.
    const dotdPts = dotdByDriverRace.has(`${res.driverId}|${res.raceId}`)
      ? config.dotdPoint
      : 0;
    // Art. 23: penalty deductions (negative value, 0 if none).
    const penPts = penaltyByDriverRace.get(`${res.driverId}|${res.raceId}`) ?? 0;

    agg.cells.push({
      raceId: res.raceId,
      monthLabel: race.monthLabel,
      position: res.position,
      points: posPts + partPts + dotdPts + penPts,
      isReserve: res.isReserve,
      penaltyPoints: penPts,
    });
    agg.positionPoints += posPts;
    agg.participationPoints += partPts;
    agg.dotdPoints += dotdPts;
    agg.penaltyPoints += penPts;
    if (res.bestTime != null) {
      agg.bestTime =
        agg.bestTime == null ? res.bestTime : Math.min(agg.bestTime, res.bestTime);
    }
  }

  for (const agg of byDriver.values()) {
    agg.cells.sort(
      (a, b) => raceOrder.get(a.raceId)! - raceOrder.get(b.raceId)!
    );
    agg.totalPoints =
      agg.positionPoints + agg.participationPoints + agg.dotdPoints + agg.penaltyPoints;
    agg.posProm =
      agg.cells.length > 0
        ? agg.cells.reduce((s, c) => s + c.position, 0) / agg.cells.length
        : null;
  }

  return byDriver;
}

/** Standard standings comparator: points desc, posProm asc, bestTime asc. */
function compareStandings(
  a: { totalPoints: number; posProm: number | null; bestTime: number | null },
  b: { totalPoints: number; posProm: number | null; bestTime: number | null }
): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  const ap = a.posProm ?? Number.POSITIVE_INFINITY;
  const bp = b.posProm ?? Number.POSITIVE_INFINITY;
  if (ap !== bp) return ap - bp;
  const at = a.bestTime ?? Number.POSITIVE_INFINITY;
  const bt = b.bestTime ?? Number.POSITIVE_INFINITY;
  return at - bt;
}

function rankMap<T extends { totalPoints: number; posProm: number | null; bestTime: number | null }>(
  rows: Map<string, T>
): Map<string, number> {
  const sorted = [...rows.entries()].sort((a, b) =>
    compareStandings(a[1], b[1])
  );
  return new Map(sorted.map(([id], i) => [id, i + 1]));
}

export function computeDriverStandings(
  data: ChampionshipData,
  category: Category
): DriverStandingRow[] {
  const { drivers, teams, results, dotd, penalties, config } = data;
  const races = completedRaces(data.races, results, category);

  const current = aggregateDrivers(races, results, dotd, penalties, teams, category, config);
  applyWorstDrop(current, races.length);
  const currentRanks = rankMap(current);

  // Previous standings: exclude the latest completed race entirely.
  const prevRaces = races.slice(0, -1);
  const prevRaceIds = new Set(prevRaces.map((r) => r.id));
  const previous = aggregateDrivers(
    prevRaces,
    results.filter((r) => prevRaceIds.has(r.raceId)),
    dotd.filter((d) => prevRaceIds.has(d.raceId)),
    penalties.filter((p) => prevRaceIds.has(p.raceId)),
    teams,
    category,
    config
  );
  applyWorstDrop(previous, prevRaces.length);
  const previousRanks = rankMap(previous);

  // Official escudería lookup for this category.
  const escuderiaByDriver = new Map<string, string>();
  for (const team of teams) {
    if (team.category !== category) continue;
    for (const id of [team.driver1Id, team.driver2Id]) {
      if (id) escuderiaByDriver.set(id, team.escuderia);
    }
  }

  const aliasById = new Map(drivers.map((d) => [d.id, d.alias]));

  const rows: DriverStandingRow[] = [...current.values()].map((agg) => {
    const escuderia = escuderiaByDriver.get(agg.driverId) ?? "RD";
    const attended = agg.cells.length;
    const prevRank = previousRanks.get(agg.driverId);
    return {
      rank: currentRanks.get(agg.driverId)!,
      driverId: agg.driverId,
      alias: aliasById.get(agg.driverId) ?? agg.driverId,
      escuderia,
      isReserve: escuderia === "RD",
      totalPoints: agg.totalPoints,
      positionPoints: agg.positionPoints,
      participationPoints: agg.participationPoints,
      dotdPoints: agg.dotdPoints,
      penaltyPoints: agg.penaltyPoints,
      races: agg.cells,
      droppedPoints: agg.droppedPoints,
      posProm: agg.posProm,
      bestTime: agg.bestTime,
      variation:
        attended >= 2 && prevRank != null
          ? prevRank - currentRanks.get(agg.driverId)!
          : null,
    };
  });

  return rows.sort((a, b) => a.rank - b.rank);
}

interface TeamAggregate {
  teamId: string;
  cells: TeamRaceCell[];
  pointsFromRaces: number;
  participationPoints: number;
  totalPoints: number;
  droppedPoints: number;
  posProm: number | null;
  bestTime: number | null;
  penaltyPoints: number;
}

function aggregateTeams(
  teams: Team[],
  races: Race[],
  results: RaceResult[],
  dotd: DotdAward[],
  penalties: Penalty[],
  category: Category,
  config: ScoringConfig,
  /** Dropped raceId per driver (from the drivers' worst-result drop). */
  droppedRaceByDriver: Map<string, string>
): Map<string, TeamAggregate> {
  const raceOrder = new Map(races.map((r, i) => [r.id, i]));
  const categoryTeams = teams.filter((t) => t.category === category);

  // Per-driver DOTD / penalty lookups, needed to price a dropped pilot's
  // exact contribution to their team on the dropped race.
  const dotdByDriverRace = new Set<string>();
  for (const d of dotd) {
    if (d.category === category && raceOrder.has(d.raceId)) {
      dotdByDriverRace.add(`${d.driverId}|${d.raceId}`);
    }
  }
  const penaltyByDriverRace = new Map<string, number>();
  for (const p of penalties) {
    if (p.category === category && raceOrder.has(p.raceId)) {
      const key = `${p.driverId}|${p.raceId}`;
      penaltyByDriverRace.set(key, (penaltyByDriverRace.get(key) ?? 0) + p.points);
    }
  }

  // Official seat -> team id (this category), to credit DOTD to the right team.
  const teamByDriver = new Map<string, string>();
  for (const t of categoryTeams) {
    for (const id of [t.driver1Id, t.driver2Id]) {
      if (id) teamByDriver.set(id, t.id);
    }
  }
  // DOTD bonus per "teamId|raceId" (Art. 19: also to the winner's team).
  const teamDotd = new Map<string, number>();
  for (const d of dotd) {
    if (d.category !== category || !raceOrder.has(d.raceId)) continue;
    const teamId = teamByDriver.get(d.driverId);
    if (!teamId) continue; // invited winner has no official seat here
    const key = `${teamId}|${d.raceId}`;
    teamDotd.set(key, (teamDotd.get(key) ?? 0) + config.dotdPoint);
  }

  // Penalty deductions per "teamId|raceId" (Art. 23: also to the pilot's team).
  // Suplentes have no official seat here so they don't affect any team.
  const teamPenalty = new Map<string, number>();
  for (const p of penalties) {
    if (p.category !== category || !raceOrder.has(p.raceId)) continue;
    const teamId = teamByDriver.get(p.driverId);
    if (!teamId) continue; // suplente: only affects individual standing
    const key = `${teamId}|${p.raceId}`;
    teamPenalty.set(key, (teamPenalty.get(key) ?? 0) + p.points);
  }

  const byTeam = new Map<string, TeamAggregate>(
    categoryTeams.map((t) => [
      t.id,
      {
        teamId: t.id,
        cells: [],
        pointsFromRaces: 0,
        participationPoints: 0,
        totalPoints: 0,
        droppedPoints: 0,
        posProm: null,
        bestTime: null,
        penaltyPoints: 0,
      },
    ])
  );

  for (const race of races) {
    const raceResults = results.filter(
      (r) => r.raceId === race.id && r.category === category
    );

    for (const team of categoryTeams) {
      const agg = byTeam.get(team.id)!;
      const officialIds = [team.driver1Id, team.driver2Id].filter(
        (x): x is string => x != null
      );

      let racePoints = 0;
      let officialsPresent = 0;
      // Contribution of members whose worst-result drop falls on this race:
      // their position pts + attendance + DOTD − penalty leave the team total.
      let droppedContribution = 0;

      for (const res of raceResults) {
        if (!res.isReserve && officialIds.includes(res.driverId)) {
          racePoints += positionPoints(res.position, category, config);
          officialsPresent += 1;
          if (res.bestTime != null) {
            agg.bestTime =
              agg.bestTime == null
                ? res.bestTime
                : Math.min(agg.bestTime, res.bestTime);
          }
          if (droppedRaceByDriver.get(res.driverId) === race.id) {
            const key = `${res.driverId}|${race.id}`;
            droppedContribution +=
              positionPoints(res.position, category, config) +
              config.teamParticipationPoint +
              (dotdByDriverRace.has(key) ? config.dotdPoint : 0) +
              (penaltyByDriverRace.get(key) ?? 0);
          }
        } else if (res.isReserve && res.replacedTeamId === team.id) {
          // Reserve (RD) drops never propagate to the replaced team.
          racePoints +=
            positionPoints(res.position, category, config) *
            config.reserveTeamFactor;
        }
      }

      const raceHappened = raceResults.length > 0;
      if (raceHappened) {
        // Art. 18/20: +1 per official present. Art. 19: +1 if a member won DOTD.
        // Art. 23: subtract penalty for official pilots.
        const attendance = officialsPresent * config.teamParticipationPoint;
        const dotdBonus = teamDotd.get(`${team.id}|${race.id}`) ?? 0;
        const penDeduct = teamPenalty.get(`${team.id}|${race.id}`) ?? 0;
        agg.cells.push({
          raceId: race.id,
          monthLabel: race.monthLabel,
          points: racePoints + attendance + dotdBonus + penDeduct,
          officialParticipated: officialsPresent > 0,
          penaltyPoints: penDeduct,
          droppedPoints: droppedContribution,
        });
        agg.pointsFromRaces += racePoints;
        agg.participationPoints += attendance;
      }

    }
  }

  // Average position across all official pilots' results, all races.
  for (const team of categoryTeams) {
    const agg = byTeam.get(team.id)!;
    const officialIds = [team.driver1Id, team.driver2Id].filter(
      (x): x is string => x != null
    );
    const positions = results
      .filter(
        (r) =>
          r.category === category &&
          raceOrder.has(r.raceId) &&
          !r.isReserve &&
          officialIds.includes(r.driverId)
      )
      .map((r) => r.position);
    agg.posProm =
      positions.length > 0
        ? positions.reduce((s, p) => s + p, 0) / positions.length
        : null;
    // Total = position points + reserve halves + attendance + DOTD − penalties,
    // minus the contributions removed by the drivers' worst-result drops. Cells
    // keep their full race points; droppedPoints records what left the total.
    agg.droppedPoints = agg.cells.reduce((s, c) => s + c.droppedPoints, 0);
    agg.totalPoints =
      agg.cells.reduce((s, c) => s + c.points, 0) - agg.droppedPoints;
    agg.penaltyPoints = agg.cells.reduce((s, c) => s + c.penaltyPoints, 0);
  }

  return byTeam;
}

export function computeTeamStandings(
  data: ChampionshipData,
  category: Category
): TeamStandingRow[] {
  const { drivers, teams, results, dotd, penalties, config } = data;
  const races = completedRaces(data.races, results, category);

  // Teams inherit their pilots' worst-result drops: recompute the drivers'
  // aggregation to know which race each pilot dropped.
  const driverAggs = aggregateDrivers(races, results, dotd, penalties, teams, category, config);
  const droppedByDriver = applyWorstDrop(driverAggs, races.length);

  const current = aggregateTeams(
    teams, races, results, dotd, penalties, category, config, droppedByDriver
  );
  const currentRanks = rankMap(current);

  const prevRaces = races.slice(0, -1);
  const prevRaceIds = new Set(prevRaces.map((r) => r.id));
  const prevResults = results.filter((r) => prevRaceIds.has(r.raceId));
  const prevDotd = dotd.filter((d) => prevRaceIds.has(d.raceId));
  const prevPenalties = penalties.filter((p) => prevRaceIds.has(p.raceId));
  const prevDriverAggs = aggregateDrivers(
    prevRaces, prevResults, prevDotd, prevPenalties, teams, category, config
  );
  const prevDroppedByDriver = applyWorstDrop(prevDriverAggs, prevRaces.length);
  const previous = aggregateTeams(
    teams,
    prevRaces,
    prevResults,
    prevDotd,
    prevPenalties,
    category,
    config,
    prevDroppedByDriver
  );
  const previousRanks = rankMap(previous);

  const aliasById = new Map(drivers.map((d) => [d.id, d.alias]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const rows: TeamStandingRow[] = [...current.values()].map((agg) => {
    const team = teamById.get(agg.teamId)!;
    const racesWithData = agg.cells.length;
    const prevRank = previousRanks.get(agg.teamId);
    return {
      rank: currentRanks.get(agg.teamId)!,
      teamId: agg.teamId,
      name: team.name,
      escuderia: team.escuderia,
      driver1Alias: team.driver1Id ? aliasById.get(team.driver1Id) ?? null : null,
      driver2Alias: team.driver2Id ? aliasById.get(team.driver2Id) ?? null : null,
      totalPoints: agg.totalPoints,
      participationPoints: agg.participationPoints,
      penaltyPoints: agg.penaltyPoints,
      races: agg.cells,
      droppedPoints: agg.droppedPoints,
      posProm: agg.posProm,
      bestTime: agg.bestTime,
      variation:
        racesWithData >= 2 && prevRank != null
          ? prevRank - currentRanks.get(agg.teamId)!
          : null,
    };
  });

  return rows.sort((a, b) => a.rank - b.rank);
}
