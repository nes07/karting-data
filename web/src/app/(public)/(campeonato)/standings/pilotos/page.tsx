import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { DriversTable, PodiumDriver } from "@/components/standings-widgets";
import {
  getDriverPhotos,
  getSiteData,
  getStandingsMonths,
} from "@/lib/get-site";

export const metadata: Metadata = {
  title: "Standings Pilotos | GKD Championship 2026",
  description: "Campeonato de pilotos F1 y F2 — posiciones en vivo",
};

interface Props {
  searchParams: Promise<{ cat?: string }>;
}

export default async function PilotosStandingsPage({ searchParams }: Props) {
  const { cat } = await searchParams;
  const isF2 = cat === "f2";
  const site = await getSiteData();
  const rows = isF2 ? site.driversF2 : site.driversF1;

  return (
    <PageShell
      withToolbar
      tag="En vivo"
      title={
        <>
          Championship <span className="accent">Standings</span> — Pilotos
        </>
      }
      subtitle="Posiciones calculadas en tiempo real desde la base de datos oficial."
    >
      <PodiumDriver rows={rows} photos={getDriverPhotos(site)} />
      <DriversTable rows={rows} months={getStandingsMonths(site)} />
    </PageShell>
  );
}
