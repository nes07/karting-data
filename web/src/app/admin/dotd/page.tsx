"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = "F1" | "F2";

interface DriverOpt {
  id: string;
  alias: string;
}
interface RaceRow {
  id: string;
  date: string;
  month_label: string;
}
interface PollRow {
  id: string;
  race_id: string;
  category: Category;
  closes_at: string;
}
interface CandidateRow {
  id: string;
  poll_id: string;
  driver_id: string;
  reason: string | null;
}
interface VoteRow {
  poll_id: string;
  candidate_id: string;
}
interface CandidateDraft {
  driverId: string;
  reason: string;
}

/** Default deadline: the Thursday after `dateStr`, 23:59 local time. */
function nextThursday(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const days = (4 - d.getDay() + 7) % 7 || 7; // 4 = Thursday
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DotdVotingAdminPage() {
  const supabase = useMemo(() => createClient(), []);

  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);

  const [raceId, setRaceId] = useState("");
  const [category, setCategory] = useState<Category>("F1");
  const [closesAt, setClosesAt] = useState("");
  const [drafts, setDrafts] = useState<CandidateDraft[]>([
    { driverId: "", reason: "" },
    { driverId: "", reason: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const aliasById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d.alias])),
    [drivers]
  );
  const raceById = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);

  const loadAll = useCallback(async () => {
    const [d, r, p, c, v] = await Promise.all([
      supabase.from("drivers").select("id, alias").eq("active", true).order("alias"),
      supabase.from("races").select("id, date, month_label").order("date", { ascending: false }),
      supabase.from("dotd_polls").select("*").order("closes_at", { ascending: false }),
      supabase.from("dotd_candidates").select("*"),
      supabase.from("dotd_votes").select("poll_id, candidate_id"),
    ]);
    setDrivers(d.data ?? []);
    setRaces(r.data ?? []);
    setPolls((p.data as PollRow[]) ?? []);
    setCandidates((c.data as CandidateRow[]) ?? []);
    setVotes((v.data as VoteRow[]) ?? []);
    if (p.error) setMsg({ kind: "err", text: `${p.error.message} — ¿corriste 0004_dotd_voting.sql?` });
  }, [supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function pickRace(id: string) {
    setRaceId(id);
    const race = raceById.get(id);
    if (race) setClosesAt(nextThursday(race.date));
  }

  async function createPoll() {
    setMsg(null);
    const clean = drafts.filter((c) => c.driverId);
    if (!raceId || !closesAt || clean.length < 2) {
      setMsg({ kind: "err", text: "Elige carrera, cierre y al menos 2 nominados." });
      return;
    }
    setLoading(true);
    try {
      const { data: poll, error } = await supabase
        .from("dotd_polls")
        .insert({
          race_id: raceId,
          category,
          closes_at: new Date(closesAt).toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const { error: cErr } = await supabase.from("dotd_candidates").insert(
        clean.map((c) => ({
          poll_id: poll.id,
          driver_id: c.driverId,
          reason: c.reason.trim() || null,
        }))
      );
      if (cErr) throw new Error(cErr.message);
      setMsg({ kind: "ok", text: "Votación creada. Ya está visible en /votar." });
      setRaceId("");
      setDrafts([{ driverId: "", reason: "" }, { driverId: "", reason: "" }]);
      await loadAll();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function closeNow(poll: PollRow) {
    await supabase
      .from("dotd_polls")
      .update({ closes_at: new Date().toISOString() })
      .eq("id", poll.id);
    await loadAll();
  }

  async function removePoll(poll: PollRow) {
    if (!window.confirm("¿Eliminar esta votación con todos sus votos?")) return;
    await supabase.from("dotd_polls").delete().eq("id", poll.id);
    await loadAll();
  }

  async function applyWinner(poll: PollRow) {
    setMsg(null);
    const cands = candidates.filter((c) => c.poll_id === poll.id);
    const counts = new Map<string, number>();
    for (const v of votes.filter((v) => v.poll_id === poll.id)) {
      counts.set(v.candidate_id, (counts.get(v.candidate_id) ?? 0) + 1);
    }
    const sorted = [...cands].sort(
      (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
    );
    const winner = sorted[0];
    if (!winner || (counts.get(winner.id) ?? 0) === 0) {
      setMsg({ kind: "err", text: "Aún no hay votos en esta votación." });
      return;
    }
    const top = counts.get(winner.id) ?? 0;
    const tied = sorted.filter((c) => (counts.get(c.id) ?? 0) === top);
    if (tied.length > 1) {
      setMsg({
        kind: "err",
        text: `Empate entre ${tied.map((c) => aliasById.get(c.driver_id)).join(" y ")} — resuélvelo en Carreras → Editar.`,
      });
      return;
    }
    const { error } = await supabase.from("dotd").upsert(
      {
        race_id: poll.race_id,
        driver_id: winner.driver_id,
        category: poll.category,
        reason: winner.reason,
      },
      { onConflict: "race_id,category" }
    );
    if (error) {
      setMsg({ kind: "err", text: error.message });
      return;
    }
    setMsg({
      kind: "ok",
      text: `DOTD aplicado: ${aliasById.get(winner.driver_id)} (${top} votos). Los standings ya lo incluyen.`,
    });
  }

  return (
    <div>
      {msg && <div className={`admin-msg ${msg.kind}`}>{msg.text}</div>}

      <div className="admin-card">
        <h2>🗳 Crear votación DOTD</h2>
        <p style={{ color: "var(--gray)", fontSize: "0.85rem", marginBottom: 12 }}>
          Publica la carrera primero (sin DOTD). Después crea la votación: la
          gente vota en <strong>/votar</strong> y al cierre aplicas el ganador.
        </p>
        <div className="admin-grid">
          <div className="admin-field">
            <label>Carrera</label>
            <select className="admin-select" value={raceId} onChange={(e) => pickRace(e.target.value)}>
              <option value="">— Selecciona —</option>
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.month_label} — {r.date}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label>Categoría</label>
            <select
              className="admin-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              <option value="F1">F1 — New Era</option>
              <option value="F2">F2 — Era Antigua</option>
            </select>
          </div>
          <div className="admin-field">
            <label>Cierra el (por defecto: jueves siguiente)</label>
            <input
              type="datetime-local"
              className="admin-input"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>
        </div>

        <h2 style={{ marginTop: 16 }}>Nominados</h2>
        {drafts.map((c, i) => (
          <div key={i} className="admin-grid" style={{ marginBottom: 8 }}>
            <div className="admin-field">
              <label>Piloto</label>
              <select
                className="admin-select"
                value={c.driverId}
                onChange={(e) =>
                  setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, driverId: e.target.value } : x)))
                }
              >
                <option value="">— Piloto —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.alias}</option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label>Razón de la nominación</label>
              <input
                className="admin-input"
                value={c.reason}
                placeholder="Remontada de P12 a P4…"
                onChange={(e) =>
                  setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))
                }
              />
            </div>
            <div className="admin-field" style={{ justifyContent: "flex-end" }}>
              <label>&nbsp;</label>
              <button
                className="admin-btn danger"
                onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="admin-btn secondary"
            onClick={() => setDrafts((ds) => [...ds, { driverId: "", reason: "" }])}
          >
            + Agregar nominado
          </button>
          <button className="admin-btn" disabled={loading} onClick={createPoll}>
            {loading ? "Creando…" : "Crear votación"}
          </button>
        </div>
      </div>

      <div className="admin-card">
        <h2>Votaciones</h2>
        {polls.length === 0 && (
          <p style={{ color: "var(--gray)" }}>No hay votaciones creadas.</p>
        )}
        {polls.map((p) => {
          const race = raceById.get(p.race_id);
          const open = new Date(p.closes_at) > new Date();
          const cands = candidates.filter((c) => c.poll_id === p.id);
          const pollVotes = votes.filter((v) => v.poll_id === p.id);
          const counts = new Map<string, number>();
          for (const v of pollVotes) {
            counts.set(v.candidate_id, (counts.get(v.candidate_id) ?? 0) + 1);
          }
          return (
            <div
              key={p.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <strong>
                  {race ? `${race.month_label} — ${race.date}` : "?"} ·{" "}
                  {p.category === "F1" ? "F1 Moderna" : "F1 Clásica"}
                </strong>
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "2px 10px",
                    borderRadius: 6,
                    background: open ? "rgba(34,197,94,0.15)" : "rgba(232,25,44,0.15)",
                    color: open ? "#4ade80" : "#f87171",
                  }}
                >
                  {open
                    ? `Abierta hasta ${new Date(p.closes_at).toLocaleString("es-CL")}`
                    : "Cerrada"}
                </span>
                <span style={{ color: "var(--gray)", fontSize: "0.8rem" }}>
                  {pollVotes.length} votos
                </span>
              </div>
              <table className="admin-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr><th>Nominado</th><th>Razón</th><th>Votos</th></tr>
                </thead>
                <tbody>
                  {cands
                    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
                    .map((c) => (
                      <tr key={c.id}>
                        <td><strong>{aliasById.get(c.driver_id) ?? "?"}</strong></td>
                        <td style={{ color: "var(--gray)" }}>{c.reason ?? "—"}</td>
                        <td>{counts.get(c.id) ?? 0}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {open && (
                  <button className="admin-btn secondary" onClick={() => closeNow(p)}>
                    Cerrar ahora
                  </button>
                )}
                <button className="admin-btn" onClick={() => applyWinner(p)}>
                  🏆 Aplicar ganador al DOTD
                </button>
                <button className="admin-btn danger" onClick={() => removePoll(p)}>
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
