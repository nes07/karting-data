export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h},40%,18%)`;
}

export function fmtTime(t: number | null | undefined): string {
  if (t == null || t >= 999) return "—";
  return Number(t).toFixed(3);
}

export function fmtPts(p: number | null | undefined): string {
  if (p == null) return "—";
  // 34.5 stays 34.5, 34 stays 34
  return String(p);
}

export function rowClass(rank: number): string {
  if (rank === 1) return "rank-1";
  if (rank === 2) return "rank-2";
  if (rank === 3) return "rank-3";
  return "";
}

export function rankBadgeClass(rank: number): string {
  if (rank === 1) return "rank-badge gold";
  if (rank === 2) return "rank-badge silver";
  if (rank === 3) return "rank-badge bronze";
  return "rank-badge normal";
}

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "2026-04-12" → "Domingo 12 de Abril" */
export function formatLongDate(iso: string): string {
  const dt = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return iso;
  return `${DAYS_ES[dt.getDay()]} ${dt.getDate()} de ${MONTHS_ES[dt.getMonth()]}`;
}

/** "2026-04-12" → "12/04/2026" */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
