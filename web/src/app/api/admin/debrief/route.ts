import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { factsForRace, officialRacesWithResults } from "@/lib/debrief/load";
import { writeDebriefArticle } from "@/lib/debrief/write";
import type { DebriefArticle } from "@/lib/debrief/types";
import { loadSiteData } from "@/lib/data";
import { revalidatePath } from "next/cache";

function revalidateDebrief(date?: string) {
  revalidatePath("/debrief");
  if (date) revalidatePath(`/debrief/${date}`);
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const site = await loadSiteData();
  return NextResponse.json({
    races: officialRacesWithResults(site.data),
    llm: Boolean(process.env.OPENAI_API_KEY),
  });
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = (await request.json()) as { raceId?: string };
  if (!body.raceId) {
    return NextResponse.json({ error: "Falta raceId" }, { status: 400 });
  }

  const facts = await factsForRace(body.raceId);
  if (!facts) {
    return NextResponse.json(
      { error: "No hay resultados para esa fecha" },
      { status: 404 }
    );
  }

  const { article, source } = await writeDebriefArticle(facts);
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("debriefs")
    .select("status, published_at")
    .eq("race_id", body.raceId)
    .maybeSingle();
  const stayPublished = existing?.status === "published";
  const { data, error } = await supabase
    .from("debriefs")
    .upsert(
      {
        race_id: body.raceId,
        status: stayPublished ? "published" : "draft",
        title: article.title,
        excerpt: article.excerpt,
        body: article,
        facts,
        featured_aliases: article.featured,
        generated_by: source,
        published_at: stayPublished ? existing?.published_at ?? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "race_id" }
    )
    .select("id, race_id, status, title, excerpt, body, featured_aliases, generated_by, updated_at")
    .single();

  if (error) {
    const missing = /does not exist|schema cache|relation .* debriefs/i.test(error.message);
    return NextResponse.json(
      {
        error: missing
          ? "Falta correr la migración 0010_debriefs.sql en el SQL Editor de Supabase."
          : error.message,
      },
      { status: missing ? 412 : 500 }
    );
  }

  revalidateDebrief(facts.date);
  return NextResponse.json({
    ok: true,
    id: data.id,
    raceId: data.race_id,
    status: data.status,
    article: data.body as DebriefArticle,
    source: data.generated_by,
    facts,
  });
}

export async function PATCH(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = (await request.json()) as {
    id?: string;
    status?: "draft" | "published";
    article?: DebriefArticle;
  };
  if (!body.id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.status) {
    patch.status = body.status;
    patch.published_at =
      body.status === "published" ? new Date().toISOString() : null;
  }
  if (body.article) {
    patch.title = body.article.title;
    patch.excerpt = body.article.excerpt;
    patch.body = body.article;
    patch.featured_aliases = body.article.featured;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debriefs")
    .update(patch)
    .eq("id", body.id)
    .select("id, status, race_id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const site = await loadSiteData();
  const date = site.data.races.find((r) => r.id === data.race_id)?.date;
  revalidateDebrief(date);
  return NextResponse.json({ ok: true, status: data.status });
}
