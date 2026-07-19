import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { loadSiteData } from "@/lib/data";
import { buildRoundShare, SHARE_SIZES } from "@/lib/share/data";
import { loadShareFonts } from "@/lib/share/fonts";
import { RoundImage } from "@/lib/share/layouts";
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
  const date = sp.get("date");
  const cat = parseCategory(sp);
  const format = parseFormat(sp);
  const page = Math.max(1, Number(sp.get("page")) || 1);

  if (!date) {
    return NextResponse.json({ error: "Falta date" }, { status: 400 });
  }

  const [site, fonts] = await Promise.all([loadSiteData(), loadShareFonts()]);

  const driverPhotos = Object.fromEntries(
    site.data.drivers.filter((d) => d.photoUrl).map((d) => [d.alias, d.photoUrl!])
  );

  const round = buildRoundShare(
    site.data,
    date,
    cat,
    absolutizeRecord(driverPhotos, url.origin),
    format,
    page
  );

  if (!round) {
    return NextResponse.json(
      { error: "Sin resultados para esa fecha/categoría" },
      { status: 404 }
    );
  }

  const { width, height } = SHARE_SIZES[format];
  return new ImageResponse(<RoundImage round={round} format={format} />, {
    width,
    height,
    fonts,
    headers: {
      ...PNG_CACHE_HEADERS,
      "x-share-pages": String(round.pageCount),
    },
  });
}
