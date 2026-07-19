import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { loadSiteData } from "@/lib/data";
import { teamLogoUrl } from "@/lib/constants";
import {
  buildDriversShare,
  buildTeamsShare,
  buildVrShare,
  SHARE_SIZES,
} from "@/lib/share/data";
import { loadShareFonts } from "@/lib/share/fonts";
import { StandingsImage } from "@/lib/share/layouts";
import {
  absolutizeRecord,
  parseCategory,
  parseFormat,
  PNG_CACHE_HEADERS,
} from "@/lib/share/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = url.searchParams;
  const type = sp.get("type") ?? "drivers";
  const cat = parseCategory(sp);
  const format = parseFormat(sp);
  const highlight = sp.get("highlight");

  const [site, fonts] = await Promise.all([loadSiteData(), loadShareFonts()]);

  const driverPhotos = Object.fromEntries(
    site.data.drivers.filter((d) => d.photoUrl).map((d) => [d.alias, d.photoUrl!])
  );

  let data;
  if (type === "teams") {
    const teamPhotos: Record<string, string> = {};
    const rows = cat === "F2" ? site.teamsF2 : site.teamsF1;
    for (const t of rows) {
      const supa = site.data.teams.find(
        (x) => x.escuderia === t.escuderia && x.category === cat
      )?.photoUrl;
      const photo = supa ?? teamLogoUrl(t.escuderia);
      if (photo) teamPhotos[t.escuderia] = photo;
    }
    data = buildTeamsShare(
      rows,
      cat,
      absolutizeRecord(teamPhotos, url.origin),
      format,
      highlight
    );
  } else if (type === "vr") {
    data = buildVrShare(
      site.vueltaRapida,
      absolutizeRecord(driverPhotos, url.origin),
      format,
      highlight
    );
  } else {
    data = buildDriversShare(
      cat === "F2" ? site.driversF2 : site.driversF1,
      cat,
      absolutizeRecord(driverPhotos, url.origin),
      format,
      highlight
    );
  }

  if (data.rows.length === 0) {
    return NextResponse.json({ error: "Sin datos para compartir" }, { status: 404 });
  }

  const { width, height } = SHARE_SIZES[format];
  return new ImageResponse(<StandingsImage data={data} format={format} />, {
    width,
    height,
    fonts,
    headers: PNG_CACHE_HEADERS,
  });
}
