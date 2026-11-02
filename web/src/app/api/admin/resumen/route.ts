import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { loadSiteData } from "@/lib/data";
import { factsForRace, officialRacesWithResults } from "@/lib/debrief/load";
import { buildNarration, buildResumenPayload } from "@/lib/resumen/payload";
import type { Category } from "@/lib/scoring/types";

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const raceId = url.searchParams.get("raceId");
  const cat = (url.searchParams.get("cat") ?? "F1") as Category;
  const site = await loadSiteData();
  const races = officialRacesWithResults(site.data);

  if (!raceId) {
    return NextResponse.json({
      races,
      tts: Boolean(process.env.OPENAI_API_KEY),
    });
  }
  if (cat !== "F1" && cat !== "F2") {
    return NextResponse.json({ error: "cat inválida" }, { status: 400 });
  }

  const facts = await factsForRace(raceId);
  if (!facts) {
    return NextResponse.json(
      { error: "No hay resultados para esa fecha" },
      { status: 404 }
    );
  }
  const payload = buildResumenPayload(facts, cat);
  return NextResponse.json({
    races,
    tts: Boolean(process.env.OPENAI_API_KEY),
    payload,
    narration: buildNarration(payload),
  });
}
