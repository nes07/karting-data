/**
 * In Karteando, qualifying is the session immediately before the race.
 * If the race is session 80, quali is 79 (always the previous / odd id).
 */
export function guessQualiSessionId(
  sessions: Array<{ sessionId: string }>,
  raceSessionId: string
): string | null {
  const idx = sessions.findIndex((s) => s.sessionId === raceSessionId);
  if (idx > 0) {
    const prev = sessions[idx - 1].sessionId;
    const raceN = Number(raceSessionId);
    const prevN = Number(prev);
    if (Number.isInteger(raceN) && Number.isInteger(prevN) && prevN === raceN - 1) {
      return prev;
    }
    return prev;
  }
  const n = Number(raceSessionId);
  if (Number.isInteger(n) && n > 1) {
    const want = String(n - 1);
    return sessions.find((s) => s.sessionId === want)?.sessionId ?? null;
  }
  return null;
}

export interface QualiResult {
  webName: string;
  position: number | null;
  driverId: string | null;
}

export interface GridRow {
  webName: string;
  driverId: string | null;
  category: "F1" | "F2";
  gridPosition: number | null;
}

/** Overlay qualifying positions onto imported race rows of the same category. */
export function applyQualiToImported<T extends GridRow>(
  rows: T[],
  quali: QualiResult[],
  category: "F1" | "F2"
): T[] {
  const byName = new Map<string, number>();
  const byDriver = new Map<string, number>();
  for (const q of quali) {
    if (q.position == null || q.position < 1) continue;
    byName.set(q.webName, q.position);
    if (q.driverId) byDriver.set(q.driverId, q.position);
  }
  return rows.map((row) => {
    if (row.category !== category) return row;
    const gp =
      (row.driverId ? byDriver.get(row.driverId) : undefined) ??
      byName.get(row.webName) ??
      null;
    return { ...row, gridPosition: gp };
  });
}
