"use client";

import { useState } from "react";

const LINKS = [
  ["#pilotos", "Pilotos"],
  ["#equipos", "Equipos"],
  ["#standings", "Standings"],
  ["#results", "Resultados"],
  ["#media", "Media"],
  ["#dotd", "Driver of the Day"],
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
        </ul>
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
