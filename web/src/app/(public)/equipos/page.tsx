import type { Metadata } from "next";
import { TeamsSection } from "@/components/Sections";
import { getSiteData } from "@/lib/get-site";

export const metadata: Metadata = {
  title: "Equipos | GKD Championship 2026",
  description: "Escuderías y equipos del Campeonato GKD 2026",
};

export default async function EquiposPage() {
  const site = await getSiteData();

  return <TeamsSection data={site.data} />;
}
