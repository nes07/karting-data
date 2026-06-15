"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PENALTY_POINTS, PenaltyLevel } from "@/lib/scoring/types";

type Category = "F1" | "F2";

interface DriverOpt { id: string; alias: string; }
interface RaceOpt   { id: string; date: string; month_label: string; }
interface PenaltyRow {
  id: string;
  race_id: string;
  driver_id: string;
  category: Category;
  level: PenaltyLevel;
  reason: string | null;
  created_at: string;
}

const LEVEL_LABELS: Record<PenaltyLevel, string> = {
  leve:      "Leve (−1)",
  media:     "Media (−2)",
  grave:     "Grave (−3)",
  gravisima: "Gravísima (−4)",
};

export default function PenaltiesAdminPage() {
  const supabase = useMemo(() => createClient(), []);

  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [races,   setRaces]   = useState<RaceOpt[]>([]);
  const [rows,    setRows]    = useState<PenaltyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [form, setForm] = useState<{
    raceId: string; category: Category; driverId: string; level: PenaltyLevel; reason: string;
  }>({ raceId: "", category: "F1", driverId: "", level: "leve", reason: "" });

  const aliasById  = useMemo(() => new Map(drivers.map((d) => [d.id, d.alias])), [drivers]);
  const raceById   = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);

  async function loadAll() {
    const [d, r, p] = await Promise.all([
      supabase.from("drivers").select("id, alias").eq("active", true).order("alias"),
      supabase.from("races").select("id, date, month_label").eq("is_official", true).order("date"),
      supabase.from("penalties").select("*").order("created_at", { ascending: false }),
    ]);
    setDrivers(d.data ?? []);
    setRaces(r.data ?? []);
    setRows(p.data ?? []);
  }

  useEffect(() => { loadAll(); }, [supabase]);

  async function add() {
    if (!form.raceId || !form.driverId) {
      setMsg({ kind: "err", text: "Selecciona carrera y piloto." }); return;
    }
    setLoading(true); setMsg(null);
    const { error } = await supabase.from("penalties").insert({
      race_id:   form.raceId,
      driver_id: form.driverId,
      category:  form.category,
      level:     form.level,
      reason:    form.reason || null,
    });
    if (error) { setMsg({ kind: "err", text: error.message }); }
    else {
      setMsg({ kind: "ok", text: "Penalización aplicada." });
      setForm((f) => ({ ...f, driverId: "", reason: "" }));
      await loadAll();
    }
    setLoading(false);
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta penalización?")) return;
    setLoading(true);
    const { error } = await supabase.from("penalties").delete().eq("id", id);
    if (error) setMsg({ kind: "err", text: error.message });
    else { setMsg({ kind: "ok", text: "Penalización eliminada." }); await loadAll(); }
    setLoading(false);
  }

  return (
    <div>
      <h1 className="admin-title">Penalizaciones</h1>
      <p style={{ color: "var(--gray)", marginBottom: 24, fontSize: "0.9rem" }}>
        Aplica o elimina penalizaciones post-carrera (Art. 23–24). Se descuentan al piloto y a su equipo en esa fecha.
      </p>

      {msg && <div className={`admin-msg ${msg.kind}`}>{msg.text}</div>}

      {/* ── Add form ── */}
      <div className="admin-card" style={{ marginBottom: 32 }}>
        <h2>Aplicar penalización</h2>
        <div className="admin-field">
          <label>Carrera</label>
          <select className="admin-select" value={form.raceId}
            onChange={(e) => setForm((f) => ({ ...f, raceId: e.target.value }))}>
            <option value="">— Selecciona —</option>
            {races.map((r) => (
              <option key={r.id} value={r.id}>{r.month_label} ({r.date})</option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label>Categoría</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["F1", "F2"] as Category[]).map((c) => (
              <button key={c} type="button"
                className={`admin-btn ${form.category === c ? "" : "secondary"}`}
                onClick={() => setForm((f) => ({ ...f, category: c }))}>
                {c === "F1" ? "🏎 F1" : "🏁 F2"}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-field">
          <label>Piloto</label>
          <select className="admin-select" value={form.driverId}
            onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))}>
            <option value="">— Selecciona —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.alias}</option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label>Nivel de penalización</label>
          <select className="admin-select" value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as PenaltyLevel }))}>
            {(Object.entries(LEVEL_LABELS) as [PenaltyLevel, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label>Razón / descripción (opcional)</label>
          <input className="admin-input" placeholder="Ej: Contacto en curva 3"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </div>
        <button className="admin-btn" disabled={loading} onClick={add}>
          {loading ? "Guardando…" : "Aplicar penalización"}
        </button>
      </div>

      {/* ── List ── */}
      <div className="admin-card">
        <h2>Penalizaciones registradas ({rows.length})</h2>
        {rows.length === 0 ? (
          <p style={{ color: "var(--gray)" }}>No hay penalizaciones aún.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cat</th>
                <th>Piloto</th>
                <th>Nivel</th>
                <th>Pts</th>
                <th>Razón</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const race = raceById.get(r.race_id);
                return (
                  <tr key={r.id}>
                    <td>{race ? `${race.month_label} (${race.date})` : r.race_id.slice(0, 8)}</td>
                    <td>{r.category}</td>
                    <td>{aliasById.get(r.driver_id) ?? "?"}</td>
                    <td>{LEVEL_LABELS[r.level]}</td>
                    <td style={{ color: "var(--red)", fontWeight: 700 }}>
                      {PENALTY_POINTS[r.level]}
                    </td>
                    <td style={{ color: "var(--gray)", fontSize: "0.85rem" }}>{r.reason ?? "—"}</td>
                    <td>
                      <button className="admin-btn danger" disabled={loading}
                        onClick={() => remove(r.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
