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
  { id: "r1", date: "2026-03-22", monthLabel: "Marzo", isOfficial: true, startTime: "12:00:00" },
  { id: "r2", date: "2026-04-12", monthLabel: "Abril", isOfficial: true, startTime: "12:00:00" },
  { id: "r3", date: "2026-05-17", monthLabel: "Mayo", isOfficial: true, startTime: "12:00:00" },
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
  it("totals = position points + participation + DOTD (minus worst-result drop)", () => {
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
    // Cells: r1 = 16+1+1 = 18, r2 = 15+1 = 16. Attended every race, so the
    // worst cell (16) is dropped automatically: 34 − 16 = 18.
    expect(a.totalPoints).toBe(18);
    expect(a.droppedPoints).toBe(16);
    expect(a.participationPoints).toBe(2);
    expect(a.dotdPoints).toBe(1);

    const b = rows.find((r) => r.driverId === "b")!;
    // 15 + 1 participation; missed r2, so the absence is the drop.
    expect(b.totalPoints).toBe(16);
    expect(b.droppedPoints).toBe(0);
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

  it("DOTD is folded into the race cell; cells minus the drop sum to the total", () => {
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
    // r1: 16 pos + 1 part + 1 dotd = 18; r2: 14 pos + 1 part = 15 (dropped)
    const cellSum = a.races.reduce((s, c) => s + c.points, 0);
    expect(a.races.find((c) => c.monthLabel === "Marzo")!.points).toBe(18);
    expect(cellSum - a.droppedPoints).toBe(a.totalPoints);
  });

  it("tiebreak: equal points -> better average position wins", () => {
    const data = makeData({
      drivers: [driver("a"), driver("b")],
      races: RACES,
      results: [
        // a: P3 then P5 -> cells 15, 13; drop 13 -> 15 pts, posProm 4
        { raceId: "r1", driverId: "a", category: "F1", position: 3, isReserve: false },
        { raceId: "r2", driverId: "a", category: "F1", position: 5, isReserve: false },
        // b: P5 then P3 -> cells 13, 15; drop 13 -> 15 pts, posProm 4
        { raceId: "r1", driverId: "b", category: "F1", position: 5, isReserve: false },
        { raceId: "r2", driverId: "b", category: "F1", position: 3, isReserve: false },
      ],
    });
    const rows = computeDriverStandings(data, "F1");
    // both 15 pts and posProm 4 -> falls to bestTime (both null) -> stable
    expect(rows[0].totalPoints).toBe(rows[1].totalPoints);
    expect(rows[0].posProm).toBe(rows[1].posProm);
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

    // With the worst-result drop both a and b end at 17 (drop r2/r1 resp.);
    // tie broken by posProm: b 1.5 beats a 5.5. c keeps 16 (absence = drop).
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
    // With inherited drops both teams end at 17; tie broken by posProm
    // (t2 1.5 beats t1 5.5).
    expect(t2.rank).toBe(1);
    expect(t2.variation).toBe(1);
    expect(t1.rank).toBe(2);
    expect(t1.variation).toBe(-1);
  });
});

describe("worst-result drop", () => {
  const team: Team = {
    id: "t1", name: "Equipo 1", escuderia: "Ferrari", category: "F1",
    driver1Id: "a", driver2Id: "b",
  };
  const drivers = [driver("a"), driver("b"), driver("c"), driver("res")];

  it("a driver who attended every race drops their worst cell", () => {
    const data = makeData({
      drivers,
      races: RACES,
      results: [
        { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false }, // 17
        { raceId: "r2", driverId: "a", category: "F1", position: 10, isReserve: false }, // 8
        { raceId: "r3", driverId: "a", category: "F1", position: 2, isReserve: false }, // 16
      ],
    });
    const a = computeDriverStandings(data, "F1").find((r) => r.driverId === "a")!;
    expect(a.droppedPoints).toBe(8);
    expect(a.totalPoints).toBe(33); // 17 + 16
    const dropped = a.races.filter((c) => c.dropped);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].monthLabel).toBe("Abril");
  });

  it("an absence counts as the worst result: no attended race is dropped", () => {
    const data = makeData({
      drivers,
      races: RACES,
      results: [
        // b misses r2; someone else completes it.
        { raceId: "r1", driverId: "b", category: "F1", position: 5, isReserve: false },
        { raceId: "r2", driverId: "c", category: "F1", position: 1, isReserve: false },
        { raceId: "r3", driverId: "b", category: "F1", position: 4, isReserve: false },
      ],
    });
    const b = computeDriverStandings(data, "F1").find((r) => r.driverId === "b")!;
    expect(b.droppedPoints).toBe(0);
    expect(b.races.some((c) => c.dropped)).toBe(false);
    expect(b.totalPoints).toBe(12 + 1 + 13 + 1); // P5 + P4, both races count
  });

  it("a negative cell (penalties) is dropped even with absences on record", () => {
    const data = makeData({
      drivers,
      races: RACES,
      results: [
        // c races once: P17 = 0 pos pts, +1 part, −4 penalty = −3.
        { raceId: "r1", driverId: "c", category: "F1", position: 17, isReserve: false },
        { raceId: "r2", driverId: "a", category: "F1", position: 1, isReserve: false },
      ],
      penalties: [
        { raceId: "r1", driverId: "c", category: "F1", level: "gravisima", points: -4 },
      ],
    });
    const c = computeDriverStandings(data, "F1").find((r) => r.driverId === "c")!;
    expect(c.droppedPoints).toBe(-3);
    expect(c.totalPoints).toBe(0);
    expect(c.races[0].dropped).toBe(true);
  });

  it("no drop with a single completed race", () => {
    const data = makeData({
      drivers,
      races: RACES,
      results: [
        { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
      ],
    });
    const a = computeDriverStandings(data, "F1").find((r) => r.driverId === "a")!;
    expect(a.droppedPoints).toBe(0);
    expect(a.totalPoints).toBe(17);
    expect(a.races.some((c) => c.dropped)).toBe(false);
  });

  it("teams inherit the drop: the pilot's contribution leaves the team total", () => {
    const data = makeData({
      drivers,
      teams: [team],
      races: RACES,
      results: [
        // a attends all three; r2 is his worst (P10 + DOTD = 9 driver-side).
        { raceId: "r1", driverId: "a", category: "F1", position: 1, isReserve: false },
        { raceId: "r2", driverId: "a", category: "F1", position: 10, isReserve: false },
        { raceId: "r3", driverId: "a", category: "F1", position: 2, isReserve: false },
        // b misses r2 -> absence is his drop, contributes normally elsewhere.
        { raceId: "r1", driverId: "b", category: "F1", position: 3, isReserve: false },
        { raceId: "r3", driverId: "b", category: "F1", position: 4, isReserve: false },
      ],
      dotd: [{ raceId: "r2", driverId: "a", category: "F1" }],
    });
    const t1 = computeTeamStandings(data, "F1").find((r) => r.teamId === "t1")!;
    // Cells: r1 = 16+14+2 = 32, r2 = 7+1+1(dotd) = 9, r3 = 15+13+2 = 30.
    // a's r2 contribution (7 pos + 1 att + 1 dotd = 9) is inherited as drop.
    const r2 = t1.races.find((c) => c.monthLabel === "Abril")!;
    expect(r2.points).toBe(9);
    expect(r2.droppedPoints).toBe(9);
    expect(t1.droppedPoints).toBe(9);
    expect(t1.totalPoints).toBe(32 + 9 + 30 - 9);
  });

  it("a reserve's drop never affects the replaced team", () => {
    const t2: Team = {
      id: "t2", name: "Equipo 2", escuderia: "McLaren", category: "F1",
      driver1Id: "c", driver2Id: null,
    };
    const data = makeData({
      drivers,
      teams: [t2],
      races: RACES,
      results: [
        // res races both dates replacing t2; attended all -> drops worst (r2).
        { raceId: "r1", driverId: "res", category: "F1", position: 2, isReserve: true, replacedTeamId: "t2" },
        { raceId: "r2", driverId: "res", category: "F1", position: 4, isReserve: true, replacedTeamId: "t2" },
      ],
    });
    const res = computeDriverStandings(data, "F1").find((r) => r.driverId === "res")!;
    expect(res.droppedPoints).toBe(13); // P4, no participation (RD)
    expect(res.totalPoints).toBe(15);

    const team2 = computeTeamStandings(data, "F1").find((r) => r.teamId === "t2")!;
    // Halves intact: 15*0.5 + 13*0.5 = 14; nothing inherited from the RD drop.
    expect(team2.droppedPoints).toBe(0);
    expect(team2.totalPoints).toBe(14);
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
