"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { VueltaRapidaRow } from "@/lib/data";
import { DriverStandingRow } from "@/lib/scoring/types";
import { PodiumDriver, PodiumVueltaRapida } from "./standings-widgets";

const AUTOPLAY_MS = 5000;

interface Slide {
  id: string;
  theme: "f1" | "f2" | "vr";
  title: React.ReactNode;
  href: string;
}

const SLIDES: Slide[] = [
  {
    id: "f1",
    theme: "f1",
    title: (
      <>
        F1 <span className="accent">Drivers</span>
      </>
    ),
    href: "/standings/pilotos",
  },
  {
    id: "f2",
    theme: "f2",
    title: (
      <>
        F2 <span className="accent">Drivers</span>
      </>
    ),
    href: "/standings/pilotos?cat=f2",
  },
  {
    id: "vr",
    theme: "vr",
    title: (
      <>
        Vuelta <span className="accent">Rápida</span>
      </>
    ),
    href: "/vuelta-rapida",
  },
];

interface Props {
  driversF1: DriverStandingRow[];
  driversF2: DriverStandingRow[];
  vueltaRapida: VueltaRapidaRow[];
  photos: Record<string, string>;
}

export function PodiumCarousel({
  driversF1,
  driversF2,
  vueltaRapida,
  photos,
}: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  const go = useCallback((next: number) => {
    setIndex((next + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused]);

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX;
    setPaused(true);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(delta) > 40) go(index + (delta < 0 ? 1 : -1));
    touchStart.current = null;
    setTimeout(() => setPaused(false), 3000);
  }

  function renderPodium(i: number) {
    if (i === 0) return <PodiumDriver rows={driversF1} photos={photos} />;
    if (i === 1) return <PodiumDriver rows={driversF2} photos={photos} />;
    return <PodiumVueltaRapida rows={vueltaRapida} photos={photos} />;
  }

  return (
    <div
      className="podium-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="podium-carousel-viewport">
        <div
          className="podium-carousel-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((slide, i) => (
            <div
              key={slide.id}
              className="podium-carousel-slide"
              data-theme={slide.theme}
              aria-hidden={i !== index}
            >
              <h2 className="podium-carousel-title">{slide.title}</h2>
              <div className="podium-carousel-body">{renderPodium(i)}</div>
              <Link href={slide.href} className="podium-carousel-cta">
                Ver detalle →
              </Link>
            </div>
          ))}
        </div>
      </div>
      <div className="podium-carousel-controls">
        <button
          type="button"
          className="podium-carousel-arrow"
          aria-label="Anterior"
          onClick={() => go(index - 1)}
        >
          ‹
        </button>
        <ul className="podium-carousel-dots" role="tablist">
          {SLIDES.map((slide, i) => (
            <li key={slide.id} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={slide.id}
                className={`podium-carousel-dot${i === index ? " active" : ""}`}
                onClick={() => setIndex(i)}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="podium-carousel-arrow"
          aria-label="Siguiente"
          onClick={() => go(index + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
