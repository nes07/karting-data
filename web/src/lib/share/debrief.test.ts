import { describe, expect, it } from "vitest";
import { buildDebriefShare } from "./debrief";

const photos = {
  TULI: "https://img/tuli.jpg",
  GIORGIO: "https://img/giorgio.jpg",
  "NICO E": "https://img/nico.jpg",
  PAO: "https://img/pao.jpg",
  WIDOW: "https://img/widow.jpg",
};

describe("buildDebriefShare", () => {
  it("keeps the headline and clips a long lede on a word", () => {
    const share = buildDebriefShare({
      title: "Round 8: Octubre — TULI manda",
      excerpt: "Una bajada ".repeat(40),
      monthLabel: "Octubre",
      date: "2026-11-01",
      aliases: ["TULI"],
      photos,
    });
    expect(share.title).toBe("Round 8: Octubre — TULI manda");
    expect(share.kicker).toBe("DEBRIEF · OCTUBRE");
    expect(share.dateLabel).toBe("01.11.2026");
    expect(share.excerpt.endsWith("…")).toBe(true);
    expect(share.excerpt.length).toBeLessThanOrEqual(221);
  });

  it("takes the first four featured drivers that have a photo, in order", () => {
    const share = buildDebriefShare({
      title: "Titular",
      excerpt: "Bajada corta.",
      monthLabel: "Octubre",
      date: "2026-11-01",
      aliases: ["SIN FOTO", "TULI", "TULI", "GIORGIO", "NICO E", "PAO", "WIDOW"],
      photos,
    });
    expect(share.people.map((p) => p.alias)).toEqual(["TULI", "GIORGIO", "NICO E", "PAO"]);
    expect(share.excerpt).toBe("Bajada corta.");
  });
});
