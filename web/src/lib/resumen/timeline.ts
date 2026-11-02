export type SceneId =
  | "intro"
  | "winner"
  | "podium"
  | "results"
  | "driversTitle"
  | "drivers"
  | "teamsTitle"
  | "teams"
  | "outro";

export interface Scene {
  id: SceneId;
  start: number;
  end: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function buildTimeline(
  nResults: number,
  nDrivers: number,
  nTeams: number
): { scenes: Scene[]; duration: number } {
  const results = clamp(nResults * 0.55, 8, 16);
  const drivers = clamp(nDrivers * 0.42, 10, 22);
  const teams = clamp(nTeams * 0.55, 8, 16);
  const spans: Array<[SceneId, number]> = [
    ["intro", 3.2],
    ["winner", 5.2],
    ["podium", 6],
    ["results", results],
    ["driversTitle", 2.4],
    ["drivers", drivers],
    ["teamsTitle", 2.4],
    ["teams", teams],
    ["outro", 3.4],
  ];
  const scenes: Scene[] = [];
  let t = 0;
  for (const [id, dur] of spans) {
    scenes.push({ id, start: t, end: t + dur });
    t += dur;
  }
  return { scenes, duration: t };
}

export function sceneAt(scenes: Scene[], t: number): Scene | null {
  for (const s of scenes) {
    if (t >= s.start && t < s.end) return s;
  }
  return scenes[scenes.length - 1] ?? null;
}

export function sceneProgress(s: Scene, t: number): number {
  const d = s.end - s.start;
  if (d <= 0) return 1;
  return clamp((t - s.start) / d, 0, 1);
}

export function fadeOpacity(progress: number, fade = 0.12): number {
  if (progress < fade) return progress / fade;
  if (progress > 1 - fade) return (1 - progress) / fade;
  return 1;
}
