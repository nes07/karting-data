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
  paginateRows,
  POST_FIRST_PAGE_ROWS,
  selectRows,
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

describe("selectRows", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ rank: i + 1 }));

  it("returns everything when it fits", () => {
    const r = selectRows(rows.slice(0, 5), 10, null);
    expect(r.rows).toHaveLength(5);
    expect(r.truncated).toBe(false);
  });

  it("truncates to the head without highlight", () => {
    const r = selectRows(rows, 10, null);
    expect(r.rows.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.truncated).toBe(true);
  });

  it("keeps a highlight outside the head visible in the last slot", () => {
    const r = selectRows(rows, 10, 15);
    expect(r.rows).toHaveLength(10);
    expect(r.rows[9].rank).toBe(15);
    expect(r.truncated).toBe(true);
  });
});

describe("paginateRows", () => {
  const rows = Array.from({ length: 16 }, (_, i) => ({ rank: i + 1 }));

  it("keeps stories in a single page", () => {
    const r = paginateRows(rows, "story", null, 1);
    expect(r.rows).toHaveLength(16);
    expect(r.pageCount).toBe(1);
  });

  it("splits posts into podium page + continuation pages", () => {
    const p1 = paginateRows(rows, "post", null, 1);
    expect(p1.rows.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(p1.pageCount).toBe(2);
    const p2 = paginateRows(rows, "post", null, 2);
    expect(p2.rows[0].rank).toBe(POST_FIRST_PAGE_ROWS + 1);
    expect(p2.rows.at(-1)?.rank).toBe(16);
  });

  it("clamps out-of-range pages", () => {
    const r = paginateRows(rows, "post", null, 99);
    expect(r.page).toBe(2);
  });

  it("keeps highlights single-page even in post format", () => {
    const r = paginateRows(rows, "post", 15, 1);
    expect(r.pageCount).toBe(1);
    expect(r.rows.some((x) => x.rank === 15)).toBe(true);
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
  const f1 = [driverRow({ rank: 5, alias: "NES", totalPoints: 44, bestTime: 39.2 })];
  const vr = [vrRow({ rank: 17, alias: "NES", time: 38.9 })];

  it("builds the profile with championship and VR ranks", () => {
    const p = buildDriverProfile(f1, [], vr, { NES: "https://x/nes.jpg" }, "NES");
    expect(p).toMatchObject({
      alias: "NES",
      category: "F1",
      categoryLabel: "F1 MODERNA",
      champRank: 5,
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
      { raceId: "r2", driverId: "d1", category: "F1", position: 1, bestTime: 38.1, isReserve: false },
      { raceId: "r2", driverId: "d2", category: "F1", position: 2, bestTime: 38.46, isReserve: true },
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
    });
    expect(round!.rows[1]).toMatchObject({
      alias: "TIT",
      escuderia: "RD",
      dif: "+0.360",
      pts: 15,
    });
  });

  it("returns null when the date has no results", () => {
    expect(buildRoundShare(data, "2026-06-07", "F1", {}, "story")).toBeNull();
    expect(buildRoundShare(data, "2030-01-01", "F1", {}, "story")).toBeNull();
  });
});
