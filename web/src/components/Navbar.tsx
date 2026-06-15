"use client";

import { useState } from "react";

const LINKS = [
  ["#pilotos", "Pilotos"],
  ["#equipos", "Equipos"],
  ["#standings", "Standings"],
  ["#results", "Resultados"],
  ["#dotd", "Driver of the Day"],
  ["#penalizaciones", "Penalizaciones"],
  ["#trazado", "Trazado"],
  ["#media", "Media"],
  ["/votar", "🗳 Votar"],
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="container">
        <a href="#hero" className="navbar-logo">
          <div className="navbar-logo-text">
            GKD
            <br />
            <span>Championship</span>
          </div>
        </a>
        <ul className={`navbar-links${open ? " open" : ""}`} id="navbar-links">
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <a href={href} onClick={() => setOpen(false)}>
                {label}
              </a>
            </li>
          ))}
          <li className="navbar-admin-mobile">
            <a href="/admin" onClick={() => setOpen(false)}>
              🔐 Admin
            </a>
          </li>
        </ul>
        <a href="/admin" className="navbar-admin" title="Panel de administración">
          🔐 Admin
        </a>
        <button
          className="navbar-burger"
          aria-label="Menú"
          onClick={() => setOpen((v) => !v)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  );
}
