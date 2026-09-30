import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { loadSiteData } from "@/lib/data";
import { buildDriverProfile, SHARE_SIZES } from "@/lib/share/data";
import { loadShareFonts } from "@/lib/share/fonts";
import { DriverProfileImage } from "@/lib/share/layouts";
import { absolutizeRecord, parseFormat, PNG_CACHE_HEADERS } from "@/lib/share/request";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = url.searchParams;
  const alias = sp.get("alias");
  const format = parseFormat(sp);

  if (!alias) {
    return NextResponse.json({ error: "Falta alias" }, { status: 400 });
  }

  const [site, fonts] = await Promise.all([loadSiteData(), loadShareFonts()]);

  const driverPhotos = Object.fromEntries(
    site.data.drivers.filter((d) => d.photoUrl).map((d) => [d.alias, d.photoUrl!])
  );

  const profile = buildDriverProfile(
    site.driversF1,
    site.driversF2,
    site.vueltaRapida,
    absolutizeRecord(driverPhotos, url.origin),
    alias
  );

  if (!profile) {
    return NextResponse.json({ error: "Piloto no encontrado" }, { status: 404 });
  }

  const { width, height } = SHARE_SIZES[format];
  return new ImageResponse(<DriverProfileImage profile={profile} format={format} />, {
    width,
    height,
    fonts,
    headers: PNG_CACHE_HEADERS,
  });
}
