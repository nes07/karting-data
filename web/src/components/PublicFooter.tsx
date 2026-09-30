import Link from "next/link";

const NAV_COLUMNS = [
  {
    title: "Navegación",
    links: [
      { href: "/", label: "Home" },
      { href: "/pilotos", label: "Pilotos" },
      { href: "/equipos", label: "Escuderías" },
      { href: "/standings/pilotos", label: "Standings" },
    ],
  },
  {
    title: "Competición",
    links: [
      { href: "/vuelta-rapida", label: "Vuelta Rápida" },
      { href: "/resultados", label: "Resultados" },
      { href: "/dotd", label: "DOTD" },
      { href: "/penalizaciones", label: "Penalizaciones" },
    ],
  },
  {
    title: "Comunidad",
    links: [
      { href: "/media", label: "Media" },
      { href: "/trazado", label: "Trazado" },
      { href: "/votar", label: "Votar" },
    ],
  },
] as const;

export function PublicFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="footer-logo">GKD</span>
            <span className="footer-era">New Era | 2026</span>
            <a
              className="footer-social"
              href="https://www.instagram.com/gkd.racing"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
          </div>
          {NAV_COLUMNS.map((col) => (
            <div key={col.title} className="footer-col">
              <span className="footer-col-title">{col.title}</span>
              {col.links.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <p className="footer-copy">
          © 2026 GKD Championship — Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
