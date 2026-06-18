/**
 * lap_times is unique on (driver_id, session_date). When a pilot appears in
 * both F1 and F2 on the same day, keep a single row with their best lap.
 */
export function dedupeLapTimes(
  rows: Array<{ driverId: string; bestTime: number }>
): Array<{ driverId: string; bestTime: number }> {
  const best = new Map<string, number>();
  for (const r of rows) {
    const cur = best.get(r.driverId);
    if (cur == null || r.bestTime < cur) best.set(r.driverId, r.bestTime);
  }
  return [...best.entries()].map(([driverId, bestTime]) => ({
    driverId,
    bestTime,
  }));
}
