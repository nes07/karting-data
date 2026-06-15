import Link from "next/link";

const CARDS = [
  {
    href: "/admin/race-day",
    title: "🏁 Fecha de Carrera",
    desc: "Flujo completo del día de carrera: importar tiempos de Karteando, posiciones, suplentes y DOTD. Reemplaza todos los scripts.",
  },
  {
    href: "/admin/races",
    title: "📋 Carreras",
    desc: "Edita o elimina fechas ya publicadas: posiciones, suplentes y DOTD.",
  },
  {
    href: "/admin/dotd",
    title: "🗳 Votación DOTD",
    desc: "Crea la votación con nominados y razones; la gente vota en /votar y aplicas el ganador.",
  },
  {
    href: "/admin/penalties",
    title: "⚑ Penalizaciones",
    desc: "Aplica o elimina penalizaciones post-carrera (Art. 23–24). Se descuentan al piloto y a su equipo.",
  },
  {
    href: "/admin/practice",
    title: "⏱ Tiempos de Práctica",
    desc: "Importa tiempos de fechas NO oficiales (solo alimentan Vuelta Rápida).",
  },
  {
    href: "/admin/drivers",
    title: "👤 Pilotos",
    desc: "Inscribir pilotos nuevos en cualquier momento de la temporada, editar o retirar.",
  },
  {
    href: "/admin/teams",
    title: "🏎 Equipos",
    desc: "Crear equipos nuevos, cambiar escuderías y asignar asientos.",
  },
  {
    href: "/admin/media",
    title: "📸 Media",
    desc: "Fotos y videos que se muestran en la página pública.",
  },
  {
    href: "/admin/admins",
    title: "🔐 Administradores",
    desc: "Da o quita acceso al panel agregando correos de Google.",
  },
];

export default function AdminHome() {
  return (
    <div className="admin-grid">
      {CARDS.map((c) => (
        <Link key={c.href} href={c.href} className="admin-card" style={{ display: "block" }}>
          <h2>{c.title}</h2>
          <p style={{ color: "var(--gray)", fontSize: "0.85rem" }}>{c.desc}</p>
        </Link>
      ))}
    </div>
  );
}
