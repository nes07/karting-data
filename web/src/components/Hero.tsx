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

const FEATURES = [
  {
    label: "Compite en cada carrera",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
  },
  {
    label: "Sigue los rankings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
        <path d="M7 13v4" />
        <path d="M12 9v8" />
        <path d="M17 5v12" />
      </svg>
    ),
  },
  {
    label: "Mejora tus tiempos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2" />
        <path d="M9 2h6" />
      </svg>
    ),
  },
] as const;

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

      <div className="hero-features">
        {FEATURES.map((f) => (
          <div key={f.label} className="hero-feature">
            <span className="hero-feature-icon">{f.icon}</span>
            <span>{f.label}</span>
          </div>
        ))}
      </div>

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

      {compact && (
        <a href="#rankings" className="hero-cta">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
          Sigue la acción
        </a>
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
