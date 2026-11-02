"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONSTRUCTOR_COLORS } from "@/lib/constants";
import { formatPositionsGained } from "@/lib/positions-gained";
import type { ResumenPayload } from "@/lib/resumen/payload";
import {
  buildTimeline,
  fadeOpacity,
  sceneAt,
  sceneProgress,
  type Scene,
} from "@/lib/resumen/timeline";
import type { ResultFact, StandingFact } from "@/lib/debrief/types";

const W = 1080;
const H = 1350;
const C = {
  bg: "#0a0a0e",
  card: "#12141a",
  red: "#E8192C",
  gold: "#C9A84C",
  white: "#f0f0f0",
  gray: "#8a8f9e",
  grayLight: "#c0c4d0",
};

const CAT: Record<string, string> = {
  F1: "F1 MODERNA",
  F2: "F1 CLÁSICA",
};

function teamColor(esc: string): string {
  return CONSTRUCTOR_COLORS[esc]?.bg ?? "#333";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fmtTime(t: number | null): string {
  return t == null ? "—" : t.toFixed(3);
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null | undefined,
  alias: string,
  x: number,
  y: number,
  size: number,
  ring: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    const s = Math.max(size / img.width, size / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#1a1d26";
    ctx.fill();
    ctx.fillStyle = C.grayLight;
    ctx.font = `700 ${Math.round(size * 0.32)}px Microgramma, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(alias), x + size / 2, y + size / 2 + 4);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 5;
  ctx.stroke();
}

function header(
  ctx: CanvasRenderingContext2D,
  kicker: string,
  title: string,
  alpha: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = C.red;
  ctx.font = "700 22px Microgramma, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(kicker, 64, 86);
  ctx.fillStyle = C.white;
  ctx.font = "700 48px Microgramma, sans-serif";
  ctx.fillText(title, 64, 148);
  ctx.fillStyle = C.gold;
  ctx.fillRect(64, 168, 180, 4);
  ctx.restore();
}

function footer(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = C.gray;
  ctx.font = "600 20px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("GKD CHAMPIONSHIP", 64, H - 48);
  ctx.textAlign = "right";
  ctx.fillStyle = C.red;
  ctx.fillText("#NEWERA2026", W - 64, H - 48);
  ctx.restore();
}

function resultValue(r: ResultFact): string {
  const g = formatPositionsGained(r.gained);
  return r.dnf ? "DNF" : `${fmtTime(r.time)}  ${g}`;
}

function drawRows(
  ctx: CanvasRenderingContext2D,
  rows: Array<{
    rank: number;
    alias: string;
    escuderia: string;
    value: string;
    photo?: string | null;
  }>,
  photos: Map<string, HTMLImageElement>,
  areaY: number,
  areaH: number,
  progress: number,
  alpha: number
) {
  const rowH = 72;
  const total = rows.length * rowH;
  const maxScroll = Math.max(0, total - areaH + 8);
  const scroll = maxScroll * (progress * progress * (3 - 2 * progress));
  ctx.save();
  ctx.beginPath();
  ctx.rect(48, areaY, W - 96, areaH);
  ctx.clip();
  ctx.globalAlpha = alpha;
  rows.forEach((r, i) => {
    const y = areaY + i * rowH - scroll;
    if (y + rowH < areaY - 8 || y > areaY + areaH + 8) return;
    roundRect(ctx, 56, y + 6, W - 112, rowH - 12, 10);
    ctx.fillStyle =
      r.rank === 1
        ? "rgba(201,168,76,0.14)"
        : r.rank <= 3
          ? "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.fillStyle = teamColor(r.escuderia);
    ctx.fillRect(56, y + 6, 8, rowH - 12);
    const ring =
      r.rank === 1 ? C.gold : r.rank === 2 ? "#c0c0c0" : r.rank === 3 ? "#cd7f32" : "#333";
    drawPhoto(ctx, photos.get(r.alias), r.alias, 78, y + 14, 44, ring);
    ctx.fillStyle = C.gold;
    ctx.font = "700 22px Microgramma, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(r.rank).padStart(2, "0"), 136, y + 46);
    ctx.fillStyle = C.white;
    ctx.font = "700 26px Microgramma, sans-serif";
    ctx.fillText(r.alias, 196, y + 38);
    ctx.fillStyle = C.gray;
    ctx.font = "500 16px Inter, sans-serif";
    ctx.fillText(r.escuderia, 196, y + 58);
    ctx.fillStyle = C.white;
    ctx.textAlign = "right";
    ctx.font = "700 22px Microgramma, sans-serif";
    ctx.fillText(r.value, W - 80, y + 48);
  });
  ctx.restore();
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  payload: ResumenPayload,
  photos: Map<string, HTMLImageElement>,
  scene: Scene,
  t: number
) {
  const p = sceneProgress(scene, t);
  const a = fadeOpacity(p);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.red;
  ctx.fillRect(0, 0, 8, H);

  const cat = CAT[payload.category] ?? payload.category;
  const round = `ROUND ${payload.roundNumber}`;

  if (scene.id === "intro") {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.red;
    ctx.font = "700 28px Microgramma, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GKD CHAMPIONSHIP", W / 2, 430);
    ctx.fillStyle = C.white;
    ctx.font = "700 96px Microgramma, sans-serif";
    ctx.fillText(round, W / 2, 560);
    ctx.fillStyle = C.gold;
    ctx.font = "700 36px Microgramma, sans-serif";
    ctx.fillText(cat, W / 2, 640);
    ctx.fillStyle = C.grayLight;
    ctx.font = "500 28px Inter, sans-serif";
    ctx.fillText(`${payload.monthLabel.toUpperCase()}  ·  ${shortDate(payload.date)}`, W / 2, 720);
    ctx.restore();
    footer(ctx, a);
    return;
  }

  if (scene.id === "winner" && payload.winner) {
    const w = payload.winner;
    header(ctx, round, "GANADOR", a);
    ctx.save();
    ctx.globalAlpha = a;
    drawPhoto(ctx, photos.get(w.alias), w.alias, W / 2 - 160, 240, 320, C.gold);
    ctx.fillStyle = C.white;
    ctx.textAlign = "center";
    ctx.font = "700 64px Microgramma, sans-serif";
    ctx.fillText(w.alias, W / 2, 640);
    ctx.fillStyle = C.gold;
    ctx.font = "700 28px Microgramma, sans-serif";
    ctx.fillText(w.escuderia.toUpperCase(), W / 2, 700);
    ctx.fillStyle = C.grayLight;
    ctx.font = "500 26px Inter, sans-serif";
    const g = w.gained != null ? `  ·  ${formatPositionsGained(w.gained)} POS` : "";
    ctx.fillText(`${fmtTime(w.time)}${g}`, W / 2, 760);
    ctx.restore();
    footer(ctx, a);
    return;
  }

  if (scene.id === "podium") {
    header(ctx, round, "PODIO", a);
    const slots: Array<{ r: ResultFact | undefined; x: number; y: number; size: number; ring: string }> = [
      { r: payload.podium[1], x: 90, y: 520, size: 200, ring: "#c0c0c0" },
      { r: payload.podium[0], x: 400, y: 360, size: 280, ring: C.gold },
      { r: payload.podium[2], x: 790, y: 560, size: 180, ring: "#cd7f32" },
    ];
    ctx.save();
    ctx.globalAlpha = a;
    for (const s of slots) {
      if (!s.r) continue;
      roundRect(ctx, s.x - 16, s.y - 16, s.size + 32, s.size + 160, 16);
      ctx.fillStyle = C.card;
      ctx.fill();
      drawPhoto(ctx, photos.get(s.r.alias), s.r.alias, s.x, s.y, s.size, s.ring);
      ctx.fillStyle = C.white;
      ctx.textAlign = "center";
      ctx.font = `700 ${s.size > 220 ? 32 : 24}px Microgramma, sans-serif`;
      ctx.fillText(s.r.alias, s.x + s.size / 2, s.y + s.size + 48);
      ctx.fillStyle = C.gray;
      ctx.font = "500 16px Inter, sans-serif";
      ctx.fillText(s.r.escuderia, s.x + s.size / 2, s.y + s.size + 78);
      ctx.fillStyle = s.ring;
      ctx.font = "700 22px Microgramma, sans-serif";
      ctx.fillText(`P${s.r.pos}`, s.x + s.size / 2, s.y + s.size + 112);
    }
    ctx.restore();
    footer(ctx, a);
    return;
  }

  if (scene.id === "results") {
    header(ctx, round, "RESULTADOS", a);
    drawRows(
      ctx,
      payload.results.map((r) => ({
        rank: r.pos,
        alias: r.alias,
        escuderia: r.escuderia,
        value: resultValue(r),
      })),
      photos,
      200,
      H - 280,
      p,
      a
    );
    footer(ctx, a);
    return;
  }

  if (scene.id === "driversTitle" || scene.id === "teamsTitle") {
    const title = scene.id === "driversTitle" ? "PILOTOS" : "CONSTRUCTORES";
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.red;
    ctx.font = "700 24px Microgramma, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CAMPEONATO", W / 2, 560);
    ctx.fillStyle = C.white;
    ctx.font = "700 72px Microgramma, sans-serif";
    ctx.fillText(title, W / 2, 660);
    ctx.fillStyle = C.gold;
    ctx.font = "700 28px Microgramma, sans-serif";
    ctx.fillText(cat, W / 2, 730);
    ctx.restore();
    footer(ctx, a);
    return;
  }

  if (scene.id === "drivers" || scene.id === "teams") {
    const rows: StandingFact[] = scene.id === "drivers" ? payload.drivers : payload.teams;
    header(
      ctx,
      "CAMPEONATO",
      scene.id === "drivers" ? "PILOTOS" : "CONSTRUCTORES",
      a
    );
    drawRows(
      ctx,
      rows.map((r) => ({
        rank: r.rank,
        alias: r.alias,
        escuderia: r.escuderia,
        value: `${r.pts} PTS`,
      })),
      photos,
      200,
      H - 280,
      p,
      a
    );
    footer(ctx, a);
    return;
  }

  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = C.white;
  ctx.textAlign = "center";
  ctx.font = "700 80px Microgramma, sans-serif";
  ctx.fillText("GKD", W / 2, 600);
  ctx.fillStyle = C.red;
  ctx.font = "700 28px Microgramma, sans-serif";
  ctx.fillText("NEW ERA 2026", W / 2, 670);
  ctx.restore();
  footer(ctx, a);
}

function pickMime(): string {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
}

export function ResumenStudio({
  initialRaceId,
}: {
  initialRaceId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const [races, setRaces] = useState<
    Array<{ id: string; date: string; monthLabel: string; roundNumber: number }>
  >([]);
  const [raceId, setRaceId] = useState(initialRaceId ?? "");
  const [cat, setCat] = useState<"F1" | "F2">("F1");
  const [payload, setPayload] = useState<ResumenPayload | null>(null);
  const [narration, setNarration] = useState("");
  const [tts, setTts] = useState(false);
  const [photos, setPhotos] = useState<Map<string, HTMLImageElement>>(new Map());
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const playGen = useRef(0);

  const timeline = useMemo(
    () =>
      payload
        ? buildTimeline(
            payload.results.length,
            payload.drivers.length,
            payload.teams.length
          )
        : null,
    [payload]
  );

  useEffect(() => {
    fetch("/api/admin/resumen")
      .then((r) => r.json())
      .then((d) => {
        setRaces(d.races ?? []);
        setTts(Boolean(d.tts));
        if (!raceId && d.races?.[0]) setRaceId(d.races[0].id);
      })
      .catch(() => setMsg("No se pudieron cargar las fechas."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (id: string, c: "F1" | "F2") => {
    setMsg(null);
    const r = await fetch(`/api/admin/resumen?raceId=${id}&cat=${c}`);
    const d = await r.json();
    if (!r.ok) {
      setMsg(d.error ?? "Error al cargar");
      return;
    }
    setPayload(d.payload);
    setNarration(d.narration ?? "");
    const p = d.payload as ResumenPayload;
    const map = new Map<string, HTMLImageElement>();
    await Promise.all(
      [...p.results, ...p.drivers, ...p.teams].map(async (row) => {
        if (!row.photo || map.has(row.alias)) return;
        const img = await loadImage(row.photo);
        if (img) map.set(row.alias, img);
      })
    );
    setPhotos(map);
    setBlobUrl(null);
  }, []);

  useEffect(() => {
    if (raceId) load(raceId, cat);
  }, [raceId, cat, load]);

  const drawAt = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !payload || !timeline) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const scene = sceneAt(timeline.scenes, t);
      if (!scene) return;
      drawScene(ctx, payload, photos, scene, t);
    },
    [payload, photos, timeline]
  );

  useEffect(() => {
    void document.fonts.ready.then(() => drawAt(0.01));
  }, [drawAt]);

  async function runClock(duration: number, onStart?: () => void) {
    const gen = ++playGen.current;
    setPlaying(true);
    onStart?.();
    const origin = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        if (playGen.current !== gen) {
          resolve();
          return;
        }
        const t = (now - origin) / 1000;
        drawAt(Math.min(t, duration));
        if (t >= duration) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    if (playGen.current === gen) setPlaying(false);
  }

  async function play() {
    if (!timeline) return;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    await runClock(timeline.duration, () => {
      audioRef.current?.play().catch(() => undefined);
    });
    audioRef.current?.pause();
  }

  function stop() {
    playGen.current += 1;
    setPlaying(false);
    recRef.current?.stop();
    audioRef.current?.pause();
  }

  async function record() {
    const canvas = canvasRef.current;
    if (!canvas || !timeline) return;
    setMsg(null);
    setBlobUrl(null);
    const vStream = canvas.captureStream(30);
    let stream: MediaStream = vStream;
    const audioEl = audioRef.current;
    let audioCtx: AudioContext | null = null;
    if (audioEl && audioEl.src) {
      audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      const src = audioCtx.createMediaElementSource(audioEl);
      src.connect(dest);
      src.connect(audioCtx.destination);
      stream = new MediaStream([
        ...vStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
    }
    const rec = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: 8_000_000 });
    recRef.current = rec;
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType }));
    });
    setRecording(true);
    rec.start(200);
    if (audioEl) {
      audioEl.currentTime = 0;
      await audioEl.play().catch(() => undefined);
    }
    await runClock(timeline.duration);
    if (rec.state !== "inactive") rec.stop();
    audioEl?.pause();
    await audioCtx?.close().catch(() => undefined);
    setRecording(false);
    const blob = await done;
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    setMsg(`Listo (${Math.round(blob.size / 1024)} KB). Descarga el WebM.`);
  }

  async function makeVoice() {
    if (!narration) return;
    setMsg("Generando voz…");
    const r = await fetch("/api/admin/resumen/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: narration }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({ error: "TTS falló" }));
      setMsg(d.error ?? "TTS falló");
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setMsg("Voz lista. Dale a Reproducir o Grabar.");
  }

  function onAudioFile(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audioRef.current = audio;
    setMsg(`Audio: ${file.name}`);
  }

  const filename = payload
    ? `gkd-resumen-r${payload.roundNumber}-${payload.category.toLowerCase()}.webm`
    : "gkd-resumen.webm";

  return (
    <div>
      <div className="admin-card">
        <h2>Resumen en video</h2>
        <p style={{ color: "var(--gray)", marginBottom: 16 }}>
          Round → ganador → podio → resultados de la fecha → campeonato de
          pilotos → constructores. 1080×1350. La música de F1 no se incluye:
          subí un audio o generá la voz.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="admin-field" style={{ minWidth: 220 }}>
            <label>Fecha</label>
            <select
              className="admin-select"
              value={raceId}
              onChange={(e) => setRaceId(e.target.value)}
            >
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  Round {r.roundNumber} — {r.monthLabel} ({r.date})
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label>Categoría</label>
            <select
              className="admin-select"
              value={cat}
              onChange={(e) => setCat(e.target.value as "F1" | "F2")}
            >
              <option value="F1">F1 Moderna</option>
              <option value="F2">F1 Clásica</option>
            </select>
          </div>
        </div>
        {msg && <div className="admin-msg ok">{msg}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button className="admin-btn" disabled={!payload || playing} onClick={play}>
            Reproducir
          </button>
          <button className="admin-btn secondary" disabled={!playing && !recording} onClick={stop}>
            Stop
          </button>
          <button className="admin-btn" disabled={!payload || playing} onClick={record}>
            {recording ? "Grabando…" : "Grabar WebM"}
          </button>
          <button className="admin-btn secondary" disabled={!tts || !narration} onClick={makeVoice}>
            Generar voz
          </button>
          <label className="admin-btn secondary" style={{ cursor: "pointer" }}>
            Subir audio
            <input
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => onAudioFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {blobUrl && (
            <a className="admin-btn" href={blobUrl} download={filename}>
              Descargar
            </a>
          )}
        </div>
        {!tts && (
          <p style={{ color: "var(--gray)", fontSize: "0.8rem", marginTop: 10 }}>
            Sin OPENAI_API_KEY no hay voz TTS. Podés subir un mp3 (o agregar
            música en Instagram).
          </p>
        )}
      </div>
      <div className="admin-card" style={{ display: "flex", justifyContent: "center" }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            width: "min(100%, 420px)",
            height: "auto",
            background: "#0a0a0e",
            borderRadius: 12,
          }}
        />
      </div>
      {narration && (
        <div className="admin-card">
          <h2>Libreto</h2>
          <p style={{ color: "var(--gray-light)", fontSize: "0.9rem" }}>{narration}</p>
        </div>
      )}
    </div>
  );
}
