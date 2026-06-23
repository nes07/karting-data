import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin";
import { normalizeStartTime } from "@/lib/race-datetime";
import { revalidatePublicSite } from "@/lib/revalidate-public";
import {
  isStartTimeSchemaError,
  raceRowWithOptionalStartTime,
  stripStartTime,
} from "@/lib/races-schema";

interface RaceBody {
  id?: string;
  date: string;
  monthLabel: string;
  startTime?: string;
  isOfficial?: boolean;
}

async function hasStartTimeColumn(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { error } = await supabase.from("races").select("start_time").limit(1);
  return !error || !isStartTimeSchemaError(error.message);
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const supabase = await createClient();
  const hasStartTime = await hasStartTimeColumn(supabase);
  return NextResponse.json({ hasStartTime });
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body: RaceBody = await request.json();
  if (!body.date || !body.monthLabel?.trim()) {
    return NextResponse.json({ error: "Faltan date o monthLabel" }, { status: 400 });
  }

  const supabase = await createClient();
  const includeStartTime = await hasStartTimeColumn(supabase);
  const row = raceRowWithOptionalStartTime(
    body.date,
    body.monthLabel.trim(),
    body.isOfficial ?? true,
    normalizeStartTime(body.startTime ?? "12:00:00"),
    includeStartTime
  );

  if (body.id) {
    const { data: existing, error: fetchErr } = await supabase
      .from("races")
      .select("date")
      .eq("id", body.id)
      .single();
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (existing.date !== body.date) {
      const { error: lapErr } = await supabase
        .from("lap_times")
        .update({ session_date: body.date })
        .eq("session_date", existing.date);
      if (lapErr) {
        return NextResponse.json({ error: lapErr.message }, { status: 500 });
      }
    }
  }

  let needsMigration = !includeStartTime;

  let result = body.id
    ? await supabase.from("races").update(row).eq("id", body.id).select("id").single()
    : await supabase.from("races").upsert(row, { onConflict: "date" }).select("id").single();

  if (result.error && includeStartTime && isStartTimeSchemaError(result.error.message)) {
    needsMigration = true;
    const fallback = stripStartTime(row);
    result = body.id
      ? await supabase.from("races").update(fallback).eq("id", body.id).select("id").single()
      : await supabase
          .from("races")
          .upsert(fallback, { onConflict: "date" })
          .select("id")
          .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  revalidatePublicSite();
  return NextResponse.json({
    ok: true,
    id: result.data.id,
    needsMigration,
  });
}

export async function PATCH(request: Request) {
  return POST(request);
}
