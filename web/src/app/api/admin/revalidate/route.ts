import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { revalidatePublicSite } from "@/lib/revalidate-public";

export async function POST() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  revalidatePublicSite();
  return NextResponse.json({ ok: true });
}
