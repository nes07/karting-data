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

/**
 * Qualifying often includes drivers who are then removed from the race.
 * Their session position must not stay in the grid: renumber 1..n following
 * the quali order of the drivers who actually start.
 */
export function compactGridPositions<
  T extends {
    raceId?: string;
    race_id?: string;
    category: string;
    gridPosition: number | null;
  },
>(rows: T[], category?: string): T[] {
  const groups = new Map<string, number[]>();
  rows.forEach((row, index) => {
    if (category && row.category !== category) return;
    if (row.gridPosition == null || row.gridPosition < 1) return;
    const key = `${row.raceId ?? row.race_id ?? ""}:${row.category}`;
    const list = groups.get(key) ?? [];
    list.push(index);
    groups.set(key, list);
  });
  const assigned = new Map<number, number>();
  for (const indexes of groups.values()) {
    const ordered = [...indexes].sort(
      (a, b) => rows[a].gridPosition! - rows[b].gridPosition!
    );
    ordered.forEach((index, i) => assigned.set(index, i + 1));
  }
  return rows.map((row, index) => {
    const grid = assigned.get(index);
    if (grid == null || grid === row.gridPosition) return row;
    return { ...row, gridPosition: grid };
  });
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
  const overlaid = rows.map((row) => {
    if (row.category !== category) return row;
    const gp =
      (row.driverId ? byDriver.get(row.driverId) : undefined) ??
      byName.get(row.webName) ??
      null;
    return { ...row, gridPosition: gp };
  });
  return compactGridPositions(overlaid, category);
}
