/** Sessions before this date ran on the old track layout — excluded from VR. */
export const TRACK_RESET_DATE = "2026-05-10";

export interface VueltaRapidaRow {
  rank: number;
  alias: string;
  time: number;
  date: string;
  variation: number | null;
}

export interface LapTimeInput {
  driver_id: string;
  session_date: string;
  best_time: number;
}

export function computeVueltaRapida(
  laps: LapTimeInput[],
  aliasById: Map<string, string>
): VueltaRapidaRow[] {
  const eligible = laps.filter((l) => l.session_date >= TRACK_RESET_DATE);
  if (eligible.length === 0) return [];

  const rankFor = (subset: LapTimeInput[]): Map<string, number> => {
    const best = new Map<string, { time: number; date: string }>();
    for (const l of subset) {
      const cur = best.get(l.driver_id);
      if (!cur || l.best_time < cur.time) {
        best.set(l.driver_id, { time: l.best_time, date: l.session_date });
      }
    }
    const sorted = [...best.entries()].sort((a, b) => a[1].time - b[1].time);
    return new Map(sorted.map(([id], i) => [id, i + 1]));
  };

  const latestDate = eligible.reduce(
    (max, l) => (l.session_date > max ? l.session_date : max),
    ""
  );
  const prevRanks = rankFor(eligible.filter((l) => l.session_date < latestDate));

  const best = new Map<string, { time: number; date: string }>();
  for (const l of eligible) {
    const cur = best.get(l.driver_id);
    if (!cur || l.best_time < cur.time) {
      best.set(l.driver_id, { time: l.best_time, date: l.session_date });
    }
  }
  return [...best.entries()]
    .sort((a, b) => a[1].time - b[1].time)
    .map(([driverId, b], i) => {
      const prev = prevRanks.get(driverId);
      return {
        rank: i + 1,
        alias: aliasById.get(driverId) ?? "?",
        time: b.time,
        date: b.date,
        variation: prev != null ? prev - (i + 1) : null,
      };
    });
}
