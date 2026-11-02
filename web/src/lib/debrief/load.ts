import { createClient as createSupabase } from "@supabase/supabase-js";
import { loadLapTimes, loadSiteData } from "@/lib/data";
import { buildDebriefFacts } from "./facts";
import type { DebriefArticle, DebriefFacts } from "./types";

export function asDebriefFacts(raw: unknown): DebriefFacts | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as DebriefFacts;
  if (!o.F1 || !o.F2 || !o.vr) return null;
  if (!Array.isArray(o.F1.results) || !Array.isArray(o.F2.results)) return null;
  if (!Array.isArray(o.vr.big) || !Array.isArray(o.vr.small)) return null;
  return o;
}

function anon() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface PublishedDebrief {
  id: string;
  raceId: string;
  date: string;
  monthLabel: string;
  title: string;
  excerpt: string;
  body: DebriefArticle;
  facts: DebriefFacts | null;
  featured: string[];
  publishedAt: string | null;
}

export async function factsForRace(raceId: string): Promise<DebriefFacts | null> {
  const [site, laps] = await Promise.all([loadSiteData(), loadLapTimes()]);
  return buildDebriefFacts(site.data, raceId, laps);
}

export function officialRacesWithResults(
  data: Awaited<ReturnType<typeof loadSiteData>>["data"]
): Array<{ id: string; date: string; monthLabel: string; roundNumber: number }> {
  const official = [...data.races]
    .filter((r) => r.isOfficial)
    .sort((a, b) => a.date.localeCompare(b.date));
  const withResults = new Set(data.results.map((r) => r.raceId));
  return official
    .map((r, i) => ({
      id: r.id,
      date: r.date,
      monthLabel: r.monthLabel,
      roundNumber: i + 1,
    }))
    .filter((r) => withResults.has(r.id));
}

function raceEmbed(raw: unknown): { date: string; month_label: string } | null {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const o = row as { date?: string; month_label?: string };
  if (!o.date || !o.month_label) return null;
  return { date: o.date, month_label: o.month_label };
}

export async function loadPublishedDebriefs(): Promise<PublishedDebrief[]> {
  const { data, error } = await anon()
    .from("debriefs")
    .select(
      "id, race_id, title, excerpt, body, facts, featured_aliases, published_at, races!inner(date, month_label)"
    )
    .eq("status", "published");
  if (error || !data) return [];
  const rows: PublishedDebrief[] = [];
  for (const d of data) {
    const race = raceEmbed(d.races);
    if (!race) continue;
    rows.push({
      id: d.id,
      raceId: d.race_id,
      date: race.date,
      monthLabel: race.month_label,
      title: d.title,
      excerpt: d.excerpt ?? "",
      body: d.body as DebriefArticle,
      facts: asDebriefFacts(d.facts),
      featured: d.featured_aliases ?? [],
      publishedAt: d.published_at ?? null,
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export async function loadPublishedDebriefByDate(
  date: string
): Promise<PublishedDebrief | null> {
  const all = await loadPublishedDebriefs();
  return all.find((d) => d.date === date) ?? null;
}
