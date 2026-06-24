import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/admin";
import { dedupeLapTimes } from "@/lib/lap-times";
import { revalidatePublicSite } from "@/lib/revalidate-public";

interface Body {
  sessionDate: string;
  lapTimes: Array<{ driverId: string; bestTime: number }>;
  mappings?: Array<{ webName: string; driverId: string }>;
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body: Body = await request.json();
  if (!body.sessionDate || !body.lapTimes?.length) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const supabase = await createClient();
  const lapRows = dedupeLapTimes(body.lapTimes).map((t) => ({
    driver_id: t.driverId,
    session_date: body.sessionDate,
    best_time: t.bestTime,
  }));

  const { error } = await supabase.from("lap_times").upsert(lapRows, {
    onConflict: "driver_id,session_date",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.mappings?.length) {
    const { error: mapErr } = await supabase.from("name_mappings").upsert(
      body.mappings.map((m) => ({ web_name: m.webName, driver_id: m.driverId })),
      { onConflict: "web_name" }
    );
    if (mapErr) {
      return NextResponse.json({ error: mapErr.message }, { status: 500 });
    }
  }

  revalidatePublicSite();
  return NextResponse.json({ ok: true, count: lapRows.length });
}
