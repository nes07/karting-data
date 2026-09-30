"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** API path with query, without the format param, e.g. /api/share/standings?type=drivers&cat=F1 */
  endpoint: string;
  /** Base filename for the downloaded PNG (no extension). */
  filename: string;
  /** Share sheet title. */
  title?: string;
  /** Icon-only compact variant for table rows / cards. */
  compact?: boolean;
  label?: string;
}

type Status = "idle" | "loading" | "done" | "error";

const FORMATS = [
  { id: "story", label: "Story (9:16)" },
  { id: "post", label: "Post (4:5)" },
] as const;

export function ShareButton({
  endpoint,
  filename,
  title = "GKD Championship",
  compact = false,
  label = "Compartir",
}: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function share(format: "story" | "post") {
    setOpen(false);
    setStatus("loading");
    try {
      const sep = endpoint.includes("?") ? "&" : "?";
      const base = `${endpoint}${sep}format=${format}`;
      const first = await fetch(base);
      if (!first.ok) throw new Error(`Error ${first.status}`);
      const pageCount = Math.max(1, Number(first.headers.get("x-share-pages")) || 1);
      const blobs = [await first.blob()];

      // Multi-page posts (carousel): fetch the remaining pages too.
      for (let p = 2; p <= pageCount; p++) {
        const res = await fetch(`${base}&page=${p}`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        blobs.push(await res.blob());
      }

      const files = blobs.map(
        (blob, i) =>
          new File(
            [blob],
            pageCount > 1
              ? `${filename}-${format}-${i + 1}.png`
              : `${filename}-${format}.png`,
            { type: "image/png" }
          )
      );

      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files })
      ) {
        try {
          await navigator.share({ files, title });
          setStatus("done");
          setTimeout(() => setStatus("idle"), 2000);
          return;
        } catch (err) {
          // User dismissed the share sheet — not an error.
          if (err instanceof Error && err.name === "AbortError") {
            setStatus("idle");
            return;
          }
        }
      }

      for (const file of files) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div className={`share-wrap${compact ? " compact" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className={`share-btn${compact ? " compact" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={status === "loading"}
        onClick={() => setOpen((v) => !v)}
        title="Compartir como imagen"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
        </svg>
        {!compact && (
          <span>
            {status === "loading"
              ? "Generando…"
              : status === "done"
                ? "¡Listo!"
                : status === "error"
                  ? "Error"
                  : label}
          </span>
        )}
      </button>
      {open && (
        <div className="share-menu" role="menu">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="menuitem"
              className="share-menu-item"
              onClick={() => share(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
