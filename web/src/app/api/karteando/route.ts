import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin";

const BASE = "https://www.karteando.cl/api";

interface KarteandoResult {
  driverName?: string;
  bestTime?: number | string;
  position?: number;
  finalPosition?: number;
  [key: string]: unknown;
}

/** Karteando reports times in milliseconds (e.g. 39071 = 39.071s). */
function toSeconds(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1000 ? n / 1000 : n;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^gkd[\s_-]*/i, "")
    .trim();
}

/**
 * GET /api/karteando?date=YYYY-MM-DD      → list of sessions for the date
 * GET /api/karteando?sessionId=...        → results with alias resolution
 */
export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const sessionId = searchParams.get("sessionId");

  try {
    if (date) {
      const r = await fetch(`${BASE}/races-v0?date=${encodeURIComponent(date)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`Karteando ${r.status}`);
      const data = await r.json();
      return NextResponse.json({ races: data.races ?? data });
    }

    if (sessionId) {
      const r = await fetch(
        `${BASE}/race-results-v0?sessionId=${encodeURIComponent(sessionId)}`,
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
      );
      if (!r.ok) throw new Error(`Karteando ${r.status}`);
      const data = await r.json();
      const results: KarteandoResult[] =
        data.race?.drivers ?? data.results ?? data;

      // Alias resolution: exact mapping table → case-insensitive alias →
      // normalized fuzzy match → unmatched (admin decides in the UI).
      const supabase = await createClient();
      const [{ data: drivers }, { data: mappings }] = await Promise.all([
        supabase.from("drivers").select("id, alias"),
        supabase.from("name_mappings").select("web_name, driver_id"),
      ]);
      const byMapping = new Map(
        (mappings ?? []).map((m) => [m.web_name.toLowerCase(), m.driver_id])
      );
      const byAlias = new Map(
        (drivers ?? []).map((d) => [d.alias.toLowerCase(), d.id])
      );
      const byNormalized = new Map(
        (drivers ?? []).map((d) => [normalize(d.alias), d.id])
      );

      const resolved = (Array.isArray(results) ? results : [])
        .filter((res) => String(res.driverName ?? "").trim() !== "")
        .map((res) => {
        const webName = String(res.driverName ?? "").trim();
        const lower = webName.toLowerCase();
        const driverId =
          byMapping.get(lower) ??
          byAlias.get(lower) ??
          byNormalized.get(normalize(webName)) ??
          null;
        return {
          webName,
          bestTime: toSeconds(res.bestTime),
          position: res.finalPosition ?? res.position ?? null,
          driverId,
        };
      });

      return NextResponse.json({ results: resolved });
    }

    return NextResponse.json(
      { error: "Falta el parámetro date o sessionId" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
