import type { Category } from "@/lib/scoring/types";
import type { ShareFormat } from "./data";

export function parseFormat(sp: URLSearchParams): ShareFormat {
  return sp.get("format") === "post" ? "post" : "story";
}

export function parseCategory(sp: URLSearchParams): Category {
  return sp.get("cat")?.toUpperCase() === "F2" ? "F2" : "F1";
}

/** Prefix root-relative photo URLs (e.g. /logos/x.png) with the request origin. */
export function absolutize(url: string | null, origin: string): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${origin}${url}` : url;
}

export function absolutizeRecord(
  record: Record<string, string>,
  origin: string
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k, absolutize(v, origin)!])
  );
}

export const PNG_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};
