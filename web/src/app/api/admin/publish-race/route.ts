import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin";

interface PublishBody {
  date: string; // ISO
  monthLabel: string;
  isOfficial: boolean;
  results: Array<{
    driverId: string;
    category: "F1" | "F2";
    position: number;
    bestTime: number | null;
    isReserve: boolean;
    replacedTeamId: string | null;
  }>;
  dotd: Array<{
    driverId: string;
    category: "F1" | "F2";
    reason: string | null;
  }>;
  lapTimes: Array<{ driverId: string; bestTime: number }>;
  newMappings: Array<{ webName: string; driverId: string }>;
}

/**
 * Publishes a race day in one call: race row, results, DOTD, lap times and
 * any newly confirmed Karteando name mappings. Writes run with the admin's
 * own session, so RLS (admin allowlist) is enforced by the database.
 */
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body: PublishBody = await request.json();
  if (!body.date || !body.monthLabel) {
    return NextResponse.json({ error: "Faltan date/monthLabel" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Race row (idempotent on date)
  const { data: race, error: raceErr } = await supabase
    .from("races")
    .upsert(
      {
        date: body.date,
        month_label: body.monthLabel,
        is_official: body.isOfficial,
      },
      { onConflict: "date" }
    )
    .select("id")
    .single();
  if (raceErr) {
    return NextResponse.json({ error: raceErr.message }, { status: 500 });
  }

  // 2. Results
  if (body.results.length > 0) {
    const { error } = await supabase.from("race_results").upsert(
      body.results.map((r) => ({
        race_id: race.id,
        driver_id: r.driverId,
        category: r.category,
        position: r.position,
        best_time: r.bestTime,
        is_reserve: r.isReserve,
        replaced_team_id: r.replacedTeamId,
      })),
      { onConflict: "race_id,driver_id,category" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 3. DOTD (one per category)
  if (body.dotd.length > 0) {
    const { error } = await supabase.from("dotd").upsert(
      body.dotd.map((d) => ({
        race_id: race.id,
        driver_id: d.driverId,
        category: d.category,
        reason: d.reason,
      })),
      { onConflict: "race_id,category" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 4. Lap times (best per driver for the session date)
  if (body.lapTimes.length > 0) {
    const { error } = await supabase.from("lap_times").upsert(
      body.lapTimes.map((l) => ({
        driver_id: l.driverId,
        session_date: body.date,
        best_time: l.bestTime,
      })),
      { onConflict: "driver_id,session_date" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 5. Confirmed name mappings for future imports
  if (body.newMappings.length > 0) {
    const { error } = await supabase.from("name_mappings").upsert(
      body.newMappings.map((m) => ({
        web_name: m.webName,
        driver_id: m.driverId,
      })),
      { onConflict: "web_name" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, raceId: race.id });
}
