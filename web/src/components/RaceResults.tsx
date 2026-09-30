"use client";

import { useMemo, useState } from "react";
import { CONSTRUCTOR_COLORS } from "@/lib/constants";
import { ChampionshipData, Category } from "@/lib/scoring/types";
import { positionPoints } from "@/lib/scoring/engine";
import { ShareButton } from "./ShareButton";
import { formatShortDate, rankBadgeClass, rowClass } from "./format";
import { PodiumResults } from "./standings-widgets";

interface ResultRow {
  pos: number;
  alias: string;
  escuderia: string;
  isReserve: boolean;
  pts: number;
}

interface DateBlock {
  raceId: string;
  monthLabel: string;
  date: string;
  f1: ResultRow[];
  f2: ResultRow[];
}

function buildBlocks(data: ChampionshipData): DateBlock[] {
  const aliasById = new Map(data.drivers.map((d) => [d.id, d.alias]));
  const escByDriver: Record<Category, Map<string, string>> = {
    F1: new Map(),
    F2: new Map(),
  };
  for (const t of data.teams) {
    for (const id of [t.driver1Id, t.driver2Id]) {
      if (id) escByDriver[t.category].set(id, t.escuderia);
    }
  }

  const blocks: DateBlock[] = [];
  const sorted = [...data.races].sort((a, b) => a.date.localeCompare(b.date));
  for (const race of sorted) {
    const rows = data.results.filter((r) => r.raceId === race.id);
    if (rows.length === 0) continue;
    const mk = (cat: Category): ResultRow[] =>
      rows
        .filter((r) => r.category === cat)
        .sort((a, b) => a.position - b.position)
        .map((r) => ({
          pos: r.position,
          alias: aliasById.get(r.driverId) ?? "?",
          escuderia: r.isReserve
            ? "RD"
            : escByDriver[cat].get(r.driverId) ?? "—",
          isReserve: r.isReserve,
          pts: positionPoints(r.position, cat, data.config),
        }));
    blocks.push({
      raceId: race.id,
      monthLabel: race.monthLabel,
      date: race.date,
      f1: mk("F1"),
      f2: mk("F2"),
    });
  }
  return blocks.reverse();
}

function ResultsTable({ rows }: { rows: ResultRow[] }) {
  if (rows.length === 0) {
    return <div className="table-empty">Sin resultados.</div>;
  }
  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Piloto</th>
            <th>Escudería</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = CONSTRUCTOR_COLORS[r.escuderia] ?? { bg: "#333", fg: "#fff" };
            return (
              <tr key={`${r.alias}-${r.pos}`} className={rowClass(r.pos)}>
                <td>
                  <span className={rankBadgeClass(r.pos)}>{r.pos}</span>
                </td>
                <td className="pilot-cell">
                  {r.alias}
                  {r.isReserve ? " (RD)" : ""}
                </td>
                <td>
                  <span
                    className="constructor-badge"
                    style={{ background: c.bg, color: c.fg }}
                  >
                    {r.escuderia}
                  </span>
                </td>
                <td className="pts-total">{r.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RaceResults({
  data,
  photos,
}: {
  data: ChampionshipData;
  photos: Record<string, string>;
}) {
  const blocks = useMemo(() => buildBlocks(data), [data]);
  const [active, setActive] = useState(0);
  const [cat, setCat] = useState<Category>("F1");

  if (blocks.length === 0) {
    return <div className="table-empty">Aún no hay resultados de carreras.</div>;
  }

  const block = blocks[active];
  const rows = cat === "F1" ? block.f1 : block.f2;

  return (
    <>
      <div className="results-toolbar">
        <div className="results-toolbar-inner">
          <div
            className="results-toolbar-dates"
            role="tablist"
            aria-label="Fecha de carrera"
          >
            {blocks.map((b, i) => (
              <button
                key={b.raceId}
                type="button"
                className={`results-date-btn${i === active ? " active" : ""}`}
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
              >
                {b.monthLabel} — {formatShortDate(b.date)}
              </button>
            ))}
          </div>
          <div className="champ-cat" role="tablist" aria-label="Categoría">
            <button
              type="button"
              className={`champ-cat-btn${cat === "F1" ? " active" : ""}`}
              role="tab"
              aria-selected={cat === "F1"}
              onClick={() => setCat("F1")}
            >
              F1
            </button>
            <button
              type="button"
              className={`champ-cat-btn${cat === "F2" ? " active" : ""}`}
              role="tab"
              aria-selected={cat === "F2"}
              onClick={() => setCat("F2")}
            >
              F2
            </button>
          </div>
          <ShareButton
            endpoint={`/api/share/round?date=${block.date}&cat=${cat}`}
            filename={`gkd-round-${block.date}-${cat.toLowerCase()}`}
            title={`Resultados ${block.monthLabel} ${cat} — GKD Championship`}
          />
        </div>
      </div>

      <PodiumResults rows={rows} photos={photos} />
      <ResultsTable rows={rows} />
    </>
  );
}
