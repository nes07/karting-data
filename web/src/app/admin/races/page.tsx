"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = "F1" | "F2";

interface DriverOpt {
  id: string;
  alias: string;
}
interface TeamOpt {
  id: string;
  name: string;
  escuderia: string;
  category: Category;
  driver1_id: string | null;
  driver2_id: string | null;
}
interface RaceRow {
  id: string;
  date: string;
  month_label: string;
  is_official: boolean;
}
interface ResultDraft {
  driverId: string;
  category: Category;
  position: number;
  bestTime: number | null;
  isReserve: boolean;
  replacedTeamId: string | null;
}
interface DotdDraft {
  driverId: string;
  reason: string;
}

export default function RacesAdminPage() {
  const supabase = useMemo(() => createClient(), []);

  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  const [editing, setEditing] = useState<RaceRow | null>(null);
  const [results, setResults] = useState<ResultDraft[]>([]);
  const [dotd, setDotd] = useState<Record<Category, DotdDraft>>({
    F1: { driverId: "", reason: "" },
    F2: { driverId: "", reason: "" },
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const aliasById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d.alias])),
    [drivers]
  );
  const officialIds = useMemo(() => {
    const m: Record<Category, Set<string>> = { F1: new Set(), F2: new Set() };
    for (const t of teams) {
      for (const id of [t.driver1_id, t.driver2_id]) {
        if (id) m[t.category].add(id);
      }
    }
    return m;
  }, [teams]);

  const loadAll = useCallback(async () => {
    const [d, t, r, res] = await Promise.all([
      supabase.from("drivers").select("id, alias").order("alias"),
      supabase.from("teams").select("*").eq("active", true),
      supabase.from("races").select("*").order("date", { ascending: false }),
      supabase.from("race_results").select("race_id"),
    ]);
    setDrivers(d.data ?? []);
    setTeams(t.data ?? []);
    setRaces(r.data ?? []);
    const c = new Map<string, number>();
    for (const row of res.data ?? []) {
      c.set(row.race_id, (c.get(row.race_id) ?? 0) + 1);
    }
    setCounts(c);
  }, [supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function openEditor(race: RaceRow) {
    setMsg(null);
    setLoading(true);
    try {
      const [res, dt] = await Promise.all([
        supabase.from("race_results").select("*").eq("race_id", race.id),
        supabase.from("dotd").select("*").eq("race_id", race.id),
      ]);
      setResults(
        (res.data ?? [])
          .map((r) => ({
            driverId: r.driver_id,
            category: r.category as Category,
            position: r.position,
            bestTime: r.best_time,
            isReserve: r.is_reserve,
            replacedTeamId: r.replaced_team_id,
          }))
          .sort((a, b) => a.position - b.position)
      );
      const next: Record<Category, DotdDraft> = {
        F1: { driverId: "", reason: "" },
        F2: { driverId: "", reason: "" },
      };
      for (const d of dt.data ?? []) {
        next[d.category as Category] = {
          driverId: d.driver_id,
          reason: d.reason ?? "",
        };
      }
      setDotd(next);
      setEditing(race);
    } finally {
      setLoading(false);
    }
  }

  function patchResult(i: number, patch: Partial<ResultDraft>) {
    setResults((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function addRow(cat: Category) {
    setResults((rs) => {
      const maxPos = Math.max(0, ...rs.filter((r) => r.category === cat).map((r) => r.position));
      return [
        ...rs,
        {
          driverId: "",
          category: cat,
          position: maxPos + 1,
          bestTime: null,
          isReserve: false,
          replacedTeamId: null,
        },
      ];
    });
  }

  async function save() {
    if (!editing) return;
    const clean = results.filter((r) => r.driverId && r.position > 0);
    const missingTeam = clean.find((r) => r.isReserve && !r.replacedTeamId);
    if (missingTeam) {
      setMsg({
        kind: "err",
        text: `${aliasById.get(missingTeam.driverId)} es suplente: indica a qué equipo reemplaza.`,
      });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      // Replace the full result set so removed rows actually disappear.
      const del = await supabase.from("race_results").delete().eq("race_id", editing.id);
      if (del.error) throw new Error(del.error.message);
      if (clean.length > 0) {
        const ins = await supabase.from("race_results").insert(
          clean.map((r) => ({
            race_id: editing.id,
            driver_id: r.driverId,
            category: r.category,
            position: r.position,
            best_time: r.bestTime,
            is_reserve: r.isReserve,
            replaced_team_id: r.isReserve ? r.replacedTeamId : null,
          }))
        );
        if (ins.error) throw new Error(ins.error.message);
      }

      const delDotd = await supabase.from("dotd").delete().eq("race_id", editing.id);
      if (delDotd.error) throw new Error(delDotd.error.message);
      const dotdRows = (["F1", "F2"] as const)
        .filter((cat) => dotd[cat].driverId)
        .map((cat) => ({
          race_id: editing.id,
          driver_id: dotd[cat].driverId,
          category: cat,
          reason: dotd[cat].reason || null,
        }));
      if (dotdRows.length > 0) {
        const insDotd = await supabase.from("dotd").insert(dotdRows);
        if (insDotd.error) throw new Error(insDotd.error.message);
      }

      setMsg({ kind: "ok", text: "Cambios guardados. Los standings se recalculan solos." });
      await loadAll();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function removeRace(race: RaceRow) {
    const ok = window.confirm(
      `¿Eliminar la fecha ${race.month_label} (${race.date}) con TODOS sus resultados, DOTD y tiempos? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setLoading(true);
    setMsg(null);
    try {
      // lap_times are keyed by date (no FK cascade from races).
      const lt = await supabase.from("lap_times").delete().eq("session_date", race.date);
      if (lt.error) throw new Error(lt.error.message);
      const del = await supabase.from("races").delete().eq("id", race.id);
      if (del.error) throw new Error(del.error.message);
      if (editing?.id === race.id) setEditing(null);
      setMsg({ kind: "ok", text: `Fecha ${race.month_label} eliminada.` });
      await loadAll();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {msg && <div className={`admin-msg ${msg.kind}`}>{msg.text}</div>}

      <div className="admin-card">
        <h2>📋 Carreras publicadas</h2>
        <p style={{ color: "var(--gray)", fontSize: "0.85rem", marginBottom: 12 }}>
          Edita posiciones, suplentes y DOTD de fechas ya publicadas, o elimina una
          fecha completa (por ejemplo, una de prueba).
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Mes</th>
              <th>Oficial</th>
              <th>Resultados</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {races.map((r) => (
              <tr key={r.id} style={{ opacity: counts.get(r.id) ? 1 : 0.5 }}>
                <td>{r.date}</td>
                <td>{r.month_label}</td>
                <td>{r.is_official ? "Sí" : "No"}</td>
                <td>{counts.get(r.id) ?? 0}</td>
                <td>
                  <button
                    className="admin-btn secondary"
                    disabled={loading}
                    onClick={() => openEditor(r)}
                  >
                    Editar
                  </button>
                </td>
                <td>
                  <button
                    className="admin-btn danger"
                    disabled={loading}
                    onClick={() => removeRace(r)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {races.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--gray)" }}>
                  No hay carreras publicadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="admin-card" style={{ marginTop: 16 }}>
          <h2>
            ✏️ Editando: {editing.month_label} — {editing.date}
          </h2>

          {(["F1", "F2"] as const).map((cat) => (
            <div key={cat} style={{ marginBottom: 24 }}>
              <h2 style={{ color: "var(--gold)" }}>
                {cat === "F1" ? "🏎 New Era — F1" : "🏁 Era Antigua — F2"}
              </h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Piloto</th>
                    <th>Suplente</th>
                    <th>Reemplaza a</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) =>
                    r.category !== cat ? null : (
                      <tr key={i}>
                        <td style={{ width: 70 }}>
                          <input
                            type="number"
                            min={1}
                            className="admin-input"
                            style={{ width: 64 }}
                            value={r.position}
                            onChange={(e) => patchResult(i, { position: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <select
                            className="admin-select"
                            value={r.driverId}
                            onChange={(e) => {
                              const driverId = e.target.value;
                              patchResult(i, {
                                driverId,
                                isReserve: driverId ? !officialIds[cat].has(driverId) : false,
                              });
                            }}
                          >
                            <option value="">— Piloto —</option>
                            {drivers.map((d) => (
                              <option key={d.id} value={d.id}>{d.alias}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: "center" }}>{r.isReserve ? "Sí (RD)" : "—"}</td>
                        <td>
                          {r.isReserve && (
                            <select
                              className="admin-select"
                              value={r.replacedTeamId ?? ""}
                              onChange={(e) =>
                                patchResult(i, { replacedTeamId: e.target.value || null })
                              }
                            >
                              <option value="">— Equipo —</option>
                              {teams
                                .filter((t) => t.category === cat)
                                .map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.escuderia})
                                  </option>
                                ))}
                            </select>
                          )}
                        </td>
                        <td>
                          <button
                            className="admin-btn danger"
                            onClick={() => setResults((rs) => rs.filter((_, j) => j !== i))}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              <button
                className="admin-btn secondary"
                style={{ marginTop: 8 }}
                onClick={() => addRow(cat)}
              >
                + Agregar piloto {cat}
              </button>
            </div>
          ))}

          <h2>Driver of the Day</h2>
          {(["F1", "F2"] as const).map((cat) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div className="admin-field">
                <label>DOTD — {cat === "F1" ? "F1 Moderna" : "F1 Clásica"}</label>
                <select
                  className="admin-select"
                  value={dotd[cat].driverId}
                  onChange={(e) =>
                    setDotd((d) => ({ ...d, [cat]: { ...d[cat], driverId: e.target.value } }))
                  }
                >
                  <option value="">— Sin DOTD —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.alias}</option>
                  ))}
                </select>
              </div>
              <div className="admin-field">
                <label>Razón</label>
                <input
                  className="admin-input"
                  value={dotd[cat].reason}
                  placeholder="Por qué ganó el DOTD…"
                  onChange={(e) =>
                    setDotd((d) => ({ ...d, [cat]: { ...d[cat], reason: e.target.value } }))
                  }
                />
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="admin-btn secondary" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button className="admin-btn" disabled={loading} onClick={save}>
              {loading ? "Guardando…" : "💾 Guardar cambios"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
