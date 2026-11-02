import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { loadSiteData } from "@/lib/data";
import { loadPublishedDebriefByDate } from "@/lib/debrief/load";
import { buildDebriefShare } from "@/lib/share/debrief";
import { SHARE_SIZES } from "@/lib/share/data";
import { loadShareFonts } from "@/lib/share/fonts";
import { DebriefImage } from "@/lib/share/layouts";
import { absolutizeRecord, parseFormat, PNG_CACHE_HEADERS } from "@/lib/share/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const format = parseFormat(url.searchParams);
  if (!date) {
    return NextResponse.json({ error: "Falta date" }, { status: 400 });
  }

  const [item, site, fonts] = await Promise.all([
    loadPublishedDebriefByDate(date),
    loadSiteData(),
    loadShareFonts(),
  ]);
  if (!item) {
    return NextResponse.json({ error: "Debrief no publicado" }, { status: 404 });
  }

  const photos = absolutizeRecord(
    Object.fromEntries(
      site.data.drivers.filter((d) => d.photoUrl).map((d) => [d.alias, d.photoUrl!])
    ),
    url.origin
  );
  const aliases = [
    ...item.featured,
    ...item.body.sections.flatMap((s) => s.mentions),
  ];
  const share = buildDebriefShare({
    title: item.title,
    excerpt: item.excerpt,
    monthLabel: item.monthLabel,
    date: item.date,
    aliases,
    photos,
  });

  const { width, height } = SHARE_SIZES[format];
  return new ImageResponse(<DebriefImage data={share} format={format} />, {
    width,
    height,
    fonts,
    headers: PNG_CACHE_HEADERS,
  });
}
