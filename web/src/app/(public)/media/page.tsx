import type { Metadata } from "next";
import { MediaSection } from "@/components/Sections";
import { getSiteData } from "@/lib/get-site";

export const metadata: Metadata = {
  title: "Media | GKD Championship 2026",
  description: "Fotos y videos del Campeonato GKD 2026",
};

export default async function MediaPage() {
  const site = await getSiteData();
  return <MediaSection media={site.media} />;
}
