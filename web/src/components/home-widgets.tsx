/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CONSTRUCTOR_COLORS, teamLogoUrl } from "@/lib/constants";
import type { SiteData, VueltaRapidaRow } from "@/lib/data";
import type {
  Category,
  DriverStandingRow,
  TeamStandingRow,
} from "@/lib/scoring/types";
import { positionPoints } from "@/lib/scoring/engine";
import { ConstructorBadge, PilotPlaceholder, RankBadge } from "./Badges";
import {
  fmtPts,
  fmtTime,
  formatShortDate,
  initials,
  rankBadgeClass,
  rowClass,
  stringToColor,
} from "./format";

function VariationBadge({ v }: { v: number | null }) {
  if (v == null) return <span className="vr-new">★</span>;
  if (v > 0) return <span className="vr-up-up">▲ {v}</span>;
  if (v < 0) return <span className="vr-down">▼ {Math.abs(v)}</span>;
  return <span className="vr-neutral">↔</span>;
}

interface RankingRow {
  rank: number;
  label: string;
  pts: string;
  escuderia: string | null;
  photo: string | null;
  isLogo?: boolean;
}

function accentOf(escuderia: string | null): string {
  if (!escuderia) return "var(--red)";
  return CONSTRUCTOR_COLORS[escuderia]?.bg ?? "var(--red)";
}

function PodiumAvatar({ row }: { row: RankingRow }) {
  return (
    <div className={`rc-pod pos-${row.rank}`}>
      {row.photo ? (
        <img
          src={row.photo}
          alt={row.label}
          style={row.isLogo ? { objectFit: "contain", padding: 6 } : undefined}
        />
      ) : (
        <div
          className="rc-pod-ph"
          style={{ background: stringToColor(row.label) }}
        >
          {initials(row.label)}
        </div>
      )}
      <span className={`rc-pod-badge ${rankBadgeClass(row.rank)}`}>
        {row.rank}
      </span>
    </div>
  );
}

export function RankingCard({
  tag = "Standings",
  big = "1",
  label,
  meta,
  href,
  ctaLabel = "Ver standings",
  rows,
}: {
  tag?: string;
  big?: string;
  label: string;
  meta?: string;
  href: string;
  ctaLabel?: string;
  rows: RankingRow[];
}) {
  if (rows.length === 0) return null;
  const accent = accentOf(rows[0].escuderia);
  // Podium order: P2 · P1 (center, elevated) · P3.
  const podium = [rows[1], rows[0], rows[2]].filter(
    (r): r is RankingRow => r != null
  );
  return (
    <div
      className="ranking-card"
      style={{ ["--rc-accent"]: accent } as React.CSSProperties}
    >
      <div className="ranking-card-head">
        <span className="ranking-card-one">{big}</span>
        <div className="ranking-card-titles">
          <span className="ranking-card-tag">{tag}</span>
          <span className="ranking-card-title">{label}</span>
          {meta ? <span className="ranking-card-meta">{meta}</span> : null}
        </div>
        <div className="ranking-card-podium">
          {podium.map((r) => (
            <PodiumAvatar key={r.rank} row={r} />
          ))}
        </div>
      </div>
      <ul className="ranking-card-list">
        {rows.slice(0, 3).map((r) => (
          <li key={r.rank} className={rowClass(r.rank)}>
            <RankBadge rank={r.rank} />
            <span className="ranking-card-name">{r.label}</span>
            <span className="ranking-card-pts">{r.pts} pts</span>
          </li>
        ))}
      </ul>
      <Link href={href} className="ranking-card-cta">
        {ctaLabel} <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

export function driversToRankingRows(
  rows: DriverStandingRow[],
  photos: Record<string, string>
): RankingRow[] {
  return rows.slice(0, 3).map((r) => ({
    rank: r.rank,
    label: r.alias,
    pts: fmtPts(r.totalPoints),
    escuderia: r.escuderia === "RD" ? null : r.escuderia,
    photo: photos[r.alias] ?? null,
  }));
}

export function teamsToRankingRows(
  rows: TeamStandingRow[],
  teamPhotos: Record<string, string>
): RankingRow[] {
  return rows.slice(0, 3).map((r) => {
    const photo = teamPhotos[r.escuderia] ?? null;
    const logo = photo ?? teamLogoUrl(r.escuderia);
    return {
      rank: r.rank,
      label: r.escuderia,
      pts: fmtPts(r.totalPoints),
      escuderia: r.escuderia,
      photo: logo,
      isLogo: photo == null && logo != null,
    };
  });
}

export interface LastRaceCardData {
  label: string;
  meta: string;
  big: string;
  rows: RankingRow[];
}

/** Podium of the most recent race with published results for a category. */
export function buildLastRace(
  site: SiteData,
  cat: Category,
  photos: Record<string, string>
): LastRaceCardData | null {
  const { data } = site;
  const racesWithResults = data.races
    .filter((race) =>
      data.results.some((r) => r.raceId === race.id && r.category === cat)
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const race = racesWithResults[0];
  if (!race) return null;

  const aliasById = new Map(data.drivers.map((d) => [d.id, d.alias]));
  const escByDriver = new Map<string, string>();
  for (const t of data.teams) {
    if (t.category !== cat) continue;
    for (const id of [t.driver1Id, t.driver2Id]) {
      if (id) escByDriver.set(id, t.escuderia);
    }
  }

  const officialRaces = data.races
    .filter((r) => r.isOfficial)
    .sort((a, b) => a.date.localeCompare(b.date));
  const roundNumber = officialRaces.findIndex((r) => r.id === race.id) + 1;

  const rows: RankingRow[] = data.results
    .filter((r) => r.raceId === race.id && r.category === cat)
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
    .map((r) => {
      const alias = aliasById.get(r.driverId) ?? "?";
      return {
        rank: r.position,
        label: alias,
        pts: fmtPts(positionPoints(r.position, cat, data.config)),
        escuderia: r.isReserve ? null : escByDriver.get(r.driverId) ?? null,
        photo: photos[alias] ?? null,
      };
    });

  return {
    label: `Carrera ${cat}`,
    meta: `${race.monthLabel} · ${formatShortDate(race.date)}`,
    big: roundNumber > 0 ? `R${roundNumber}` : "R1",
    rows,
  };
}

export function PilotsPromo({
  drivers,
  photos,
}: {
  drivers: DriverStandingRow[];
  photos: Record<string, string>;
}) {
  const top = drivers.slice(0, 3);
  return (
    <div className="pilots-promo">
      <div className="pilots-promo-text">
        <h2 className="pilots-promo-title">
          Pilotos <span className="accent">GKD</span>
        </h2>
        <p className="pilots-promo-sub">
          Conoce a todos los pilotos del GKD Championship: fotos, escuderías y
          posiciones en vivo.
        </p>
        <Link href="/pilotos" className="ranking-card-cta pilots-promo-cta">
          Ir a la página <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="pilots-promo-photos">
        {top.map((d) =>
          photos[d.alias] ? (
            <img key={d.alias} src={photos[d.alias]} alt={d.alias} />
          ) : (
            <PilotPlaceholder
              key={d.alias}
              alias={d.alias}
              className="pilots-promo-placeholder"
            />
          )
        )}
      </div>
    </div>
  );
}

export interface VrHomeInfo {
  escuderia: string | null;
  category: Category | null;
}

/** Escudería + category of each driver's official seat, keyed by alias. */
export function buildVrInfo(site: SiteData): Record<string, VrHomeInfo> {
  const aliasById = new Map(site.data.drivers.map((d) => [d.id, d.alias]));
  const info: Record<string, VrHomeInfo> = {};
  const teamsSorted = [...site.data.teams].sort((a, b) =>
    a.category.localeCompare(b.category)
  );
  for (const t of teamsSorted) {
    for (const id of [t.driver1Id, t.driver2Id]) {
      const alias = id ? aliasById.get(id) : null;
      if (alias && !info[alias]) {
        info[alias] = { escuderia: t.escuderia, category: t.category };
      }
    }
  }
  return info;
}

export function VrHomeTable({
  rows,
  photos,
  info,
  limit = 8,
}: {
  rows: VueltaRapidaRow[];
  photos: Record<string, string>;
  info: Record<string, VrHomeInfo>;
  limit?: number;
}) {
  if (rows.length === 0) {
    return <div className="table-empty">Aún no hay datos de vuelta rápida.</div>;
  }
  return (
    <div className="standings-table-wrap home-vr-wrap">
      <table className="standings-table home-vr-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Piloto</th>
            <th>Cat</th>
            <th>Escudería</th>
            <th>Tiempo</th>
            <th>Var</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r) => {
            const i = info[r.alias];
            return (
              <tr key={r.alias} className={rowClass(r.rank)}>
                <td>
                  <RankBadge rank={r.rank} />
                </td>
                <td className="pilot-cell">
                  <span className="home-vr-pilot">
                    {photos[r.alias] ? (
                      <img src={photos[r.alias]} alt="" />
                    ) : (
                      <span
                        className="home-vr-avatar-ph"
                        style={{ background: stringToColor(r.alias) }}
                      >
                        {initials(r.alias)}
                      </span>
                    )}
                    {r.alias}
                  </span>
                </td>
                <td>
                  {i?.category ? (
                    <span className={`home-vr-cat cat-${i.category.toLowerCase()}`}>
                      {i.category}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {i?.escuderia ? (
                    <ConstructorBadge escuderia={i.escuderia} />
                  ) : (
                    <span className="constructor-badge" style={{ background: "#333", color: "#fff" }}>
                      RD
                    </span>
                  )}
                </td>
                <td className="time-cell">{fmtTime(r.time)}</td>
                <td className="pts-small">
                  <VariationBadge v={r.variation} />
                </td>
                <td className="pts-small">{formatShortDate(r.date)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
