import Link from "next/link";
import { Hero } from "@/components/Hero";
import {
  buildLastRace,
  buildVrInfo,
  driversToRankingRows,
  PilotsPromo,
  RankingCard,
  teamsToRankingRows,
  VrHomeTable,
} from "@/components/home-widgets";
import { SiteData } from "@/lib/data";
import { getDriverPhotos, getTeamPhotos } from "@/lib/get-site";

const CARDS = [
  {
    href: "/resultados",
    icon: "📋",
    title: "Resultados",
    subtitle: "Clasificaciones por fecha",
  },
  {
    href: "/pilotos",
    icon: "👤",
    title: "Pilotos",
    subtitle: "Galería de confirmados",
  },
  {
    href: "/equipos",
    icon: "🔧",
    title: "Equipos",
    subtitle: "Escuderías y alineaciones",
  },
  {
    href: "/dotd",
    icon: "⭐",
    title: "DOTD",
    subtitle: "Driver of the Day",
  },
  {
    href: "/penalizaciones",
    icon: "⚠",
    title: "Penalizaciones",
    subtitle: "Sanciones oficiales",
  },
  {
    href: "/trazado",
    icon: "🗺",
    title: "Trazado",
    subtitle: "Layout #02-2026",
  },
  {
    href: "/media",
    icon: "📸",
    title: "Media",
    subtitle: "Fotos y videos",
  },
] as const;

interface Props {
  site: SiteData;
}

export function HomeDashboard({ site }: Props) {
  const photos = getDriverPhotos(site);
  const teamPhotos = getTeamPhotos(site);
  const vrInfo = buildVrInfo(site);
  const lastRaces = [buildLastRace(site, "F1", photos), buildLastRace(site, "F2", photos)]
    .filter((r) => r != null)
    .slice(0, 2);

  return (
    <>
      <Hero raceDates={site.raceDates} compact />
      <section className="section page-shell home-sections">
        <div className="container">
          <div className="dashboard-grid dashboard-grid-top">
            {CARDS.map((c) => (
              <Link key={c.href} href={c.href} className="dashboard-card">
                <span className="dashboard-card-icon">{c.icon}</span>
                <span className="dashboard-card-title">{c.title}</span>
                <span className="dashboard-card-sub">{c.subtitle}</span>
              </Link>
            ))}
          </div>

          <div id="rankings" className="ranking-grid">
            <RankingCard
              label="Pilotos F1"
              href="/standings/pilotos"
              rows={driversToRankingRows(site.driversF1, photos)}
            />
            <RankingCard
              label="Escuderías F1"
              href="/standings/equipos"
              rows={teamsToRankingRows(site.teamsF1, teamPhotos)}
            />
            <RankingCard
              label="Pilotos F2"
              href="/standings/pilotos?cat=f2"
              rows={driversToRankingRows(site.driversF2, photos)}
            />
            <RankingCard
              label="Escuderías F2"
              href="/standings/equipos?cat=f2"
              rows={teamsToRankingRows(site.teamsF2, teamPhotos)}
            />
          </div>

          {lastRaces.length > 0 && (
            <div className="ranking-grid results-grid">
              {lastRaces.map((r) => (
                <RankingCard
                  key={r.label}
                  tag="Resultados"
                  big={r.big}
                  label={r.label}
                  meta={r.meta}
                  href="/resultados"
                  ctaLabel="Ver resultados"
                  rows={r.rows}
                />
              ))}
            </div>
          )}

          <PilotsPromo drivers={site.driversF1} photos={photos} />

          <div className="home-vr-section">
            <div className="home-vr-head">
              <h2 className="home-vr-title">
                Ranking de <span className="accent">Vuelta Rápida</span>
              </h2>
              <Link href="/vuelta-rapida" className="ranking-card-cta home-vr-cta">
                Ver todas las vueltas <span aria-hidden>→</span>
              </Link>
            </div>
            <VrHomeTable rows={site.vueltaRapida} photos={photos} info={vrInfo} />
          </div>
        </div>
      </section>
    </>
  );
}
