/** Official championship months (2026 season). */
export const CHAMPIONSHIP_MONTHS = [
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export type ChampionshipMonth = (typeof CHAMPIONSHIP_MONTHS)[number];
