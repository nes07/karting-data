import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { DebriefCard } from "@/components/DebriefView";
import { loadPublishedDebriefs } from "@/lib/debrief/load";

export const metadata: Metadata = {
  title: "Debrief | GKD Championship 2026",
  description: "Crónica de cada fecha oficial — quali, carrera, campeonato y VR",
};

export const dynamic = "force-dynamic";

export default async function DebriefIndexPage() {
  const items = await loadPublishedDebriefs();
  return (
    <PageShell
      tag="Post-carrera"
      title={
        <>
          Race <span className="accent">Debrief</span>
        </>
      }
      subtitle="La crónica de cada fecha oficial: grilla vs bandera, batallas de campeonato y Vuelta Rápida."
    >
      {items.length === 0 ? (
        <p className="debrief-empty">Todavía no hay debriefs publicados.</p>
      ) : (
        <div className="debrief-list">
          {items.map((item) => (
            <DebriefCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
