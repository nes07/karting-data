import { describe, expect, it } from "vitest";
import { computeDriverStandings, computeTeamStandings, positionPoints } from "./engine";
import {
  ChampionshipData,
  DEFAULT_SCORING_CONFIG,
  Driver,
  Penalty,
  Race,
  RaceResult,
  Team,
} from "./types";

const config = DEFAULT_SCORING_CONFIG;

function driver(id: string): Driver {
  return { id, alias: id.toUpperCase(), active: true };
}

function makeData(partial: Partial<ChampionshipData>): ChampionshipData {
  return {
    drivers: [],
    teams: [],
    races: [],
    results: [],
    dotd: [],
    penalties: [],
    config,
    ...partial,
  };
}

const RACES: Race[] = [
  { id: "r1", date: "2026-03-22", monthLabel: "Marzo", isOfficial: true },
  { id: "r2", date: "2026-04-12", monthLabel: "Abril", isOfficial: true },
  { id: "r3", date: "2026-05-17", monthLabel: "Mayo", isOfficial: true },
];

describe("positionPoints", () => {
  it("F1: P1 = 16, P16 = 1, beyond max = 0", () => {
    expect(positionPoints(1, "F1", config)).toBe(16);
    expect(positionPoints(16, "F1", config)).toBe(1);
    expect(positionPoints(17, "F1", config)).toBe(0);
  });

  it("F2: P1 = 16, P16 = 1, beyond max = 0 (live sheet uses 16 for both)", () => {
    expect(positionPoints(1, "F2", config)).toBe(16);
    expect(positionPoints(16, "F2", config)).toBe(1);
    expect(positionPoints(17, "F2", config)).toBe(0);
  });
});

describe("driver standings", () => {
  it("totals = position points + participation + DOTD", () => {
    const data = makeData({
      drivers: [driver("a"), driver("b")],
      races: RACES,
      results: [
        { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
        { raceId: "r2", driverId: "a", category: "F1", position: 2, isReserve: false },
        { raceId: "r1", driverId: "b", category: "F1", position: 2, isReserve: false },
      ],
      dotd: [{ raceId: "r1", driverId: "a", category: "F1" }],
    });

    const rows = computeDriverStandings(data, "F1");
    const a = rows.find((r) => r.driverId === "a")!;
    // 16 + 15 position pts, +2 participation, +1 DOTD
    expect(a.totalPoints).toBe(34);
    expect(a.participationPoints).toBe(2);
    expect(a.dotdPoints).toBe(1);

    const b = rows.find((r) => r.driverId === "b")!;
    // 15 + 1 participation
    expect(b.totalPoints).toBe(16);
  });

  it("a 0-point finish still earns the participation point (Leo case)", () => {
    const data = makeData({
      drivers: [driver("leo")],
      races: RACES,
      results: [
        // F2 position 19 -> 0 position points (max(0, 17-19))
        { raceId: "r1", driverId: "leo", category: "F2", position: 19, isReserve: false },
      ],
    });
    const rows = computeDriverStandings(data, "F2");
    expect(rows[0].positionPoints).toBe(0);
    expect(rows[0].totalPoints).toBe(1);
  });

  it("official drivers with zero races still appear with 0 points (Guille case)", () => {
    const team: Team = {
      id: "t1",
      name: "Equipo 9",
      escuderia: "Brawn GP",
      category: "F2",
      driver1Id: "guille",
      driver2Id: "jm",
    };
    const data = makeData({
      drivers: [driver("guille"), driver("jm")],
      teams: [team],
      races: RACES,
      results: [
        { raceId: "r1", driverId: "jm", category: "F2", position: 3, isReserve: false },
      ],
    });
    const rows = computeDriverStandings(data, "F2");
    const guille = rows.find((r) => r.driverId === "guille")!;
    expect(guille.totalPoints).toBe(0);
    expect(guille.posProm).toBeNull();
    expect(guille.variation).toBeNull();
    expect(guille.rank).toBe(2);
  });

  it("reserve drivers keep full points in their own ranking and show RD", () => {
    const team: Team = {
      id: "t1",
      name: "Equipo 1",
      escuderia: "Ferrari",
      category: "F1",
      driver1Id: "a",
      driver2Id: "b",
    };
    const data = makeData({
      drivers: [driver("a"), driver("b"), driver("res")],
      teams: [team],
      races: RACES,
      results: [
        { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
        { raceId: "r1", driverId: "res", category: "F1", position: 2, isReserve: true, replacedTeamId: "t1" },
      ],
    });
    const rows = computeDriverStandings(data, "F1");
    const res = rows.find((r) => r.driverId === "res")!;
    expect(res.escuderia).toBe("RD");
    expect(res.isReserve).toBe(true);
    // Full 15 position points, NO participation bonus (Art. 18: invited pilots)
    expect(res.totalPoints).toBe(15);
    expect(res.participationPoints).toBe(0);
  });

  it("DOTD is folded into the race cell so cells sum to the total", () => {
    const data = makeData({
      drivers: [driver("a")],
      races: RACES,
      results: [
        { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
        { raceId: "r2", driverId: "a", category: "F1", position: 3, isReserve: false },
      ],
      dotd: [{ raceId: "r1", driverId: "a", category: "F1" }],
    });
    const a = computeDriverStandings(data, "F1").find((r) => r.driverId === "a")!;
    // r1: 16 pos + 1 part + 1 dotd = 18; r2: 14 pos + 1 part = 15
    const cellSum = a.races.reduce((s, c) => s + c.points, 0);
    expect(a.races.find((c) => c.monthLabel === "Marzo")!.points).toBe(18);
    expect(cellSum).toBe(a.totalPoints);
  });

  it("tiebreak: equal points -> better average position wins", () => {
    const data = makeData({
      drivers: [driver("a"), driver("b")],
      races: RACES,
      results: [
        // a: P3 then P5 -> 14 + 12 = 26 pts, posProm 4
        { raceId: "r1", driverId: "a", category: "F1", position: 3, isReserve: false },
        { raceId: "r2", driverId: "a", category: "F1", position: 5, isReserve: false },
        // b: P4 then P4 -> 13 + 13 = 26 pts, posProm 4... make b posProm worse
        { raceId: "r1", driverId: "b", category: "F1", position: 6, isReserve: false },
        { raceId: "r2", driverId: "b", category: "F1", position: 2, isReserve: false },
      ],
    });
    const rows = computeDriverStandings(data, "F1");
    // both have 26 + 2 = 28 points; a posProm 4 beats b posProm 4 — equal here,
    // adjust: a (3+5)/2 = 4, b (6+2)/2 = 4 -> falls to bestTime (both null) -> stable
    expect(rows[0].totalPoints).toBe(rows[1].totalPoints);
  });

  it("variation: rank change vs standings before the latest race; debut is null", () => {
    const data = makeData({
      drivers: [driver("a"), driver("b"), driver("c")],
      races: RACES,
      results: [
        // After r1: a=16+1=17, b=15+1=16 -> a #1, b #2
        { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
        { raceId: "r1", driverId: "b", category: "F1", position: 2, isReserve: false },
        // r2: b wins big, a slumps; c debuts
        { raceId: "r2", driverId: "b", category: "F1", position: 1, isReserve: false },
        { raceId: "r2", driverId: "a", category: "F1", position: 10, isReserve: false },
        { raceId: "r2", driverId: "c", category: "F1", position: 2, isReserve: false },
      ],
    });
    const rows = computeDriverStandings(data, "F1");
    const a = rows.find((r) => r.driverId === "a")!;
    const b = rows.find((r) => r.driverId === "b")!;
    const c = rows.find((r) => r.driverId === "c")!;

    // Totals: a = 16+7+2 = 25, b = 15+16+2 = 33, c = 15+1 = 16
    expect(b.rank).toBe(1);
    expect(a.rank).toBe(2);
    expect(c.rank).toBe(3);

    // Before r2: a #1, b #2 -> b went up 1 (+1), a went down 1 (-1)
    expect(b.variation).toBe(1);
    expect(a.variation).toBe(-1);
    // c debuted in r2 -> null
    expect(c.variation).toBeNull();
  });
});

describe("team standings", () => {
  const teams: Team[] = [
    { id: "t1", name: "Equipo 1", escuderia: "Ferrari", category: "F1", driver1Id: "a", driver2Id: "b" },
    { id: "t2", name: "Equipo 2", escuderia: "McLaren", category: "F1", driver1Id: "c", driver2Id: "d" },
  ];
  const drivers = [driver("a"), driver("b"), driver("c"), driver("d"), driver("res")];

  it("team points = official full points + reserve half points; +1 attendance per present official", () => {
    const results: RaceResult[] = [
      // r1: t1 both officials race; t2 fully replaced by one reserve
      { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
      { raceId: "r1", driverId: "b", category: "F1", position: 16, isReserve: false }, // 1 pt
      { raceId: "r1", driverId: "res", category: "F1", position: 2, isReserve: true, replacedTeamId: "t2" },
    ];
    const data = makeData({ drivers, teams, races: RACES, results });
    const rows = computeTeamStandings(data, "F1");

    const t1 = rows.find((r) => r.teamId === "t1")!;
    // 16 + 1 position pts + 2 attendance (both officials present, Art. 20)
    expect(t1.totalPoints).toBe(19);
    expect(t1.participationPoints).toBe(2);

    const t2 = rows.find((r) => r.teamId === "t2")!;
    // reserve P2 = 15 pts * 0.5 = 7.5; NO attendance (no official raced — BMW case)
    expect(t2.totalPoints).toBe(7.5);
    expect(t2.participationPoints).toBe(0);
  });

  it("DOTD also adds +1 to the winner's team (Art. 19)", () => {
    const results: RaceResult[] = [
      { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
      { raceId: "r1", driverId: "b", category: "F1", position: 5, isReserve: false },
    ];
    const data = makeData({
      drivers,
      teams,
      races: RACES,
      results,
      dotd: [{ raceId: "r1", driverId: "a", category: "F1" }],
    });
    const t1 = computeTeamStandings(data, "F1").find((r) => r.teamId === "t1")!;
    // 16 (P1) + 12 (P5) + 2 attendance + 1 DOTD = 31; cells sum to total
    expect(t1.totalPoints).toBe(31);
    expect(t1.races.reduce((s, c) => s + c.points, 0)).toBe(31);
  });

  it("official finishing last with 0 points still earns team participation (Minardi case)", () => {
    const results: RaceResult[] = [
      { raceId: "r1", driverId: "a", category: "F1", position: 17, isReserve: false }, // 0 pts
      { raceId: "r1", driverId: "c", category: "F1", position: 1, isReserve: false },
    ];
    const data = makeData({ drivers, teams, races: RACES, results });
    const rows = computeTeamStandings(data, "F1");
    const t1 = rows.find((r) => r.teamId === "t1")!;
    expect(t1.totalPoints).toBe(1); // 0 race pts + 1 participation
    expect(t1.participationPoints).toBe(1);
  });

  it("team variation vs previous race; null with fewer than 2 races", () => {
    const results: RaceResult[] = [
      // r1: t1 ahead
      { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
      { raceId: "r1", driverId: "c", category: "F1", position: 2, isReserve: false },
      // r2: t2 takes the lead
      { raceId: "r2", driverId: "a", category: "F1", position: 10, isReserve: false },
      { raceId: "r2", driverId: "c", category: "F1", position: 1, isReserve: false },
    ];
    const data = makeData({ drivers, teams, races: RACES, results });
    const rows = computeTeamStandings(data, "F1");

    const t1 = rows.find((r) => r.teamId === "t1")!;
    const t2 = rows.find((r) => r.teamId === "t2")!;
    // Totals: t1 = 16+7+2 = 25, t2 = 15+16+2 = 33
    expect(t2.rank).toBe(1);
    expect(t2.variation).toBe(1);
    expect(t1.rank).toBe(2);
    expect(t1.variation).toBe(-1);
  });
});

describe("penalties (Art. 23–24)", () => {
  const team: Team = {
    id: "t1", name: "Equipo 1", escuderia: "Ferrari", category: "F1",
    driver1Id: "a", driver2Id: "b",
  };
  const drv = [
    { id: "a", alias: "A", active: true },
    { id: "b", alias: "B", active: true },
    { id: "res", alias: "RES", active: true },
  ];

  it("penalty reduces driver total and is visible in cell penaltyPoints", () => {
    const penalty: Penalty = { raceId: "r1", driverId: "a", category: "F1", level: "leve", points: -1 };
    const data = makeData({
      drivers: drv, teams: [team], races: RACES,
      results: [{ raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false }],
      penalties: [penalty],
    });
    const a = computeDriverStandings(data, "F1").find((r) => r.driverId === "a")!;
    // P1=16, part=1, pen=-1 → 16
    expect(a.totalPoints).toBe(16);
    expect(a.penaltyPoints).toBe(-1);
    expect(a.races[0].penaltyPoints).toBe(-1);
    // cell.points folds everything
    expect(a.races[0].points).toBe(16);
  });

  it("penalty also reduces team total in the matching race cell", () => {
    const penalty: Penalty = { raceId: "r1", driverId: "a", category: "F1", level: "media", points: -2 };
    const data = makeData({
      drivers: drv, teams: [team], races: RACES,
      results: [
        { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
        { raceId: "r1", driverId: "b", category: "F1", position: 2, isReserve: false },
      ],
      penalties: [penalty],
    });
    const t1 = computeTeamStandings(data, "F1").find((r) => r.teamId === "t1")!;
    // 16 + 15 pos + 2 attendance − 2 penalty = 31
    expect(t1.totalPoints).toBe(31);
    expect(t1.penaltyPoints).toBe(-2);
    expect(t1.races[0].penaltyPoints).toBe(-2);
  });

  it("suplente penalty does NOT reduce any team (Art. 23: no official seat)", () => {
    const penalty: Penalty = { raceId: "r1", driverId: "res", category: "F1", level: "grave", points: -3 };
    const data = makeData({
      drivers: drv, teams: [team], races: RACES,
      results: [
        { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
        { raceId: "r1", driverId: "res", category: "F1", position: 3, isReserve: true, replacedTeamId: "t1" },
      ],
      penalties: [penalty],
    });
    const t1 = computeTeamStandings(data, "F1").find((r) => r.teamId === "t1")!;
    // team gets: 16 (a) + 14*0.5 (res half) + 1 attendance (only a is official) = 24; no team penalty
    expect(t1.penaltyPoints).toBe(0);
    // reserve individual loses 3 pts: 14 pos − 3 pen = 11 (no participation since RD)
    const res = computeDriverStandings(data, "F1").find((r) => r.driverId === "res")!;
    expect(res.totalPoints).toBe(11);
    expect(res.penaltyPoints).toBe(-3);
  });

  it("multiple penalties in the same race accumulate", () => {
    const penalties: Penalty[] = [
      { raceId: "r1", driverId: "a", category: "F1", level: "leve",  points: -1 },
      { raceId: "r1", driverId: "a", category: "F1", level: "media", points: -2 },
    ];
    const data = makeData({
      drivers: drv, teams: [team], races: RACES,
      results: [{ raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false }],
      penalties,
    });
    const a = computeDriverStandings(data, "F1").find((r) => r.driverId === "a")!;
    // 16 + 1 part − 3 total pen = 14
    expect(a.penaltyPoints).toBe(-3);
    expect(a.totalPoints).toBe(14);
    expect(a.races[0].penaltyPoints).toBe(-3);
  });
});
