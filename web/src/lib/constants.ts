// Constructor colors — single source of truth for the web app.
// Ported from APPS_SCRIPT.js / assets/js/app.js.
export const CONSTRUCTOR_COLORS: Record<string, { bg: string; fg: string }> = {
  // Modern F1 2026
  McLaren: { bg: "#EF8733", fg: "#000000" },
  "Red Bull": { bg: "#4570C0", fg: "#FFFFFF" },
  Mercedes: { bg: "#75F1D3", fg: "#000000" },
  Ferrari: { bg: "#D52E37", fg: "#FFFFFF" },
  Williams: { bg: "#3267D4", fg: "#FFFFFF" },
  "Aston Martin": { bg: "#4B9774", fg: "#FFFFFF" },
  Alpine: { bg: "#479FE2", fg: "#FFFFFF" },
  Haas: { bg: "#DFE1E2", fg: "#000000" },
  "Racing Bulls": { bg: "#7091F8", fg: "#FFFFFF" },
  Audi: { bg: "#EB4526", fg: "#FFFFFF" },
  Cadillac: { bg: "#AAAADD", fg: "#000000" },
  // Classic / F2 teams
  Lotus: { bg: "#0B3D2E", fg: "#FFD700" },
  Sauber: { bg: "#003A8F", fg: "#FFFFFF" },
  BMW: { bg: "#0066B1", fg: "#FFFFFF" },
  Renault: { bg: "#FFD700", fg: "#000000" },
  Arrows: { bg: "#FF7A00", fg: "#000000" },
  Benetton: { bg: "#00A94F", fg: "#FFFFFF" },
  "Ferrari Classic": { bg: "#8B0000", fg: "#FFD700" },
  Jaguar: { bg: "#004225", fg: "#FFFFFF" },
  Minardi: { bg: "#1C1C1C", fg: "#FFD700" },
  "Brawn GP": { bg: "#E6FF00", fg: "#000000" },
  Brabham: { bg: "#001A57", fg: "#FFFFFF" },
  // Reserve / replacement drivers
  RD: { bg: "#E2E8F0", fg: "#475569" },
};

export const CATEGORY_LABELS = {
  F1: "New Era — F1 Moderna",
  F2: "Era Antigua — F1 Clásica",
} as const;

// Local constructor logo files in /public/logos (not all escuderías have one).
const LOGO_SLUGS: Record<string, string> = {
  McLaren: "mclaren",
  "Red Bull": "red-bull",
  Mercedes: "mercedes",
  Ferrari: "ferrari",
  Williams: "williams",
  "Aston Martin": "aston-martin",
  Alpine: "alpine",
  Haas: "haas",
  "Racing Bulls": "racing-bulls",
  Audi: "audi",
  Cadillac: "cadillac",
  Lotus: "lotus",
  Sauber: "sauber",
  BMW: "bmw",
  Renault: "renault",
  Benetton: "benetton",
  "Ferrari Classic": "ferrari",
};

export function teamLogoUrl(escuderia: string): string | null {
  const slug = LOGO_SLUGS[escuderia];
  return slug ? `/logos/${slug}.png` : null;
}
