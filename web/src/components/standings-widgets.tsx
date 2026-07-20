/* eslint-disable @next/next/no-img-element */
import { CONSTRUCTOR_COLORS, teamLogoUrl } from "@/lib/constants";
import { VueltaRapidaRow } from "@/lib/data";
import { DriverStandingRow, TeamStandingRow } from "@/lib/scoring/types";
import { ShareButton } from "./ShareButton";
import {
  fmtGap,
  fmtPts,
  fmtTime,
  formatShortDate,
  initials,
  rankBadgeClass,
  rowClass,
  stringToColor,
} from "./format";

function RankBadge({ rank }: { rank: number }) {
  return <span className={rankBadgeClass(rank)}>{rank}</span>;
}

function VariationBadge({ v }: { v: number | null }) {
  if (v == null) return <span className="vr-new">★</span>;
  if (v > 0) return <span className="vr-up-up">▲ {v}</span>;
  if (v < 0) return <span className="vr-down">▼ {Math.abs(v)}</span>;
  return <span className="vr-neutral">↔</span>;
}

export function PodiumDriver({
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

export function PodiumTeam({
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

export function DriversTable({
  rows,
  months,
  shareEndpoint,
}: {
  rows: DriverStandingRow[];
  months: string[];
  /** When set, each row gets a share button generating its highlight image. */
  shareEndpoint?: string;
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
            {shareEndpoint && <th></th>}
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
                      {r ? (
                        <>
                          {r.position} / {r.points}
                          {r.penaltyPoints < 0 && (
                            <span className="penalty-badge">{r.penaltyPoints}</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
                <td className="pts-small">
                  {p.posProm != null ? p.posProm.toFixed(1) : "—"}
                </td>
                {shareEndpoint && (
                  <td className="share-cell">
                    <ShareButton
                      compact
                      endpoint={`${shareEndpoint}&highlight=${encodeURIComponent(p.alias)}`}
                      filename={`gkd-${p.alias.toLowerCase().replace(/\s+/g, "-")}`}
                      title={`${p.alias} — GKD Championship`}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TeamsTable({
  rows,
  months,
  shareEndpoint,
}: {
  rows: TeamStandingRow[];
  months: string[];
  /** When set, each row gets a share button generating its highlight image. */
  shareEndpoint?: string;
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
            {shareEndpoint && <th></th>}
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
                      {r ? (
                        <>
                          {fmtPts(r.points)}
                          {r.penaltyPoints < 0 && (
                            <span className="penalty-badge">{r.penaltyPoints}</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
                {shareEndpoint && (
                  <td className="share-cell">
                    <ShareButton
                      compact
                      endpoint={`${shareEndpoint}&highlight=${encodeURIComponent(t.escuderia)}`}
                      filename={`gkd-${t.escuderia.toLowerCase().replace(/\s+/g, "-")}`}
                      title={`${t.escuderia} — GKD Championship`}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PodiumVueltaRapida({
  rows,
  photos,
}: {
  rows: VueltaRapidaRow[];
  photos: Record<string, string>;
}) {
  return (
    <div className="podium-wrap">
      {rows.slice(0, 3).map((r) => {
        const photo = photos[r.alias];
        return (
          <div key={r.alias} className="podium-slot" data-pos={r.rank}>
            <div className="podium-img-wrap">
              {photo ? (
                <img className="podium-pilot-img" src={photo} alt={r.alias} />
              ) : (
                <div
                  className="podium-placeholder"
                  style={{ display: "flex", background: stringToColor(r.alias) }}
                >
                  {initials(r.alias)}
                </div>
              )}
              <div className="podium-pos-badge">{r.rank}</div>
            </div>
            <div className="podium-name">{r.alias}</div>
            <div className="podium-time">{fmtTime(r.time)}</div>
            <div className="podium-vr-date">{formatShortDate(r.date)}</div>
            <div className="podium-pedestal">{r.rank}</div>
          </div>
        );
      })}
    </div>
  );
}

export interface ResultPodiumRow {
  pos: number;
  alias: string;
  escuderia: string;
  pts: number;
}

export function PodiumResults({
  rows,
  photos,
}: {
  rows: ResultPodiumRow[];
  photos: Record<string, string>;
}) {
  const top3 = [...rows]
    .filter((r) => r.pos <= 3)
    .sort((a, b) => a.pos - b.pos);

  if (top3.length === 0) return null;

  return (
    <div className="podium-wrap">
      {top3.map((r) => {
        const c = CONSTRUCTOR_COLORS[r.escuderia];
        const photo = photos[r.alias];
        return (
          <div
            key={r.alias}
            className="podium-slot"
            data-pos={r.pos}
            style={c ? ({ ["--esc-color"]: c.bg } as React.CSSProperties) : undefined}
          >
            <div className="podium-img-wrap">
              {photo ? (
                <img className="podium-pilot-img" src={photo} alt={r.alias} />
              ) : (
                <div
                  className="podium-placeholder"
                  style={{ display: "flex", background: stringToColor(r.alias) }}
                >
                  {initials(r.alias)}
                </div>
              )}
              <div className="podium-pos-badge">{r.pos}</div>
            </div>
            <div className="podium-name">{r.alias}</div>
            {c && (
              <span
                className="podium-team-tag"
                style={{ background: c.bg, color: c.fg }}
              >
                {r.escuderia}
              </span>
            )}
            <div className="podium-pts">{r.pts} pts</div>
            <div className="podium-pedestal">{r.pos}</div>
          </div>
        );
      })}
    </div>
  );
}

export function VueltaRapidaTable({
  rows,
  shareEndpoint,
}: {
  rows: VueltaRapidaRow[];
  /** When set, each row gets a share button generating its highlight image. */
  shareEndpoint?: string;
}) {
  if (rows.length === 0) {
    return <div className="table-empty">Aún no hay datos de vuelta rápida.</div>;
  }
  const leaderTime = rows[0]?.time ?? null;
  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Piloto</th>
            <th>Tiempo</th>
            <th>Gap to Leader</th>
            <th>Var</th>
            <th>Fecha</th>
            {shareEndpoint && <th></th>}
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
              <td className="pts-small gap-cell">{fmtGap(r.time, leaderTime, r.rank)}</td>
              <td className="pts-small">
                <VariationBadge v={r.variation} />
              </td>
              <td className="pts-small">{formatShortDate(r.date)}</td>
              {shareEndpoint && (
                <td className="share-cell">
                  <ShareButton
                    compact
                    endpoint={`${shareEndpoint}&highlight=${encodeURIComponent(r.alias)}`}
                    filename={`gkd-vr-${r.alias.toLowerCase().replace(/\s+/g, "-")}`}
                    title={`${r.alias} — Vuelta Rápida GKD`}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
