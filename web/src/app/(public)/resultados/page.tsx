import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { RaceResults } from "@/components/RaceResults";
import { getDriverPhotos, getSiteData } from "@/lib/get-site";

export const metadata: Metadata = {
  title: "Resultados | GKD Championship 2026",
  description: "Resultados por fecha — podio y clasificación completa",
};

export default async function ResultadosPage() {
  const site = await getSiteData();

  return (
    <PageShell
      tag="Por fecha"
      title={
        <>
          Race <span className="accent">Results</span>
        </>
      }
      subtitle="Resultados por fecha — podio y clasificación completa."
    >
      <RaceResults data={site.data} photos={getDriverPhotos(site)} />
    </PageShell>
  );
}
