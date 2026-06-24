import type { Metadata } from "next";
import { PilotsSection } from "@/components/Sections";
import { getSiteData } from "@/lib/get-site";

export const metadata: Metadata = {
  title: "Pilotos | GKD Championship 2026",
  description: "Pilotos confirmados del Campeonato GKD 2026",
};

export default async function PilotosPage() {
  const site = await getSiteData();

  return (
    <PilotsSection
      data={site.data}
      driversF1={site.driversF1}
      driversF2={site.driversF2}
    />
  );
}
