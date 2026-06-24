/** Championship events use America/Santiago local time. */
export const RACE_TIMEZONE = "America/Santiago";

/** Normalize Postgres time "HH:MM:SS" or "HH:MM" to HH:MM:SS. */
export function normalizeStartTime(raw: string): string {
  const parts = raw.trim().split(":");
  if (parts.length < 2) return "12:00:00";
  const h = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  const s = (parts[2] ?? "00").padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Parse race date + start_time as an instant in America/Santiago.
 * Uses UTC offset lookup via Intl (handles DST when supported).
 */
export function parseRaceStart(date: string, startTime = "12:00:00"): Date {
  const t = normalizeStartTime(startTime);
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi, s] = t.split(":").map(Number);

  // Build a UTC guess, then adjust using formatter offset at that local wall time.
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: RACE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = fmt.formatToParts(guess);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const localAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  const offsetMs = localAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

export function formatStartTimeInput(startTime: string): string {
  return normalizeStartTime(startTime).slice(0, 5);
}
