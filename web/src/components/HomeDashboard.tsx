import Link from "next/link";
import { Hero } from "@/components/Hero";
import { PodiumCarousel } from "@/components/PodiumCarousel";
import { SiteData } from "@/lib/data";
import { getDriverPhotos } from "@/lib/get-site";

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

  return (
    <>
      <Hero raceDates={site.raceDates} compact />
      <section className="section page-shell">
        <div className="container">
          <PodiumCarousel
            driversF1={site.driversF1}
            driversF2={site.driversF2}
            vueltaRapida={site.vueltaRapida}
            photos={photos}
          />
          <div className="dashboard-grid">
            {CARDS.map((c) => (
              <Link key={c.href} href={c.href} className="dashboard-card">
                <span className="dashboard-card-icon">{c.icon}</span>
                <span className="dashboard-card-title">{c.title}</span>
                <span className="dashboard-card-sub">{c.subtitle}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
