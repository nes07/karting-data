import Link from "next/link";
import { getAdminUser } from "@/lib/admin";
import { LoginCard } from "./LoginCard";
import "./admin.css";

const NAV = [
  ["/admin", "Inicio"],
  ["/admin/race-day", "Fecha de Carrera"],
  ["/admin/races", "Carreras"],
  ["/admin/dotd", "Votación DOTD"],
  ["/admin/practice", "Tiempos de Práctica"],
  ["/admin/drivers", "Pilotos"],
  ["/admin/teams", "Equipos"],
  ["/admin/media", "Media"],
  ["/admin/admins", "Admins"],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();

  return (
    <div className="admin-shell">
      <nav className="navbar">
        <div className="container">
          <Link href="/" className="navbar-logo">
            <div className="navbar-logo-text">
              GKD
              <br />
              <span>Admin</span>
            </div>
          </Link>
          {admin && (
            <span style={{ fontSize: "0.75rem", color: "var(--gray)" }}>
              {admin.email}
            </span>
          )}
        </div>
      </nav>

      {!admin ? (
        <LoginCard />
      ) : (
        <>
          <div className="admin-nav">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </div>
          {children}
        </>
      )}
    </div>
  );
}
