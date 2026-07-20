/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CONSTRUCTOR_COLORS, teamLogoUrl } from "@/lib/constants";
import type { SiteData, VueltaRapidaRow } from "@/lib/data";
import type {
  Category,
  DriverStandingRow,
  TeamStandingRow,
} from "@/lib/scoring/types";
import { ConstructorBadge, PilotPlaceholder, RankBadge } from "./Badges";
import {
  fmtPts,
  fmtTime,
  formatShortDate,
  initials,
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

export function RankingCard({
  label,
  href,
  rows,
}: {
  label: string;
  href: string;
  rows: RankingRow[];
}) {
  if (rows.length === 0) return null;
  const leader = rows[0];
  const accent = accentOf(leader.escuderia);
  return (
    <div
      className="ranking-card"
      style={{ ["--rc-accent"]: accent } as React.CSSProperties}
    >
      <div className="ranking-card-head">
        <span className="ranking-card-one">1</span>
        <div className="ranking-card-titles">
          <span className="ranking-card-tag">Ranking</span>
          <span className="ranking-card-title">{label}</span>
        </div>
        <div className="ranking-card-photo">
          {leader.photo ? (
            <img
              src={leader.photo}
              alt={leader.label}
              style={leader.isLogo ? { objectFit: "contain", padding: 8 } : undefined}
            />
          ) : (
            <div
              className="ranking-card-placeholder"
              style={{ background: stringToColor(leader.label) }}
            >
              {initials(leader.label)}
            </div>
          )}
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
        Ver ranking <span aria-hidden>→</span>
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
