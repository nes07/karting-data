import { describe, expect, it } from "vitest";
import {
  isStartTimeSchemaError,
  raceRowWithOptionalStartTime,
  stripStartTime,
} from "./races-schema";

describe("isStartTimeSchemaError", () => {
  it("detects PostgREST schema cache errors for start_time", () => {
    expect(
      isStartTimeSchemaError(
        "Could not find the 'start_time' column of 'races' in the schema cache"
      )
    ).toBe(true);
    expect(isStartTimeSchemaError("duplicate key value")).toBe(false);
  });
});

describe("raceRowWithOptionalStartTime", () => {
  it("includes start_time when column exists", () => {
    expect(
      raceRowWithOptionalStartTime("2026-07-12", "Julio", true, "15:30:00", true)
    ).toEqual({
      date: "2026-07-12",
      month_label: "Julio",
      is_official: true,
      start_time: "15:30:00",
    });
  });

  it("omits start_time when column missing", () => {
    expect(
      raceRowWithOptionalStartTime("2026-07-12", "Julio", true, "15:30:00", false)
    ).toEqual({
      date: "2026-07-12",
      month_label: "Julio",
      is_official: true,
    });
  });
});

describe("stripStartTime", () => {
  it("removes start_time from row", () => {
    expect(
      stripStartTime({
        date: "2026-07-12",
        month_label: "Julio",
        is_official: true,
        start_time: "15:30:00",
      })
    ).toEqual({
      date: "2026-07-12",
      month_label: "Julio",
      is_official: true,
    });
  });
});
