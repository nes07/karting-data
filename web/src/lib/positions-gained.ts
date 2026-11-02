/**
 * Positions Gained: starting grid (qualifying) minus finishing position.
 * Positive = gained places; negative = lost places.
 */
export function positionsGained(
  gridPosition: number | null | undefined,
  finishPosition: number
): number | null {
  if (gridPosition == null || gridPosition < 1 || finishPosition < 1) return null;
  return gridPosition - finishPosition;
}

export function formatPositionsGained(gained: number | null | undefined): string {
  if (gained == null) return "—";
  if (gained === 0) return "=";
  if (gained > 0) return `+${gained}`;
  return String(gained);
}

export function positionsGainedClass(
  gained: number | null | undefined
): "up" | "down" | "flat" | "empty" {
  if (gained == null) return "empty";
  if (gained > 0) return "up";
  if (gained < 0) return "down";
  return "flat";
}
