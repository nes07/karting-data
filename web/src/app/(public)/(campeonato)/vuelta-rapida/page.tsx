import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ShareButton } from "@/components/ShareButton";
import {
  PodiumVueltaRapida,
  VueltaRapidaTable,
} from "@/components/standings-widgets";
import { TRACK_RESET_DATE } from "@/lib/data";
import { getDriverPhotos, getSiteData } from "@/lib/get-site";
import { formatShortDate } from "@/components/format";

export const metadata: Metadata = {
  title: "Vuelta Rápida | GKD Championship 2026",
  description: "Ranking de vuelta rápida del Campeonato GKD 2026",
};

export default async function VueltaRapidaPage() {
  const site = await getSiteData();

  return (
    <PageShell
      withToolbar
      tag="Tiempos"
      title={
        <>
          Vuelta <span className="accent">Rápida</span>
        </>
      }
      subtitle={`Solo tiempos desde ${formatShortDate(TRACK_RESET_DATE)} (trazado #02).`}
    >
      <div className="share-bar">
        <ShareButton
          endpoint="/api/share/standings?type=vr"
          filename="gkd-vuelta-rapida"
          title="Vuelta Rápida — GKD Championship"
        />
      </div>
      <PodiumVueltaRapida
        rows={site.vueltaRapida}
        photos={getDriverPhotos(site)}
      />
      <VueltaRapidaTable
        rows={site.vueltaRapida}
        shareEndpoint="/api/share/standings?type=vr"
      />
    </PageShell>
  );
}
