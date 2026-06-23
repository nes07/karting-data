import { describe, expect, it } from "vitest";
import {
  formatStartTimeInput,
  normalizeStartTime,
  parseRaceStart,
  RACE_TIMEZONE,
} from "./race-datetime";

describe("normalizeStartTime", () => {
  it("pads HH:MM to HH:MM:SS", () => {
    expect(normalizeStartTime("9:5")).toBe("09:05:00");
    expect(normalizeStartTime("14:30")).toBe("14:30:00");
  });

  it("keeps full HH:MM:SS", () => {
    expect(normalizeStartTime("12:00:00")).toBe("12:00:00");
  });

  it("falls back for invalid input", () => {
    expect(normalizeStartTime("bad")).toBe("12:00:00");
  });
});

describe("formatStartTimeInput", () => {
  it("returns HH:MM for time inputs", () => {
    expect(formatStartTimeInput("14:30:00")).toBe("14:30");
  });
});

describe("parseRaceStart", () => {
  it("returns a Date in the future for upcoming races", () => {
    const d = parseRaceStart("2099-12-31", "15:00:00");
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });

  it("respects different start times on the same date", () => {
    const morning = parseRaceStart("2026-12-15", "10:00:00");
    const afternoon = parseRaceStart("2026-12-15", "16:00:00");
    expect(afternoon.getTime() - morning.getTime()).toBe(6 * 3600 * 1000);
  });

  it("uses America/Santiago timezone constant", () => {
    expect(RACE_TIMEZONE).toBe("America/Santiago");
  });
});
