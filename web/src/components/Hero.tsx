"use client";

import { useEffect, useState } from "react";
import { formatShortDate } from "./format";
import { parseRaceStart } from "@/lib/race-datetime";

interface Props {
  raceDates: Array<{ monthLabel: string; date: string; startTime: string }>;
  compact?: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function Hero({ raceDates, compact }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const next = raceDates
    .map((r) => ({
      ...r,
      parsed: parseRaceStart(r.date, r.startTime),
    }))
    .filter((r) => now && r.parsed > now)
    .sort((a, b) => a.parsed.getTime() - b.parsed.getTime())[0];

  const diff = next && now ? next.parsed.getTime() - now.getTime() : 0;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <section id="hero" className={`hero${compact ? " hero-compact" : ""}`}>
      <div className="hero-bg"></div>
      <div className="hero-grid-lines"></div>

      <p className="hero-eyebrow">Mundial de Karting 2026</p>
      <h1 className="hero-title">
        GKD
        <br />
        <span className="line2">Championship</span>
      </h1>
      <p className="hero-sub">F1 Moderna · F1 Clásica · Todos contra todos</p>

      <div id="next-race-info">
        {now &&
          (next ? (
            <>
              <div className="next-race-label">Próxima carrera</div>
              <div className="next-race-date">
                {next.monthLabel} — {formatShortDate(next.date)}
              </div>
            </>
          ) : (
            "Temporada completada"
          ))}
      </div>

      {now && next && (
        <div className="countdown">
          {(
            [
              [d, "Días"],
              [h, "Horas"],
              [m, "Min"],
              [s, "Seg"],
            ] as const
          ).map(([val, label], i) => (
            <span key={label} style={{ display: "contents" }}>
              {i > 0 && <div className="countdown-sep">:</div>}
              <div className="countdown-block">
                <span className="countdown-num">{pad(val)}</span>
                <span className="countdown-label">{label}</span>
              </div>
            </span>
          ))}
        </div>
      )}

      {!compact && (
        <div className="hero-scroll">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
          Scroll
        </div>
      )}
    </section>
  );
}
