import { describe, expect, it } from "vitest";
import {
  formatPositionsGained,
  positionsGained,
  positionsGainedClass,
} from "./positions-gained";
import { applyQualiToImported, guessQualiSessionId } from "./karteando-quali";

describe("positionsGained", () => {
  it("is grid minus finish (positive = gained)", () => {
    expect(positionsGained(5, 1)).toBe(4);
    expect(positionsGained(1, 4)).toBe(-3);
    expect(positionsGained(3, 3)).toBe(0);
  });

  it("returns null without a valid grid", () => {
    expect(positionsGained(null, 1)).toBeNull();
    expect(positionsGained(undefined, 1)).toBeNull();
    expect(positionsGained(0, 1)).toBeNull();
  });
});

describe("formatPositionsGained", () => {
  it("formats signed values", () => {
    expect(formatPositionsGained(3)).toBe("+3");
    expect(formatPositionsGained(-2)).toBe("-2");
    expect(formatPositionsGained(0)).toBe("=");
    expect(formatPositionsGained(null)).toBe("—");
  });
});

describe("positionsGainedClass", () => {
  it("maps to CSS modifiers", () => {
    expect(positionsGainedClass(1)).toBe("up");
    expect(positionsGainedClass(-1)).toBe("down");
    expect(positionsGainedClass(0)).toBe("flat");
    expect(positionsGainedClass(null)).toBe("empty");
  });
});

describe("guessQualiSessionId", () => {
  const sessions = [{ sessionId: "77" }, { sessionId: "78" }, { sessionId: "79" }, { sessionId: "80" }];

  it("picks the previous session (79 for race 80)", () => {
    expect(guessQualiSessionId(sessions, "80")).toBe("79");
  });

  it("falls back to numeric id - 1 if the race is not in the list", () => {
    expect(guessQualiSessionId(sessions, "82")).toBeNull();
    expect(guessQualiSessionId([{ sessionId: "81" }, { sessionId: "82" }], "82")).toBe("81");
  });

  it("returns null for the first session of the day", () => {
    expect(guessQualiSessionId(sessions, "77")).toBeNull();
  });
});

describe("applyQualiToImported", () => {
  it("maps quali position by webName and driverId", () => {
    const rows = [
      { webName: "Nico", driverId: "d1", category: "F1" as const, gridPosition: null },
      { webName: "Tuli", driverId: "d2", category: "F1" as const, gridPosition: null },
      { webName: "Benja", driverId: "d3", category: "F2" as const, gridPosition: null },
    ];
    const next = applyQualiToImported(
      rows,
      [
        { webName: "Nico", position: 4, driverId: "d1" },
        { webName: "Tuli", position: 1, driverId: null },
      ],
      "F1"
    );
    expect(next[0].gridPosition).toBe(4);
    expect(next[1].gridPosition).toBe(1);
    expect(next[2].gridPosition).toBeNull();
  });
});
