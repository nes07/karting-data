/* eslint-disable @next/next/no-img-element */
import { CONSTRUCTOR_COLORS, CATEGORY_LABELS, teamLogoUrl } from "@/lib/constants";
import { DotdEntry, MediaEntry } from "@/lib/data";
import { ChampionshipData, DriverStandingRow } from "@/lib/scoring/types";
import { PilotPlaceholder } from "./Badges";
import { fmtPts, formatLongDate } from "./format";

interface PilotEntry {
  id: string;
  alias: string;
  fullName?: string | null;
  photoUrl?: string | null;
  rank?: number;
  points?: number;
}

function PilotCard({ p }: { p: PilotEntry }) {
  return (
    <div className="pilot-card">
      {p.photoUrl ? (
        <img src={p.photoUrl} alt={p.alias} />
      ) : (
        <PilotPlaceholder alias={p.alias} />
      )}
      <div className="pilot-overlay">
        <div className="pilot-name">{p.alias}</div>
        {p.fullName && p.fullName !== p.alias && (
          <div className="pilot-fullname">{p.fullName}</div>
        )}
        {p.rank != null && (
          <div className="pilot-fullname">
            P{p.rank} · {fmtPts(p.points ?? 0)} pts
          </div>
        )}
      </div>
    </div>
  );
}

export function PilotsSection({
  data,
  driversF1,
  driversF2,
}: {
  data: ChampionshipData;
  driversF1: DriverStandingRow[];
  driversF2: DriverStandingRow[];
}) {
  const byId = new Map(data.drivers.filter((d) => d.active).map((d) => [d.id, d]));

  // Each pilot appears once, in the category of their official seat (reserves
  // without a seat fall into the category where they scored the most points).
  const assigned = new Map<string, { cat: "F1" | "F2"; row: DriverStandingRow }>();
  const consider = (rows: DriverStandingRow[], cat: "F1" | "F2") => {
    for (const row of rows) {
      if (!byId.has(row.driverId)) continue;
      const prev = assigned.get(row.driverId);
      const isOfficial = row.escuderia !== "RD";
      const prevOfficial = prev && prev.row.escuderia !== "RD";
      if (!prev || (isOfficial && !prevOfficial) ||
          (!prevOfficial && !isOfficial && row.totalPoints > prev.row.totalPoints)) {
        assigned.set(row.driverId, { cat, row });
      }
    }
  };
  consider(driversF1, "F1");
  consider(driversF2, "F2");

  const group = (cat: "F1" | "F2"): PilotEntry[] =>
    [...assigned.values()]
      .filter((a) => a.cat === cat)
      .sort((a, b) => a.row.rank - b.row.rank)
      .map(({ row }) => {
        const d = byId.get(row.driverId)!;
        return {
          id: d.id,
          alias: d.alias,
          fullName: d.fullName,
          photoUrl: d.photoUrl,
          rank: row.rank,
          points: row.totalPoints,
        };
      });

  // Active pilots without any standings entry yet (new signings).
  const pending: PilotEntry[] = [...byId.values()]
    .filter((d) => !assigned.has(d.id))
    .sort((a, b) => a.alias.localeCompare(b.alias));

  return (
    <section id="pilotos" className="section">
      <div className="container">
        <div className="section-header">
          <span className="tag">Temporada 2026</span>
          <h2 className="section-title">
            Pilotos <span className="accent">Confirmados</span>
          </h2>
          <p className="section-subtitle">
            Ordenados por puntos del campeonato. Pasa el cursor sobre cada
            piloto para ver su nombre.
          </p>
        </div>
        {(["F1", "F2"] as const).map((cat) => {
          const pilots = group(cat);
          if (pilots.length === 0) return null;
          return (
            <div className="teams-category" key={cat}>
              <div className="teams-category-title">
                {cat === "F1" ? "🏎" : "🏁"} {CATEGORY_LABELS[cat]}
              </div>
              <div className="pilots-grid">
                {pilots.map((p) => (
                  <PilotCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          );
        })}
        {pending.length > 0 && (
          <div className="teams-category">
            <div className="teams-category-title">⏳ Por debutar</div>
            <div className="pilots-grid">
              {pending.map((p) => (
                <PilotCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function TeamsSection({ data }: { data: ChampionshipData }) {
  const byCat = (cat: "F1" | "F2") =>
    data.teams
      .filter((t) => t.category === cat)
      .sort((a, b) => a.escuderia.localeCompare(b.escuderia));
  const aliasById = new Map(data.drivers.map((d) => [d.id, d.alias]));

  return (
    <section id="equipos" className="section">
      <div className="container">
        <div className="section-header">
          <span className="tag">Constructores</span>
          <h2 className="section-title">
            Los <span className="accent">Equipos</span>
          </h2>
          <p className="section-subtitle">
            Pasa el cursor para ver los integrantes de cada equipo.
          </p>
        </div>
        {(["F1", "F2"] as const).map((cat) => (
          <div className="teams-category" key={cat}>
            <div className="teams-category-title">
              {cat === "F1" ? "🏎" : "🏁"} {CATEGORY_LABELS[cat]}
            </div>
            <div className="teams-grid">
              {byCat(cat).map((t) => {
                const c = CONSTRUCTOR_COLORS[t.escuderia] ?? {
                  bg: "#666",
                  fg: "#fff",
                };
                const logo = teamLogoUrl(t.escuderia);
                return (
                  <div key={t.id} className="team-card">
                    {t.photoUrl ? (
                      <img src={t.photoUrl} alt={t.escuderia} />
                    ) : logo ? (
                      <div
                        className="team-placeholder"
                        style={{
                          display: "flex",
                          background: `linear-gradient(135deg,${c.bg}33,#12141a)`,
                        }}
                      >
                        <img
                          src={logo}
                          alt={t.escuderia}
                          style={{ maxWidth: "70%", maxHeight: "70%", objectFit: "contain" }}
                        />
                      </div>
                    ) : (
                      <div
                        className="team-placeholder"
                        style={{
                          display: "flex",
                          background: `linear-gradient(135deg,${c.bg}33,#12141a)`,
                        }}
                      >
                        <span className="team-escuderia-label">{t.escuderia}</span>
                      </div>
                    )}
                    <div className="team-color-bar" style={{ background: c.bg }} />
                    <div className="team-overlay">
                      <div className="team-overlay-name">{t.escuderia}</div>
                      <div className="team-overlay-pilots">
                        {t.driver1Id ? aliasById.get(t.driver1Id) : "TBD"}
                        <br />
                        {t.driver2Id ? aliasById.get(t.driver2Id) : "TBD"}
                      </div>
                      <span
                        className="team-escuderia-badge"
                        style={{ background: c.bg, color: c.fg }}
                      >
                        {cat}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DotdSection({ entries }: { entries: DotdEntry[] }) {
  return (
    <section id="dotd" className="section">
      <div className="container">
        <div className="section-header">
          <span className="tag">Por fecha</span>
          <h2 className="section-title">
            Driver <span className="gold">of the Day</span>
          </h2>
          <p className="section-subtitle">
            El mejor piloto de cada fecha oficial del campeonato.
          </p>
        </div>
        <div className="dotd-timeline">
          {entries.length === 0 && (
            <div className="dotd-empty">Aún no hay premios DOTD.</div>
          )}
          {entries.map((e) => (
            <div
              className="dotd-card"
              key={`${e.date}-${e.category}-${e.alias}`}
            >
              <div className="dotd-photo">
                {e.photoUrl ? (
                  <img src={e.photoUrl} alt={e.alias} />
                ) : (
                  <div className="dotd-photo-placeholder">🏆</div>
                )}
              </div>
              <div className="dotd-body">
                <div className="dotd-meta">
                  <span className="dotd-date">{formatLongDate(e.date)}</span>
                  <span className="dotd-category">
                    {e.category === "F1" ? "F1 Moderna" : "F1 Clásica"}
                  </span>
                </div>
                <div className="dotd-pilot-name">🏆 {e.alias}</div>
                {e.reason && <p className="dotd-trophy">{e.reason}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MediaSection({ media }: { media: MediaEntry[] }) {
  const fotos = media.filter((m) => m.tipo === "Foto");
  const videos = media.filter((m) => m.tipo !== "Foto");

  return (
    <section id="media" className="section">
      <div className="container">
        <div className="section-header">
          <span className="tag">Galería &amp; Videos</span>
          <h2 className="section-title">
            GKD <span className="accent">Media</span>
          </h2>
          <p className="section-subtitle">
            Fotos y videos de cada fecha del campeonato.
          </p>
        </div>
        {media.length === 0 && (
          <div className="media-empty">Aún no hay contenido multimedia.</div>
        )}
        {fotos.length > 0 && (
          <div className="media-gallery-wrap">
            <div className="media-sub-heading">
              <span>📸</span> Galería de Fotos
            </div>
            <div className="media-carousel">
              {fotos.map((f) => (
                <a
                  key={f.url}
                  className="media-photo-slide"
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="media-photo-caption">{f.titulo}</div>
                </a>
              ))}
            </div>
          </div>
        )}
        {videos.length > 0 && (
          <div className="media-videos-wrap">
            <div className="media-sub-heading">
              <span>🎬</span> Videos
            </div>
            <div className="media-video-grid">
              {videos.map((v) => (
                <a
                  key={v.url}
                  className="media-video-card"
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="media-video-body">
                    <div className="media-video-title">{v.titulo}</div>
                    {v.fecha && (
                      <div className="media-video-date">{v.fecha}</div>
                    )}
                    <span className="media-video-cta">
                      Ver en {v.tipo} →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
