import type { Metadata } from "next";
import { PenaltiesSection } from "@/components/Sections";
import { getSiteData } from "@/lib/get-site";

export const metadata: Metadata = {
  title: "Penalizaciones | GKD Championship 2026",
  description: "Sanciones oficiales del Campeonato GKD 2026",
};

export default async function PenalizacionesPage() {
  const site = await getSiteData();
  return <PenaltiesSection entries={site.penalties} />;
}
