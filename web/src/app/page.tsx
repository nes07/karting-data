import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { StandingsTabs } from "@/components/StandingsTabs";
import { RaceResults } from "@/components/RaceResults";
import {
  DotdSection,
  MediaSection,
  PenaltiesSection,
  PilotsSection,
  TeamsSection,
  TrazadoSection,
} from "@/components/Sections";
import { loadSiteData } from "@/lib/data";

export const revalidate = 60; // refresh data at most every minute

function SetupNotice({ message }: { message: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <h1 className="section-title">
          GKD <span className="accent">Championship</span>
        </h1>
        <p className="section-subtitle" style={{ marginTop: 16 }}>
          Configura las variables de entorno de Supabase para ver los datos.
        </p>
        <code style={{ color: "var(--gray)" }}>{message}</code>
      </div>
    </main>
  );
}

export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <SetupNotice message="NEXT_PUBLIC_SUPABASE_URL no definida (.env.local)" />;
  }

  let site;
  try {
    site = await loadSiteData();
  } catch (e) {
    return <SetupNotice message={e instanceof Error ? e.message : String(e)} />;
  }

  const months = site.data.races
    .filter((r) => r.isOfficial)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => r.monthLabel);

  return (
    <>
      <Navbar />
      <Hero raceDates={site.raceDates} />

      <PilotsSection
        data={site.data}
        driversF1={site.driversF1}
        driversF2={site.driversF2}
      />
      <TeamsSection data={site.data} />

      <section id="standings" className="section">
        <div className="container">
          <div className="section-header">
            <span className="tag">En vivo</span>
            <h2 className="section-title">
              Championship <span className="accent">Standings</span>
            </h2>
            <p className="section-subtitle">
              Posiciones calculadas en tiempo real desde la base de datos oficial.
            </p>
          </div>
          <StandingsTabs
            driversF1={site.driversF1}
            driversF2={site.driversF2}
            teamsF1={site.teamsF1}
            teamsF2={site.teamsF2}
            vueltaRapida={site.vueltaRapida}
            months={months}
            photos={Object.fromEntries(
              site.data.drivers
                .filter((d) => d.photoUrl)
                .map((d) => [d.alias, d.photoUrl!])
            )}
            teamPhotos={Object.fromEntries(
              site.data.teams
                .filter((t) => t.photoUrl)
                .map((t) => [t.escuderia, t.photoUrl!])
            )}
          />
        </div>
      </section>

      <section id="results" className="section">
        <div className="container">
          <div className="section-header">
            <span className="tag">Por fecha</span>
            <h2 className="section-title">
              Race <span className="accent">Results</span>
            </h2>
            <p className="section-subtitle">
              Resultados por fecha — podio y clasificación completa.
            </p>
          </div>
          <RaceResults data={site.data} />
        </div>
      </section>

      <DotdSection entries={site.dotd} />
      <PenaltiesSection entries={site.penalties} />
      <TrazadoSection />
      <MediaSection media={site.media} />

      <footer className="footer">
        <div className="container">
          <p>GKD Championship 2026 — Todos los derechos reservados.</p>
        </div>
      </footer>
    </>
  );
}
