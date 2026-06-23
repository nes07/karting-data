"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const LINKS = [
  ["/standings/pilotos", "Pilotos"],
  ["/standings/equipos", "Equipos"],
  ["/vuelta-rapida", "Vuelta Rápida"],
] as const;

export function ChampionshipToolbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const showCat =
    pathname === "/standings/pilotos" || pathname === "/standings/equipos";
  const cat = searchParams.get("cat") === "f2" ? "f2" : "f1";

  function setCat(next: "f1" | "f2") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "f2") params.set("cat", "f2");
    else params.delete("cat");
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <div className="championship-toolbar">
      <div className="container">
        <div
          className={`championship-toolbar-inner${showCat ? " has-cat" : ""}`}
        >
          <nav className="champ-nav" aria-label="Campeonato">
            {LINKS.map(([href, label]) => {
              const active =
                pathname === href ||
                (href !== "/vuelta-rapida" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`champ-nav-link${active ? " active" : ""}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          {showCat && (
            <div className="champ-cat" role="tablist" aria-label="Categoría">
              <button
                type="button"
                className={`champ-cat-btn${cat === "f1" ? " active" : ""}`}
                role="tab"
                aria-selected={cat === "f1"}
                onClick={() => setCat("f1")}
              >
                F1
              </button>
              <button
                type="button"
                className={`champ-cat-btn${cat === "f2" ? " active" : ""}`}
                role="tab"
                aria-selected={cat === "f2"}
                onClick={() => setCat("f2")}
              >
                F2
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
