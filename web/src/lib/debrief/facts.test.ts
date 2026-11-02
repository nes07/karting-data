import { describe, expect, it } from "vitest";
import { buildDebriefFacts } from "./facts";
import { sliceChampionship } from "./slice";
import { parseArticle, writeTemplateArticle } from "./write";
import {
  ChampionshipData,
  DEFAULT_SCORING_CONFIG,
  Driver,
  Race,
  RaceResult,
  Team,
} from "@/lib/scoring/types";

function driver(id: string): Driver {
  return { id, alias: id.toUpperCase(), active: true, photoUrl: null };
}

function team(
  id: string,
  escuderia: string,
  category: "F1" | "F2",
  d1: string,
  d2: string
): Team {
  return {
    id,
    name: id,
    escuderia,
    category,
    driver1Id: d1,
    driver2Id: d2,
  };
}

const RACES: Race[] = [
  { id: "r1", date: "2026-03-22", monthLabel: "Marzo", isOfficial: true, startTime: "12:00:00" },
  { id: "r2", date: "2026-04-12", monthLabel: "Abril", isOfficial: true, startTime: "12:00:00" },
  { id: "r3", date: "2026-05-17", monthLabel: "Mayo", isOfficial: true, startTime: "12:00:00" },
];

function res(
  raceId: string,
  driverId: string,
  position: number,
  extra: Partial<RaceResult> = {}
): RaceResult {
  return {
    raceId,
    driverId,
    category: "F1",
    position,
    isReserve: false,
    ...extra,
  };
}

function makeData(): ChampionshipData {
  const ids = ["a", "b", "c", "d", "e", "f"];
  return {
    drivers: ids.map(driver),
    teams: [
      team("t1", "Ferrari", "F1", "a", "b"),
      team("t2", "McLaren", "F1", "c", "d"),
      team("t3", "Mercedes", "F1", "e", "f"),
    ],
    races: RACES,
    results: [
      res("r1", "a", 1),
      res("r1", "b", 2),
      res("r1", "c", 6),
      res("r1", "d", 3),
      res("r1", "e", 4),
      res("r1", "f", 5),
      res("r2", "a", 2),
      res("r2", "b", 3),
      res("r2", "c", 7, { isDnf: true }),
      res("r2", "d", 1),
      res("r2", "e", 4),
      res("r2", "f", 5),
      res("r3", "c", 1, { gridPosition: 5, bestTime: 37.4, teamId: "t2" }),
      res("r3", "a", 2, { gridPosition: 1, bestTime: 37.6, teamId: "t1" }),
      res("r3", "d", 3, { gridPosition: 2, bestTime: 37.7, teamId: "t2" }),
      res("r3", "b", 6, { gridPosition: 3, bestTime: 38.1, teamId: "t1" }),
      res("r3", "e", 4, { gridPosition: 4, teamId: "t3" }),
      res("r3", "f", 5, { gridPosition: 6, teamId: "t3" }),
    ],
    dotd: [],
    penalties: [],
    config: DEFAULT_SCORING_CONFIG,
  };
}

describe("sliceChampionship", () => {
  it("drops later races when exclusive", () => {
    const sliced = sliceChampionship(makeData(), "2026-05-17", false);
    expect(sliced.races.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(sliced.results.every((r) => r.raceId !== "r3")).toBe(true);
  });
});

describe("buildDebriefFacts", () => {
  const facts = buildDebriefFacts(makeData(), "r3", [
    { driver_id: "a", session_date: "2026-05-11", best_time: 37.5 },
    { driver_id: "d", session_date: "2026-05-11", best_time: 37.55 },
    { driver_id: "e", session_date: "2026-05-11", best_time: 37.6 },
    { driver_id: "f", session_date: "2026-05-11", best_time: 37.7 },
    { driver_id: "c", session_date: "2026-05-11", best_time: 37.9 },
    { driver_id: "a", session_date: "2026-05-17", best_time: 37.6 },
    { driver_id: "c", session_date: "2026-05-17", best_time: 37.4 },
  ]);

  it("returns round metadata", () => {
    expect(facts?.roundNumber).toBe(3);
    expect(facts?.monthLabel).toBe("Mayo");
  });

  it("picks the winner and positions gained from quali", () => {
    expect(facts?.F1.winner?.alias).toBe("C");
    expect(facts?.F1.winner?.gained).toBe(4);
    expect(facts?.F1.gainers[0]?.alias).toBe("C");
    const a = facts?.F1.results.find((r) => r.alias === "A");
    expect(a?.gained).toBe(-1);
  });

  it("flags form vs official-race average (≥3 positions)", () => {
    // C: previous non-DNF cells = P6 only (r2 DNF skipped) → need 2 cells.
    // r1 P6 + we'll still require 2 races; with one valid cell form is skipped.
    // A: r1 P1, r2 P2 avg 1.5, this P2 → delta -0.5, not flagged.
    // B: r1 P2, r2 P3 avg 2.5, this P6 → delta -3.5, formDown.
    expect(facts?.F1.formDown.some((f) => f.alias === "B")).toBe(true);
  });

  it("splits VR into big jumps vs ±1", () => {
    const c = facts?.vr.big.find((m) => m.alias === "C");
    expect(c).toBeTruthy();
    expect(c?.to).toBe(1);
    expect((c?.from ?? 0) > (c?.to ?? 0)).toBe(true);
  });
});

describe("writeTemplateArticle", () => {
  it("names the winner and keeps VR small-moves for last", () => {
    const facts = buildDebriefFacts(makeData(), "r3", [])!;
    const article = writeTemplateArticle(facts);
    expect(article.title).toMatch(/Round 3/);
    expect(article.title).toMatch(/C/);
    expect(article.sections.length).toBeGreaterThanOrEqual(2);
    expect(article.featured).toContain("C");
  });
});

describe("parseArticle", () => {
  it("rejects empty sections", () => {
    expect(parseArticle({ title: "x", excerpt: "", sections: [] })).toBeNull();
  });

  it("accepts a valid payload", () => {
    const a = parseArticle({
      title: "Round 1",
      excerpt: "Ganó A",
      sections: [{ heading: "Carrera", paragraphs: ["A ganó."], mentions: ["A"] }],
      featured: ["A"],
    });
    expect(a?.title).toBe("Round 1");
    expect(a?.sections).toHaveLength(1);
  });
});
