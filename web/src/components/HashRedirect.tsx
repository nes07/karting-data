"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const HASH_ROUTES: Record<string, string> = {
  standings: "/standings/pilotos",
  results: "/resultados",
  pilotos: "/pilotos",
  equipos: "/equipos",
  dotd: "/dotd",
  penalizaciones: "/penalizaciones",
  trazado: "/trazado",
  media: "/media",
  hero: "/",
};

/** Redirect legacy `/#section` bookmarks to dedicated routes. */
export function HashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const target = HASH_ROUTES[hash];
    if (target) router.replace(target);
  }, [router]);

  return null;
}
