import { cache } from "react";
import { loadSiteData, SiteData } from "@/lib/data";

/** Deduped site fetch per request (layout + pages). */
export const getSiteData = cache(async (): Promise<SiteData> => loadSiteData());

export function getStandingsMonths(site: SiteData): string[] {
  return site.data.races
    .filter((r) => r.isOfficial)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => r.monthLabel);
}

export function getDriverPhotos(site: SiteData): Record<string, string> {
  return Object.fromEntries(
    site.data.drivers.filter((d) => d.photoUrl).map((d) => [d.alias, d.photoUrl!])
  );
}

export function getTeamPhotos(site: SiteData): Record<string, string> {
  return Object.fromEntries(
    site.data.teams.filter((t) => t.photoUrl).map((t) => [t.escuderia, t.photoUrl!])
  );
}
