import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { PodiumTeam, TeamsTable } from "@/components/standings-widgets";
import {
  getSiteData,
  getStandingsMonths,
  getTeamPhotos,
} from "@/lib/get-site";

export const metadata: Metadata = {
  title: "Standings Equipos | GKD Championship 2026",
  description: "Campeonato de constructores F1 y F2 — posiciones en vivo",
};

interface Props {
  searchParams: Promise<{ cat?: string }>;
}

export default async function EquiposStandingsPage({ searchParams }: Props) {
  const { cat } = await searchParams;
  const isF2 = cat === "f2";
  const site = await getSiteData();
  const rows = isF2 ? site.teamsF2 : site.teamsF1;

  return (
    <PageShell
      withToolbar
      tag="En vivo"
      title={
        <>
          Championship <span className="accent">Standings</span> — Equipos
        </>
      }
      subtitle="Campeonato de constructores — puntos por fecha."
    >
      <PodiumTeam rows={rows} teamPhotos={getTeamPhotos(site)} />
      <TeamsTable rows={rows} months={getStandingsMonths(site)} />
    </PageShell>
  );
}
