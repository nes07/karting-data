import { describe, expect, it } from "vitest";
import { computeVueltaRapida, TRACK_RESET_DATE } from "./vuelta-rapida";

const alias = new Map([
  ["a", "ALFA"],
  ["b", "BRAVO"],
  ["c", "CHARLIE"],
]);

describe("computeVueltaRapida", () => {
  it("ignores sessions before track reset", () => {
    const rows = computeVueltaRapida(
      [{ driver_id: "a", session_date: "2026-05-01", best_time: 50 }],
      alias
    );
    expect(rows).toEqual([]);
  });

  it("ranks best lap per driver on or after reset date", () => {
    const rows = computeVueltaRapida(
      [
        { driver_id: "a", session_date: TRACK_RESET_DATE, best_time: 58.1 },
        { driver_id: "b", session_date: "2026-05-11", best_time: 57.9 },
        { driver_id: "a", session_date: "2026-05-12", best_time: 58.5 },
      ],
      alias
    );
    expect(rows.map((r) => r.alias)).toEqual(["BRAVO", "ALFA"]);
    expect(rows[0].time).toBe(57.9);
    expect(rows[1].time).toBe(58.1);
  });

  it("computes rank variation vs previous session date", () => {
    const rows = computeVueltaRapida(
      [
        { driver_id: "a", session_date: "2026-05-10", best_time: 58.0 },
        { driver_id: "b", session_date: "2026-05-10", best_time: 57.5 },
        { driver_id: "a", session_date: "2026-05-17", best_time: 57.0 },
        { driver_id: "b", session_date: "2026-05-17", best_time: 57.8 },
      ],
      alias
    );
    const alfa = rows.find((r) => r.alias === "ALFA");
    const bravo = rows.find((r) => r.alias === "BRAVO");
    expect(alfa?.rank).toBe(1);
    expect(alfa?.variation).toBe(1);
    expect(bravo?.rank).toBe(2);
    expect(bravo?.variation).toBe(-1);
  });
});
