"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DebriefArticle, DebriefFacts } from "@/lib/debrief/types";

interface RaceOpt {
  id: string;
  date: string;
  monthLabel: string;
  roundNumber: number;
}

interface Row {
  id: string;
  race_id: string;
  status: string;
  title: string;
  generated_by: string;
  updated_at: string;
}

function Editor() {
  const search = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [races, setRaces] = useState<RaceOpt[]>([]);
  const [llm, setLlm] = useState(false);
  const [raceId, setRaceId] = useState(search.get("race") ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [article, setArticle] = useState<DebriefArticle | null>(null);
  const [facts, setFacts] = useState<DebriefFacts | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function loadRows() {
    const { data, error } = await supabase
      .from("debriefs")
      .select("id, race_id, status, title, generated_by, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      setMsg({
        kind: "err",
        text: /debriefs/i.test(error.message)
          ? "Falta correr 0010_debriefs.sql en el SQL Editor de Supabase."
          : error.message,
      });
      return;
    }
    setRows((data as Row[]) ?? []);
  }

  async function loadExisting(id: string) {
    const { data } = await supabase
      .from("debriefs")
      .select("id, status, body, facts, generated_by")
      .eq("race_id", id)
      .maybeSingle();
    if (!data) {
      setDraftId(null);
      setArticle(null);
      setFacts(null);
      setStatus("draft");
      setSource("");
      return;
    }
    setDraftId(data.id);
    setArticle(data.body as DebriefArticle);
    setFacts((data.facts as DebriefFacts) ?? null);
    setStatus(data.status);
    setSource(data.generated_by);
  }

  useEffect(() => {
    fetch("/api/admin/debrief")
      .then((r) => r.json())
      .then((d) => {
        setRaces(d.races ?? []);
        setLlm(Boolean(d.llm));
        setRaceId((cur) => cur || d.races?.[0]?.id || "");
      })
      .catch(() => undefined);
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (raceId) loadExisting(raceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  async function generate() {
    if (!raceId) return;
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDraftId(d.id);
      setArticle(d.article);
      setFacts(d.facts);
      setStatus(d.status);
      setSource(d.source);
      setMsg({
        kind: "ok",
        text:
          d.source === "llm"
            ? "Debrief generado con LLM (borrador)."
            : "Debrief generado con plantilla (borrador).",
      });
      await loadRows();
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  async function save(nextStatus?: "draft" | "published") {
    if (!draftId || !article) return;
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/debrief", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId,
          article,
          status: nextStatus ?? status,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setStatus(d.status);
      setMsg({
        kind: "ok",
        text: d.status === "published" ? "Publicado en /debrief." : "Borrador guardado.",
      });
      await loadRows();
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  function updateSection(i: number, field: "heading" | "paragraphs", value: string) {
    if (!article) return;
    const sections = article.sections.map((s, idx) => {
      if (idx !== i) return s;
      if (field === "heading") return { ...s, heading: value };
      return { ...s, paragraphs: value.split("\n").filter(Boolean) };
    });
    setArticle({ ...article, sections });
  }

  const race = races.find((r) => r.id === raceId);
  const winnerLine = facts
    ? [facts.F1.winner?.alias, facts.F2.winner?.alias].filter(Boolean).join(" / ")
    : "";

  return (
    <div>
      <div className="admin-card">
        <h2>Debrief de la fecha</h2>
        <p style={{ color: "var(--gray)", marginBottom: 16 }}>
          Artículo con los hechos de la carrera (quali vs carrera, campeonato,
          VR, forma). {llm ? "Hay OPENAI_API_KEY: se usa el LLM." : "Sin API key: plantilla en español."} Revisá y publicá.
        </p>
        {msg && <div className={`admin-msg ${msg.kind}`}>{msg.text}</div>}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div className="admin-field" style={{ minWidth: 240, marginBottom: 0 }}>
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
          <button className="admin-btn" disabled={loading || !raceId} onClick={generate}>
            {loading ? "Generando…" : "Generar / regenerar"}
          </button>
        </div>
      </div>

      {article && (
        <div className="admin-card">
          <h2>
            {status === "published" ? "Publicado" : "Borrador"}{" "}
            {source && (
              <span style={{ color: "var(--gray)", fontSize: "0.8rem" }}>({source})</span>
            )}
          </h2>
          {winnerLine && (
            <p style={{ color: "var(--gold)", marginBottom: 12 }}>Ganadores: {winnerLine}</p>
          )}
          <div className="admin-field">
            <label>Título</label>
            <input
              className="admin-input"
              value={article.title}
              onChange={(e) => setArticle({ ...article, title: e.target.value })}
            />
          </div>
          <div className="admin-field">
            <label>Bajada</label>
            <textarea
              className="admin-input"
              rows={3}
              value={article.excerpt}
              onChange={(e) => setArticle({ ...article, excerpt: e.target.value })}
            />
          </div>
          {article.sections.map((s, i) => (
            <div key={i} className="admin-field">
              <label>Sección {i + 1}</label>
              <input
                className="admin-input"
                value={s.heading}
                onChange={(e) => updateSection(i, "heading", e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <textarea
                className="admin-input"
                rows={5}
                value={s.paragraphs.join("\n")}
                onChange={(e) => updateSection(i, "paragraphs", e.target.value)}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="admin-btn secondary" disabled={loading} onClick={() => save("draft")}>
              Guardar borrador
            </button>
            <button className="admin-btn" disabled={loading} onClick={() => save("published")}>
              Publicar
            </button>
            {status === "published" && race && (
              <a
                className="admin-btn secondary"
                href={`/debrief/${race.date}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver en el sitio
              </a>
            )}
            {status === "published" && (
              <button className="admin-btn danger" disabled={loading} onClick={() => save("draft")}>
                Despublicar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="admin-card">
        <h2>Anteriores</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Estado</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.status}</td>
                <td>{r.generated_by}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: "var(--gray)" }}>
                  Todavía no hay debriefs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminDebriefPage() {
  return (
    <Suspense fallback={<div className="admin-card">Cargando…</div>}>
      <Editor />
    </Suspense>
  );
}
