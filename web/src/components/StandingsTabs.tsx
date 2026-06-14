"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { CONSTRUCTOR_COLORS, teamLogoUrl } from "@/lib/constants";
import { DriverStandingRow, TeamStandingRow } from "@/lib/scoring/types";
import { VueltaRapidaRow } from "@/lib/data";
import {
  fmtPts,
  fmtTime,
  formatShortDate,
  initials,
  rankBadgeClass,
  rowClass,
  stringToColor,
} from "./format";

interface Props {
  driversF1: DriverStandingRow[];
  driversF2: DriverStandingRow[];
  teamsF1: TeamStandingRow[];
  teamsF2: TeamStandingRow[];
  vueltaRapida: VueltaRapidaRow[];
  months: string[];
  /** alias → photo URL (pilots with an uploaded photo). */
  photos: Record<string, string>;
  /** escudería → photo URL (teams with an uploaded photo). */
  teamPhotos: Record<string, string>;
}

const TABS = [
  ["ds-f1", "Drivers — F1"],
  ["ds-f2", "Drivers — F2"],
  ["ts-f1", "Teams — F1"],
  ["ts-f2", "Teams — F2"],
  ["vr", "Vuelta Rápida"],
] as const;

function RankBadge({ rank }: { rank: number }) {
  return <span className={rankBadgeClass(rank)}>{rank}</span>;
}

function VariationBadge({ v }: { v: number | null }) {
  if (v == null) return <span className="vr-new">★</span>;
  if (v > 0) return <span className="vr-up-up">▲ {v}</span>;
  if (v < 0) return <span className="vr-down">▼ {Math.abs(v)}</span>;
  return <span className="vr-neutral">↔</span>;
}

function PodiumDriver({
  rows,
  photos,
}: {
  rows: DriverStandingRow[];
  photos: Record<string, string>;
}) {
  return (
    <div className="podium-wrap">
      {rows.slice(0, 3).map((e) => {
        const c = CONSTRUCTOR_COLORS[e.escuderia];
        const photo = photos[e.alias];
        return (
          <div
            key={e.driverId}
            className="podium-slot"
            data-pos={e.rank}
            style={c ? ({ ["--esc-color"]: c.bg } as React.CSSProperties) : undefined}
          >
            <div className="podium-img-wrap">
              {photo ? (
                <img className="podium-pilot-img" src={photo} alt={e.alias} />
              ) : (
                <div
                  className="podium-placeholder"
                  style={{ display: "flex", background: stringToColor(e.alias) }}
                >
                  {initials(e.alias)}
                </div>
              )}
              <div className="podium-pos-badge">{e.rank}</div>
            </div>
            <div className="podium-name">{e.alias}</div>
            {c && (
              <span
                className="podium-team-tag"
                style={{ background: c.bg, color: c.fg }}
              >
                {e.escuderia}
              </span>
            )}
            <div className="podium-pts">{fmtPts(e.totalPoints)} pts</div>
            <div className="podium-pedestal">{e.rank}</div>
          </div>
        );
      })}
    </div>
  );
}

function PodiumTeam({
  rows,
  teamPhotos,
}: {
  rows: TeamStandingRow[];
  teamPhotos: Record<string, string>;
}) {
  return (
    <div className="podium-wrap">
      {rows.slice(0, 3).map((t) => {
        const c = CONSTRUCTOR_COLORS[t.escuderia] ?? { bg: "#1a1d26", fg: "#fff" };
        const photo = teamPhotos[t.escuderia];
        const logo = photo ?? teamLogoUrl(t.escuderia);
        return (
          <div key={t.teamId} className="podium-slot" data-pos={t.rank}>
            <div className="podium-img-wrap" style={{ borderRadius: 12 }}>
              {logo ? (
                <img
                  className="podium-team-logo"
                  src={logo}
                  alt={t.escuderia}
                  style={photo ? undefined : { objectFit: "contain", padding: 12 }}
                />
              ) : (
                <div
                  className="podium-placeholder"
                  style={{
                    display: "flex",
                    background: c.bg,
                    borderRadius: 12,
                    fontSize: "0.7rem",
                    letterSpacing: "0.04em",
                    color: c.fg,
                    textAlign: "center",
                    padding: 8,
                    fontFamily: "'Microgramma','Exo 2',sans-serif",
                    fontWeight: 700,
                  }}
                >
                  {t.escuderia}
                </div>
              )}
              <div className="podium-pos-badge">{t.rank}</div>
            </div>
            <div className="podium-name">{t.escuderia}</div>
            <div className="podium-pts">{fmtPts(t.totalPoints)} pts</div>
            <div className="podium-pedestal">{t.rank}</div>
          </div>
        );
      })}
    </div>
  );
}

function DriversTable({
  rows,
  months,
}: {
  rows: DriverStandingRow[];
  months: string[];
}) {
  if (rows.length === 0) {
    return <div className="table-empty">Aún no hay datos de standings.</div>;
  }
  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Var</th>
            <th>Piloto</th>
            <th>Pts</th>
            {months.map((m) => (
              <th key={m}>
                {m.slice(0, 3)}
                <br />
                <span style={{ fontSize: "0.6rem", opacity: 0.6 }}>Pos / Pts fecha</span>
              </th>
            ))}
            <th>Prom</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const byMonth = new Map(p.races.map((r) => [r.monthLabel, r]));
            return (
              <tr key={p.driverId} className={rowClass(p.rank)}>
                <td>
                  <RankBadge rank={p.rank} />
                </td>
                <td className="pts-small">
                  <VariationBadge v={p.variation} />
                </td>
                <td className="pilot-cell">
                  {p.alias}
                  {p.isReserve ? " (RD)" : ""}
                </td>
                <td className="pts-total">{fmtPts(p.totalPoints)}</td>
                {months.map((m) => {
                  const r = byMonth.get(m);
                  return (
                    <td key={m} className={`pos-cell ${r ? "has-value" : ""}`}>
                      {r ? `${r.position} / ${r.points}` : "—"}
                    </td>
                  );
                })}
                <td className="pts-small">
                  {p.posProm != null ? p.posProm.toFixed(1) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamsTable({
  rows,
  months,
}: {
  rows: TeamStandingRow[];
  months: string[];
}) {
  if (rows.length === 0) {
    return <div className="table-empty">Aún no hay datos de standings.</div>;
  }
  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Var</th>
            <th>Equipo</th>
            <th>Escudería</th>
            <th>Piloto 1</th>
            <th>Piloto 2</th>
            <th>Pts</th>
            {months.map((m) => (
              <th key={m}>{m.slice(0, 3)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const c = CONSTRUCTOR_COLORS[t.escuderia] ?? { bg: "#333", fg: "#fff" };
            const byMonth = new Map(t.races.map((r) => [r.monthLabel, r]));
            return (
              <tr key={t.teamId} className={rowClass(t.rank)}>
                <td>
                  <RankBadge rank={t.rank} />
                </td>
                <td className="pts-small">
                  <VariationBadge v={t.variation} />
                </td>
                <td className="pilot-cell">{t.name}</td>
                <td>
                  <span
                    className="constructor-badge"
                    style={{ background: c.bg, color: c.fg }}
                  >
                    {t.escuderia}
                  </span>
                </td>
                <td className="pts-small">{t.driver1Alias ?? "TBD"}</td>
                <td className="pts-small">{t.driver2Alias ?? "TBD"}</td>
                <td className="pts-total">{fmtPts(t.totalPoints)}</td>
                {months.map((m) => {
                  const r = byMonth.get(m);
                  return (
                    <td key={m} className="pts-small">
                      {r ? fmtPts(r.points) : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VueltaRapidaTable({ rows }: { rows: VueltaRapidaRow[] }) {
  if (rows.length === 0) {
    return <div className="table-empty">Aún no hay datos de vuelta rápida.</div>;
  }
  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Piloto</th>
            <th>Tiempo</th>
            <th>Var</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.alias} className={rowClass(r.rank)}>
              <td>
                <RankBadge rank={r.rank} />
              </td>
              <td className="pilot-cell">{r.alias}</td>
              <td className="time-cell">{fmtTime(r.time)}</td>
              <td className="pts-small">
                <VariationBadge v={r.variation} />
              </td>
              <td className="pts-small">{formatShortDate(r.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StandingsTabs(props: Props) {
  const [active, setActive] = useState<(typeof TABS)[number][0]>("ds-f1");
  const { months } = props;

  return (
    <div className="tabs-wrapper">
      <div className="tabs-nav" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={`tab-btn${active === id ? " active" : ""}`}
            role="tab"
            onClick={() => setActive(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {active === "ds-f1" && (
        <div className="tab-panel active" role="tabpanel">
          <PodiumDriver rows={props.driversF1} photos={props.photos} />
          <DriversTable rows={props.driversF1} months={months} />
        </div>
      )}
      {active === "ds-f2" && (
        <div className="tab-panel active" role="tabpanel">
          <PodiumDriver rows={props.driversF2} photos={props.photos} />
          <DriversTable rows={props.driversF2} months={months} />
        </div>
      )}
      {active === "ts-f1" && (
        <div className="tab-panel active" role="tabpanel">
          <PodiumTeam rows={props.teamsF1} teamPhotos={props.teamPhotos} />
          <TeamsTable rows={props.teamsF1} months={months} />
        </div>
      )}
      {active === "ts-f2" && (
        <div className="tab-panel active" role="tabpanel">
          <PodiumTeam rows={props.teamsF2} teamPhotos={props.teamPhotos} />
          <TeamsTable rows={props.teamsF2} months={months} />
        </div>
      )}
      {active === "vr" && (
        <div className="tab-panel active" role="tabpanel">
          <VueltaRapidaTable rows={props.vueltaRapida} />
        </div>
      )}
    </div>
  );
}
