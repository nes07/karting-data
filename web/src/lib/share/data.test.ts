import { describe, expect, it } from "vitest";
import type {
  ChampionshipData,
  DriverStandingRow,
} from "@/lib/scoring/types";
import { DEFAULT_SCORING_CONFIG } from "@/lib/scoring/types";
import type { VueltaRapidaRow } from "@/lib/vuelta-rapida";
import {
  buildDriverProfile,
  buildDriversShare,
  buildRoundShare,
  buildVrShare,
  fmtSharePts,
  fmtShareTime,
  HIGHLIGHT_TOP,
  lastOfficialPositionsGained,
  MAX_TABLE_ROWS,
  selectRowsWithContext,
} from "./data";

function driverRow(overrides: Partial<DriverStandingRow>): DriverStandingRow {
  return {
    rank: 1,
    driverId: "d1",
    alias: "Piloto",
    escuderia: "Ferrari",
    isReserve: false,
    totalPoints: 10,
    positionPoints: 10,
    participationPoints: 0,
    dotdPoints: 0,
    penaltyPoints: 0,
    races: [],
    droppedPoints: 0,
    posProm: null,
    bestTime: null,
    variation: null,
    ...overrides,
  };
}

function vrRow(overrides: Partial<VueltaRapidaRow>): VueltaRapidaRow {
  return {
    rank: 1,
    alias: "Piloto",
    time: 38.5,
    date: "2026-06-01",
    variation: null,
    ...overrides,
  };
}

describe("formatters", () => {
  it("formats lap times with 3 decimals", () => {
    expect(fmtShareTime(38.08)).toBe("38.080");
    expect(fmtShareTime(null)).toBe("—");
    expect(fmtShareTime(999)).toBe("—");
  });

  it("keeps points as-is", () => {
    expect(fmtSharePts(34.5)).toBe("34.5");
    expect(fmtSharePts(34)).toBe("34");
    expect(fmtSharePts(null)).toBe("—");
  });
});

describe("selectRowsWithContext", () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ rank: i + 1 }));

  it("returns everything when it fits", () => {
    const r = selectRowsWithContext(rows.slice(0, 5), null, 10);
    expect(r.rows).toHaveLength(5);
    expect(r.truncated).toBe(false);
  });

  it("takes the top N without a highlight (post = 10, story = 16)", () => {
    expect(selectRowsWithContext(rows, null, MAX_TABLE_ROWS.post).rows.map((x) => x.rank)).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );
    expect(selectRowsWithContext(rows, null, MAX_TABLE_ROWS.story).rows).toHaveLength(16);
  });

  it("keeps a highlight inside the top 10 in the head of the table", () => {
    const r = selectRowsWithContext(rows, 8, 10);
    expect(r.rows.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.truncated).toBe(true);
  });

  it("shows podium + symmetric window around a driver outside the top 10", () => {
    const r = selectRowsWithContext(rows, 15, 10);
    expect(r.rows).toHaveLength(10);
    expect(r.rows.slice(0, 3).map((x) => x.rank)).toEqual([1, 2, 3]);
    expect(r.rows.slice(3).map((x) => x.rank)).toEqual([12, 13, 14, 15, 16, 17, 18]);
    expect(HIGHLIGHT_TOP).toBe(10);
  });

  it("fills toward the available side at the bottom of the table", () => {
    const r = selectRowsWithContext(rows, 25, 10);
    expect(r.rows.slice(0, 3).map((x) => x.rank)).toEqual([1, 2, 3]);
    expect(r.rows.slice(3).map((x) => x.rank)).toEqual([19, 20, 21, 22, 23, 24, 25]);
  });

  it("fills toward the available side just below the podium", () => {
    const r = selectRowsWithContext(rows, 11, 10);
    expect(r.rows.slice(0, 3).map((x) => x.rank)).toEqual([1, 2, 3]);
    expect(r.rows.slice(3).map((x) => x.rank)).toEqual([8, 9, 10, 11, 12, 13, 14]);
  });
});

describe("buildDriversShare", () => {
  const rows = [
    driverRow({ rank: 1, alias: "NES", totalPoints: 63 }),
    driverRow({ rank: 2, alias: "TIT", totalPoints: 55, driverId: "d2" }),
  ];

  it("maps rows with photos and points", () => {
    const share = buildDriversShare(rows, "F1", { NES: "https://x/nes.jpg" }, "story");
    expect(share.title).toBe("STANDINGS");
    expect(share.subtitle).toBe("PILOTOS F1");
    expect(share.rows[0]).toMatchObject({
      rank: 1,
      label: "NES",
      escuderia: "Ferrari",
      value: "63",
      photo: "https://x/nes.jpg",
      highlighted: false,
    });
    expect(share.rows[1].photo).toBeNull();
    expect(share.highlight).toBeNull();
  });

  it("marks the highlighted driver", () => {
    const share = buildDriversShare(rows, "F1", {}, "story", "TIT");
    expect(share.highlight?.rank).toBe(2);
    expect(share.rows.find((r) => r.label === "TIT")?.highlighted).toBe(true);
  });
});

describe("buildVrShare", () => {
  const rows = [
    vrRow({ rank: 1, alias: "NES", time: 38.08 }),
    vrRow({ rank: 2, alias: "TIT", time: 38.44 }),
  ];

  it("formats times and finds the highlight", () => {
    const share = buildVrShare(rows, {}, {}, "post", "TIT");
    expect(share.valueLabel).toBe("TIEMPO");
    expect(share.rows[0].value).toBe("38.080");
    expect(share.highlight?.label).toBe("TIT");
  });

  it("computes the gap to the leader", () => {
    const share = buildVrShare(rows, {}, {}, "story");
    expect(share.rows[0].gap).toBe("—");
    expect(share.rows[1].gap).toBe("+0.360");
  });

  it("attaches escuderías from the alias map", () => {
    const share = buildVrShare(rows, {}, { NES: "Ferrari" }, "story");
    expect(share.rows[0].escuderia).toBe("Ferrari");
    expect(share.rows[1].escuderia).toBeNull();
  });
});

describe("buildDriverProfile", () => {
  const f1 = [
    driverRow({ rank: 5, alias: "NES", totalPoints: 44, bestTime: 39.2, variation: 2 }),
  ];
  const vr = [vrRow({ rank: 17, alias: "NES", time: 38.9 })];

  it("builds the profile with championship and VR ranks", () => {
    const p = buildDriverProfile(f1, [], vr, { NES: "https://x/nes.jpg" }, "NES");
    expect(p).toMatchObject({
      alias: "NES",
      category: "F1",
      categoryLabel: "F1 MODERNA",
      champRank: 5,
      variation: 2,
      totalPoints: "44",
      bestTime: "38.900",
      vrRank: 17,
      vrLabel: "17º mejor tiempo GKD",
    });
  });

  it("falls back to standing bestTime without VR entry", () => {
    const p = buildDriverProfile(f1, [], [], {}, "NES");
    expect(p?.bestTime).toBe("39.200");
    expect(p?.vrRank).toBeNull();
    expect(p?.vrLabel).toBeNull();
    expect(p?.positionsGained).toBeNull();
  });

  it("returns null for unknown alias", () => {
    expect(buildDriverProfile(f1, [], vr, {}, "NADIE")).toBeNull();
  });
});

describe("buildRoundShare", () => {
  const data: ChampionshipData = {
    drivers: [
      { id: "d1", alias: "NES", active: true },
      { id: "d2", alias: "TIT", active: true },
    ],
    teams: [
      {
        id: "t1",
        name: "Rojo",
        escuderia: "Ferrari",
        category: "F1",
        driver1Id: "d1",
        driver2Id: null,
      },
    ],
    races: [
      { id: "r1", date: "2026-06-07", monthLabel: "Junio", isOfficial: true, startTime: "12:00:00" },
      { id: "r2", date: "2026-07-05", monthLabel: "Julio", isOfficial: true, startTime: "12:00:00" },
    ],
    results: [
      { raceId: "r2", driverId: "d1", category: "F1", position: 1, bestTime: 38.1, isReserve: false, gridPosition: 3 },
      { raceId: "r2", driverId: "d2", category: "F1", position: 2, bestTime: 38.46, isReserve: true, gridPosition: 1 },
    ],
    dotd: [],
    penalties: [],
    config: DEFAULT_SCORING_CONFIG,
  };

  it("builds rows with gap to the best lap and round number", () => {
    const round = buildRoundShare(data, "2026-07-05", "F1", {}, "story");
    expect(round).not.toBeNull();
    expect(round!.roundNumber).toBe(2);
    expect(round!.rows[0]).toMatchObject({
      pos: 1,
      alias: "NES",
      escuderia: "Ferrari",
      time: "38.100",
      dif: "+0.000",
      pts: 16,
      gained: 2,
    });
    expect(round!.rows[1]).toMatchObject({
      alias: "TIT",
      escuderia: "RD",
      dif: "+0.360",
      pts: 15,
      gained: -1,
    });
  });

  it("truncates posts to the top 10", () => {
    const many: ChampionshipData = {
      ...data,
      drivers: Array.from({ length: 16 }, (_, i) => ({
        id: `d${i + 1}`,
        alias: `P${i + 1}`,
        active: true,
      })),
      results: Array.from({ length: 16 }, (_, i) => ({
        raceId: "r2",
        driverId: `d${i + 1}`,
        category: "F1" as const,
        position: i + 1,
        bestTime: 38 + i * 0.1,
        isReserve: false,
      })),
    };
    const round = buildRoundShare(many, "2026-07-05", "F1", {}, "post");
    expect(round!.rows).toHaveLength(10);
    expect(round!.truncated).toBe(true);
    expect(round!.rows.at(-1)?.pos).toBe(10);
  });

  it("returns null when the date has no results", () => {
    expect(buildRoundShare(data, "2026-06-07", "F1", {}, "story")).toBeNull();
    expect(buildRoundShare(data, "2030-01-01", "F1", {}, "story")).toBeNull();
  });
});

describe("lastOfficialPositionsGained", () => {
  const data: ChampionshipData = {
    drivers: [{ id: "d1", alias: "NES", active: true }],
    teams: [],
    races: [
      { id: "r1", date: "2026-06-07", monthLabel: "Junio", isOfficial: true, startTime: "12:00:00" },
      { id: "r2", date: "2026-07-05", monthLabel: "Julio", isOfficial: true, startTime: "12:00:00" },
    ],
    results: [
      { raceId: "r1", driverId: "d1", category: "F1", position: 4, isReserve: false, gridPosition: 8 },
      { raceId: "r2", driverId: "d1", category: "F1", position: 2, isReserve: false, gridPosition: 5 },
    ],
    dotd: [],
    penalties: [],
    config: DEFAULT_SCORING_CONFIG,
  };

  it("uses the latest official race the driver contested", () => {
    expect(lastOfficialPositionsGained(data, "d1")).toBe(3);
  });
});
