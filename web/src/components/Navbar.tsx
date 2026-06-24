"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const MAIN_LINKS = [
  ["/", "Inicio"],
  ["/standings/pilotos", "Campeonato"],
  ["/vuelta-rapida", "Vuelta Rápida"],
  ["/resultados", "Resultados"],
] as const;

const MORE_LINKS = [
  ["/pilotos", "Pilotos"],
  ["/equipos", "Equipos"],
  ["/dotd", "DOTD"],
  ["/penalizaciones", "Penalizaciones"],
  ["/trazado", "Trazado"],
  ["/media", "Media"],
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/standings/pilotos") {
    return (
      pathname.startsWith("/standings") || pathname === "/vuelta-rapida"
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (moreRef.current?.contains(e.target as Node)) return;
      setMoreOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [moreOpen]);

  function closeMenu() {
    setOpen(false);
    setMoreOpen(false);
  }

  return (
    <nav className="navbar">
      <div className="container">
        <Link href="/" className="navbar-logo" onClick={closeMenu}>
          <div className="navbar-logo-text">
            GKD
            <br />
            <span>Championship</span>
          </div>
        </Link>
        <ul className={`navbar-links${open ? " open" : ""}`} id="navbar-links">
          {MAIN_LINKS.map(([href, label]) => (
            <li key={href}>
              <Link
                href={href}
                className={isActive(pathname, href) ? "active" : undefined}
                onClick={closeMenu}
              >
                {label}
              </Link>
            </li>
          ))}
          <li
            ref={moreRef}
            className={`navbar-more navbar-more-desktop${moreOpen ? " open" : ""}`}
          >
            <button
              type="button"
              className={`navbar-more-btn${MORE_LINKS.some(([h]) => isActive(pathname, h)) ? " active" : ""}`}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              onClick={() => setMoreOpen((v) => !v)}
            >
              Más {moreOpen ? "▴" : "▾"}
            </button>
            {moreOpen && (
              <ul className="navbar-more-menu">
                {MORE_LINKS.map(([href, label]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={isActive(pathname, href) ? "active" : undefined}
                      onClick={closeMenu}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
          {MORE_LINKS.map(([href, label]) => (
            <li key={`m-${href}`} className="navbar-more-mobile">
              <Link
                href={href}
                className={isActive(pathname, href) ? "active" : undefined}
                onClick={closeMenu}
              >
                {label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/votar"
              className={pathname === "/votar" ? "active" : undefined}
              onClick={closeMenu}
            >
              🗳 Votar
            </Link>
          </li>
          <li className="navbar-admin-mobile">
            <Link href="/admin" onClick={closeMenu}>
              🔐 Admin
            </Link>
          </li>
        </ul>
        <Link href="/admin" className="navbar-admin" title="Panel de administración">
          🔐 Admin
        </Link>
        <button
          type="button"
          className="navbar-burger"
          aria-label="Menú"
          aria-expanded={open}
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
