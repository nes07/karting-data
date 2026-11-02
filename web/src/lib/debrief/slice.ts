import type { ChampionshipData } from "@/lib/scoring/types";

/** Championship state with only races up to `throughDate` (inclusive or not). */
export function sliceChampionship(
  data: ChampionshipData,
  throughDate: string,
  inclusive: boolean
): ChampionshipData {
  const races = data.races.filter((r) =>
    inclusive ? r.date <= throughDate : r.date < throughDate
  );
  const ids = new Set(races.map((r) => r.id));
  return {
    ...data,
    races,
    results: data.results.filter((r) => ids.has(r.raceId)),
    dotd: data.dotd.filter((d) => ids.has(d.raceId)),
    penalties: data.penalties.filter((p) => ids.has(p.raceId)),
  };
}
