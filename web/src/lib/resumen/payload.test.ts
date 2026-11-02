import { describe, expect, it } from "vitest";
import { buildNarration, buildResumenPayload } from "./payload";
import { buildTimeline, sceneAt } from "./timeline";
import type { CatFacts, DebriefFacts, ResultFact, StandingFact } from "@/lib/debrief/types";

function named(alias: string, pos: number): ResultFact {
  return {
    alias,
    escuderia: "Ferrari",
    photo: null,
    pos,
    grid: pos + 2,
    gained: 2,
    time: 37.5,
    pts: 16 - pos + 1,
    dnf: false,
  };
}

function standing(alias: string, rank: number, pts: number): StandingFact {
  return {
    alias,
    escuderia: alias === "Ferrari" ? "Ferrari" : "McLaren",
    photo: null,
    rank,
    pts,
    prevRank: rank,
    prevPts: pts - 10,
    gapToLeader: rank === 1 ? 0 : 10,
  };
}

function emptyCat(category: "F1" | "F2"): CatFacts {
  return {
    category,
    winner: null,
    podium: [],
    results: [],
    gainers: [],
    losers: [],
    formUp: [],
    formDown: [],
    drivers: [],
    teams: [],
    battles: [],
    teamBattles: [],
  };
}

describe("buildResumenPayload", () => {
  it("copies the chosen category", () => {
    const f1 = emptyCat("F1");
    f1.winner = named("NICO", 1);
    f1.podium = [named("NICO", 1), named("TULI", 2), named("JOA", 3)];
    f1.results = f1.podium;
    f1.drivers = [standing("NICO", 1, 80), standing("TULI", 2, 70)];
    f1.teams = [standing("Ferrari", 1, 120)];
    const facts: DebriefFacts = {
      raceId: "r",
      date: "2026-11-01",
      monthLabel: "Noviembre",
      roundNumber: 8,
      F1: f1,
      F2: emptyCat("F2"),
      vr: { big: [], small: [] },
    };
    const p = buildResumenPayload(facts, "F1");
    expect(p.roundNumber).toBe(8);
    expect(p.winner?.alias).toBe("NICO");
    expect(buildNarration(p)).toMatch(/Round 8/);
    expect(buildNarration(p)).toMatch(/NICO/);
  });
});

describe("buildTimeline", () => {
  it("covers intro through outro without gaps", () => {
    const { scenes, duration } = buildTimeline(12, 20, 10);
    expect(scenes[0].id).toBe("intro");
    expect(scenes[scenes.length - 1].id).toBe("outro");
    expect(duration).toBeGreaterThan(40);
    expect(sceneAt(scenes, 0)?.id).toBe("intro");
    expect(sceneAt(scenes, duration - 0.01)?.id).toBe("outro");
  });
});
