/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import { CONSTRUCTOR_COLORS } from "@/lib/constants";
import type { PublishedDebrief } from "@/lib/debrief/load";
import type {
  BattleFact,
  CatFacts,
  DebriefFacts,
  FormFact,
  ResultFact,
  StandingFact,
} from "@/lib/debrief/types";
import {
  formatPositionsGained,
  positionsGainedClass,
} from "@/lib/positions-gained";
import { formatLongDate, rankBadgeClass, rowClass } from "./format";

export function DebriefPhotoStrip({
  aliases,
  photos,
}: {
  aliases: string[];
  photos: Record<string, string>;
}) {
  const shown = aliases.filter((a) => photos[a]).slice(0, 8);
  if (!shown.length) return null;
  return (
    <div className="debrief-photos">
      {shown.map((alias) => (
        <figure key={alias} className="debrief-photo">
          <img src={photos[alias]} alt={alias} />
          <figcaption>{alias}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function DebriefCard({ item }: { item: PublishedDebrief }) {
  return (
    <Link href={`/debrief/${item.date}`} className="debrief-card">
      <span className="tag">{item.monthLabel}</span>
      <h2>{item.title}</h2>
      <p>{item.excerpt}</p>
      <span className="debrief-card-date">{formatLongDate(item.date)}</span>
    </Link>
  );
}

const CAT_NAME = { F1: "F1 Moderna", F2: "F1 Clásica" } as const;

function ptsLabel(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function driverPhoto(
  alias: string | undefined,
  embedded: string | null | undefined,
  photos: Record<string, string>
): string | null {
  if (!alias) return null;
  return photos[alias] ?? embedded ?? null;
}

function teamPhoto(
  escuderia: string | undefined,
  embedded: string | null | undefined,
  photos: Record<string, string>
): string | null {
  if (!escuderia) return null;
  return photos[escuderia] ?? embedded ?? null;
}

function Ghosts({ left, right }: { left: string | null; right: string | null }) {
  const l = left ?? right;
  const r = right ?? left;
  if (!l || !r) return null;
  return (
    <div className="debrief-ghosts" aria-hidden="true">
      <img className="debrief-ghost left" src={l} alt="" />
      <img className="debrief-ghost right" src={r} alt="" />
    </div>
  );
}

function Block({
  title,
  left,
  right,
  children,
}: {
  title?: string;
  left: string | null;
  right: string | null;
  children: ReactNode;
}) {
  return (
    <section className="debrief-block">
      <Ghosts left={left} right={right} />
      <div className="debrief-block-inner">
        {title ? <h2>{title}</h2> : null}
        {children}
      </div>
    </section>
  );
}

function Escuderia({ name }: { name: string }) {
  const c = CONSTRUCTOR_COLORS[name] ?? { bg: "#333", fg: "#fff" };
  return (
    <span className="constructor-badge" style={{ background: c.bg, color: c.fg }}>
      {name}
    </span>
  );
}

function ResultTable({ rows }: { rows: ResultFact[] }) {
  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Piloto</th>
            <th>Escudería</th>
            <th>Grilla</th>
            <th>Pos. ganadas</th>
            <th>Tiempo</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.alias}-${r.pos}`} className={r.dnf ? "" : rowClass(r.pos)}>
              <td>
                {r.dnf ? (
                  <span className="rank-badge dnf">DNF</span>
                ) : (
                  <span className={rankBadgeClass(r.pos)}>{r.pos}</span>
                )}
              </td>
              <td className="pilot-cell">{r.alias}</td>
              <td>
                <Escuderia name={r.escuderia} />
              </td>
              <td className={r.grid == null ? "pos-cell" : "pos-cell has-value"}>
                {r.grid == null ? "—" : `${r.grid}º`}
              </td>
              <td>
                <span className={`pos-delta ${positionsGainedClass(r.gained)}`}>
                  {formatPositionsGained(r.gained)}
                </span>
              </td>
              <td className="pos-cell has-value">
                {r.time == null ? "—" : r.time.toFixed(3)}
              </td>
              <td className="pts-total">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NamedList({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; name: string; detail: string; mark?: string; markClass?: string }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="debrief-list-block">
      <h3>{title}</h3>
      <ul className="debrief-rows">
        {rows.map((r) => (
          <li key={r.key}>
            <span className="debrief-row-name">{r.name}</span>
            <span className="debrief-row-meta">
              {r.mark ? (
                <span className={`pos-delta ${r.markClass ?? ""}`}>{r.mark}</span>
              ) : null}
              <span>{r.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function champMove(s: StandingFact): { text: string; cls: string } {
  if (s.prevRank == null) return { text: "Nuevo", cls: "empty" };
  const d = s.prevRank - s.rank;
  if (d === 0) return { text: "=", cls: "flat" };
  if (d > 0) return { text: `+${d}`, cls: "up" };
  return { text: String(d), cls: "down" };
}

function joined(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function puestos(n: number): string {
  return Math.abs(n) === 1 ? "1 puesto" : `${Math.abs(n)} puestos`;
}

function winnerLine(w: ResultFact): string {
  const grid =
    w.grid == null ? "Sin dato de grilla" : w.grid === 1 ? "Desde la pole" : `Salió ${w.grid}º`;
  const swing =
    w.gained != null && w.gained > 0
      ? ` y ganó ${puestos(w.gained)}`
      : w.gained != null && w.gained < 0
        ? ` y cedió ${puestos(w.gained)}`
        : "";
  const lap = w.time == null ? "" : ` Mejor vuelta ${w.time.toFixed(3)}.`;
  return `${w.alias} (${w.escuderia}) se quedó con la carrera. ${grid}${swing}.${lap}`;
}

function podiumLine(podium: ResultFact[]): string | null {
  if (podium.length < 2) return null;
  return `El podio: ${joined(podium.map((p) => `P${p.pos} ${p.alias}`))}.`;
}

function afternoonLine(cat: CatFacts): string | null {
  const bits: string[] = [];
  const g = cat.gainers[0];
  const l = cat.losers[0];
  if (g) {
    bits.push(
      g.grid == null
        ? `${g.alias} remontó hasta P${g.pos}`
        : `${g.alias} remontó de ${g.grid}º a P${g.pos}`
    );
  }
  if (l) {
    bits.push(
      l.grid == null
        ? `${l.alias} cayó a P${l.pos}`
        : `${l.alias} cayó de ${l.grid}º a P${l.pos}`
    );
  }
  return bits.length ? `${bits.join(". ")}.` : null;
}

function formLine(f: FormFact): string {
  const abs = Math.abs(f.delta);
  const n = Number.isInteger(abs) ? puestos(abs) : `${abs.toFixed(1)} puestos`;
  const where = f.delta > 0 ? "sobre" : "bajo";
  return `llegó P${f.thisPos}, ${n} ${where} su media de ${ptsLabel(f.avgPos)}.`;
}

function DriverTable({ rows }: { rows: StandingFact[] }) {
  return (
    <div className="standings-table-wrap debrief-table-slim">
      <table className="standings-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Piloto</th>
            <th>Pts</th>
            <th>Mov.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const move = champMove(s);
            return (
              <tr key={s.alias} className={rowClass(s.rank)}>
                <td>
                  <span className={rankBadgeClass(s.rank)}>{s.rank}</span>
                </td>
                <td className="pilot-cell">{s.alias}</td>
                <td className="pts-total">{ptsLabel(s.pts)}</td>
                <td>
                  <span className={`pos-delta ${move.cls}`}>{move.text}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamStrip({ rows }: { rows: StandingFact[] }) {
  return (
    <ol className="debrief-team-strip">
      {rows.slice(0, 3).map((s) => (
        <li key={s.alias}>
          <span className={rankBadgeClass(s.rank)}>{s.rank}</span>
          <Escuderia name={s.alias} />
          <span className="pts-total">{ptsLabel(s.pts)}</span>
        </li>
      ))}
    </ol>
  );
}

function BattleList({ battles }: { battles: BattleFact[] }) {
  if (!battles.length) return null;
  return (
    <ul className="debrief-battles">
      {battles.slice(0, 3).map((b) => (
        <li key={`${b.a}-${b.b}`}>
          <span className="debrief-row-name">
            {b.a}
            <span className="debrief-vs"> vs </span>
            {b.b}
          </span>
          <span className="debrief-row-meta">{b.note}</span>
        </li>
      ))}
    </ul>
  );
}

function CategoryBody({
  cat,
  photos,
  teamPhotos,
}: {
  cat: CatFacts;
  photos: Record<string, string>;
  teamPhotos: Record<string, string>;
}) {
  if (!cat.winner) return null;
  const name = CAT_NAME[cat.category];
  const p2 = cat.podium[1] ?? cat.results[1];
  const formPeople = [...cat.formUp, ...cat.formDown];
  const showMoves = cat.gainers.length > 0 || cat.losers.length > 0;
  const showForm = formPeople.length > 0;

  const lead = afternoonLine(cat);
  const podium = podiumLine(cat.podium);
  const driverBattles = cat.battles.slice(0, 3);
  const formLines = [...cat.formUp.slice(0, 2), ...cat.formDown.slice(0, 2)];

  return (
    <>
      <Block
        title={`${name} — la carrera`}
        left={driverPhoto(cat.winner.alias, cat.winner.photo, photos)}
        right={driverPhoto(p2?.alias, p2?.photo, photos)}
      >
        <div className="debrief-story">
          <p>{winnerLine(cat.winner)}</p>
          {podium ? <p>{podium}</p> : null}
        </div>
        <ResultTable rows={cat.results} />
        {showMoves ? (
          <>
            {lead ? <p className="debrief-bridge">{lead}</p> : null}
            <div className="debrief-split">
              <NamedList
                title="Remontaron"
                rows={cat.gainers.slice(0, 4).map((r) => ({
                  key: r.alias,
                  name: r.alias,
                  mark: formatPositionsGained(r.gained),
                  markClass: "up",
                  detail: r.grid == null ? `P${r.pos}` : `${r.grid}º → P${r.pos}`,
                }))}
              />
              <NamedList
                title="Perdieron lugares"
                rows={cat.losers.slice(0, 4).map((r) => ({
                  key: r.alias,
                  name: r.alias,
                  mark: formatPositionsGained(r.gained),
                  markClass: "down",
                  detail: r.grid == null ? `P${r.pos}` : `${r.grid}º → P${r.pos}`,
                }))}
              />
            </div>
          </>
        ) : null}
      </Block>

      {showForm ? (
        <Block
          title={`${name} — forma`}
          left={driverPhoto(formPeople[0]?.alias, formPeople[0]?.photo, photos)}
          right={driverPhoto(
            formPeople[1]?.alias ?? formPeople[0]?.alias,
            formPeople[1]?.photo ?? formPeople[0]?.photo,
            photos
          )}
        >
          <div className="debrief-story">
            {formLines.map((f) => (
              <p key={f.alias}>
                <span className="debrief-who">{f.alias}</span> {formLine(f)}
              </p>
            ))}
          </div>
        </Block>
      ) : null}

      {cat.drivers.length || cat.teams.length ? (
        <Block
          title={`${name} — el campeonato`}
          left={driverPhoto(cat.drivers[0]?.alias, cat.drivers[0]?.photo, photos)}
          right={
            teamPhoto(cat.teams[0]?.alias, cat.teams[0]?.photo, teamPhotos) ??
            driverPhoto(cat.drivers[1]?.alias, cat.drivers[1]?.photo, photos)
          }
        >
          {cat.drivers.length ? (
            <div className={driverBattles.length ? "debrief-mix" : undefined}>
              <div>
                <h3>Pilotos</h3>
                <DriverTable rows={cat.drivers.slice(0, 5)} />
              </div>
              {driverBattles.length ? (
                <div>
                  <h3>La pelea</h3>
                  <BattleList battles={driverBattles} />
                </div>
              ) : null}
            </div>
          ) : null}
          {cat.teams.length ? (
            <div className="debrief-constructors">
              <h3>Constructores</h3>
              <TeamStrip rows={cat.teams} />
              <BattleList battles={cat.teamBattles} />
            </div>
          ) : null}
        </Block>
      ) : null}
    </>
  );
}

function FactsBody({
  facts,
  photos,
  teamPhotos,
}: {
  facts: DebriefFacts;
  photos: Record<string, string>;
  teamPhotos: Record<string, string>;
}) {
  const vr = [...facts.vr.big, ...facts.vr.small];
  return (
    <>
      <CategoryBody cat={facts.F1} photos={photos} teamPhotos={teamPhotos} />
      <CategoryBody cat={facts.F2} photos={photos} teamPhotos={teamPhotos} />
      {vr.length ? (
        <Block
          title="Vuelta Rápida"
          left={driverPhoto(vr[0]?.alias, vr[0]?.photo, photos)}
          right={driverPhoto(vr[1]?.alias ?? vr[0]?.alias, vr[1]?.photo ?? vr[0]?.photo, photos)}
        >
          {facts.vr.big.length ? (
            <>
              <p className="debrief-bridge debrief-bridge-first">
                {facts.vr.big.length > 5
                  ? "Los saltos más grandes en Vuelta Rápida."
                  : facts.vr.big.length === 1
                    ? "Un salto grande en Vuelta Rápida."
                    : `${facts.vr.big.length} saltos grandes en Vuelta Rápida.`}
              </p>
              <ul className="debrief-rows">
                {facts.vr.big.slice(0, 5).map((m) => {
                  const delta = m.deltaRank;
                  const cls =
                    delta == null ? "empty" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
                  const mark =
                    delta == null ? "Debut" : delta > 0 ? `+${delta}` : delta === 0 ? "=" : String(delta);
                  return (
                    <li key={`${m.alias}-${m.to}`}>
                      <span className="debrief-row-name">{m.alias}</span>
                      <span className="debrief-row-meta">
                        <span>{m.from == null ? "Debut" : `P${m.from}`} → P{m.to}</span>
                        <span className={`pos-delta ${cls}`}>{mark}</span>
                        <span>{m.time.toFixed(3)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          {facts.vr.small.length ? (
            <p className="debrief-bridge">
              {`De a un puesto: ${facts.vr.small
                .slice(0, 6)
                .map((m) => `${m.alias} P${m.from}→P${m.to}`)
                .join(", ")}.`}
            </p>
          ) : null}
        </Block>
      ) : null}
    </>
  );
}

function ProseBody({
  item,
  photos,
}: {
  item: PublishedDebrief;
  photos: Record<string, string>;
}) {
  return (
    <>
      {item.body.sections.map((s) => {
        const mentioned = s.mentions.filter((a) => photos[a]);
        return (
          <Block
            key={s.heading}
            title={s.heading}
            left={mentioned[0] ? photos[mentioned[0]] : null}
            right={mentioned[1] ? photos[mentioned[1]] : photos[mentioned[0]] ?? null}
          >
            {s.paragraphs.map((p) => (
              <p key={p.slice(0, 48)}>{p}</p>
            ))}
          </Block>
        );
      })}
    </>
  );
}

export function DebriefArticleView({
  item,
  photos,
  teamPhotos,
}: {
  item: PublishedDebrief;
  photos: Record<string, string>;
  teamPhotos: Record<string, string>;
}) {
  const mentions = [
    ...item.featured,
    ...item.body.sections.flatMap((s) => s.mentions),
  ];
  const unique = [...new Set(mentions)];
  const headLeft = photos[item.featured[0] ?? ""] ?? photos[unique[0] ?? ""] ?? null;
  const headRight =
    photos[item.featured[1] ?? ""] ??
    photos[unique[1] ?? ""] ??
    headLeft;

  return (
    <article className="debrief-page">
      <header className="debrief-block">
        <Ghosts left={headLeft} right={headRight} />
        <div className="debrief-block-inner debrief-head">
          <p className="debrief-kicker">
            <Link href="/debrief">Debrief</Link>
            {" · "}
            {item.monthLabel} · {formatLongDate(item.date)}
          </p>
          <h1>{item.title}</h1>
          {item.excerpt ? <p className="debrief-lede">{item.excerpt}</p> : null}
          <DebriefPhotoStrip aliases={unique} photos={photos} />
        </div>
      </header>
      {item.facts ? (
        <FactsBody facts={item.facts} photos={photos} teamPhotos={teamPhotos} />
      ) : (
        <ProseBody item={item} photos={photos} />
      )}
    </article>
  );
}
