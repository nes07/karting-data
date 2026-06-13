"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface DriverOpt {
  id: string;
  alias: string;
}
interface TeamOpt {
  id: string;
  name: string;
  escuderia: string;
  category: "F1" | "F2";
  driver1_id: string | null;
  driver2_id: string | null;
}
interface KSession {
  sessionId: string;
  sessionName: string;
  sessionType: string;
  displayTime: string;
  totalDrivers: number;
}
interface ImportedTime {
  webName: string;
  bestTime: number | null;
  position: number | null;
  driverId: string | null;
}
interface ResultDraft {
  driverId: string;
  category: "F1" | "F2";
  position: number;
  bestTime: number | null;
  isReserve: boolean;
  replacedTeamId: string | null;
}

const MONTHS = [
  "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre",
];

export default function RaceDayPage() {
  const supabase = useMemo(() => createClient(), []);

  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [teams, setTeams] = useState<TeamOpt[]>([]);

  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [monthLabel, setMonthLabel] = useState("");
  const [isOfficial, setIsOfficial] = useState(true);

  const [sessions, setSessions] = useState<KSession[]>([]);
  const [imported, setImported] = useState<ImportedTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [results, setResults] = useState<ResultDraft[]>([]);
  const [dotdF1, setDotdF1] = useState({ driverId: "", reason: "" });
  const [dotdF2, setDotdF2] = useState({ driverId: "", reason: "" });

  useEffect(() => {
    (async () => {
      const [d, t] = await Promise.all([
        supabase.from("drivers").select("id, alias").eq("active", true).order("alias"),
        supabase.from("teams").select("*").eq("active", true),
      ]);
      setDrivers((d.data as DriverOpt[]) ?? []);
      setTeams((t.data as TeamOpt[]) ?? []);
    })();
  }, [supabase]);

  const officialIds = useMemo(() => {
    const m: Record<"F1" | "F2", Set<string>> = { F1: new Set(), F2: new Set() };
    for (const t of teams) {
      for (const id of [t.driver1_id, t.driver2_id]) {
        if (id) m[t.category].add(id);
      }
    }
    return m;
  }, [teams]);

  async function loadSessions() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/karteando?date=${date}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSessions(data.races ?? []);
      if ((data.races ?? []).length === 0) {
        setMsg({ kind: "err", text: "No hay sesiones en Karteando para esa fecha." });
      }
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  async function importSession(sessionId: string) {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/karteando?sessionId=${sessionId}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      // Merge: keep the best (lowest) time per webName.
      setImported((prev) => {
        const merged = new Map(prev.map((x) => [x.webName, x]));
        for (const row of data.results as ImportedTime[]) {
          const cur = merged.get(row.webName);
          if (!cur || (row.bestTime != null && (cur.bestTime == null || row.bestTime < cur.bestTime))) {
            merged.set(row.webName, { ...row, driverId: cur?.driverId ?? row.driverId });
          }
        }
        return [...merged.values()];
      });
      setMsg({ kind: "ok", text: "Sesión importada. Puedes importar más o continuar." });
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Prefill the positions step from the imported times: drivers whose alias
   * was resolved get a draft row in the category where they hold an official
   * seat, ordered by their imported position. Pure reserves (no seat) must be
   * added manually since the session doesn't say which category they raced.
   */
  function gotoPositions() {
    if (results.length === 0) {
      const drafts: ResultDraft[] = [];
      for (const cat of ["F1", "F2"] as const) {
        const rows = imported
          .filter((t) => t.driverId && officialIds[cat].has(t.driverId))
          .sort(
            (a, b) =>
              (a.position ?? 999) - (b.position ?? 999) ||
              (a.bestTime ?? 9999) - (b.bestTime ?? 9999)
          );
        rows.forEach((t, i) => {
          drafts.push({
            driverId: t.driverId!,
            category: cat,
            position: i + 1,
            bestTime: t.bestTime,
            isReserve: false,
            replacedTeamId: null,
          });
        });
      }
      setResults(drafts);
    }
    setStep(2);
  }

  function addResultRow(category: "F1" | "F2") {
    setResults((r) => [
      ...r,
      {
        driverId: "",
        category,
        position: r.filter((x) => x.category === category).length + 1,
        bestTime: null,
        isReserve: false,
        replacedTeamId: null,
      },
    ]);
  }

  function patchResult(idx: number, patch: Partial<ResultDraft>) {
    setResults((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function publish() {
    setLoading(true);
    setMsg(null);
    try {
      const lapTimes = imported
        .filter((t) => t.driverId && t.bestTime != null)
        .map((t) => ({ driverId: t.driverId!, bestTime: t.bestTime! }));
      const newMappings = imported
        .filter((t) => t.driverId)
        .map((t) => ({ webName: t.webName, driverId: t.driverId! }));
      const dotd = [
        dotdF1.driverId
          ? { driverId: dotdF1.driverId, category: "F1" as const, reason: dotdF1.reason || null }
          : null,
        dotdF2.driverId
          ? { driverId: dotdF2.driverId, category: "F2" as const, reason: dotdF2.reason || null }
          : null,
      ].filter((x): x is NonNullable<typeof x> => x !== null);

      const bad = results.filter(
        (r) => !r.driverId || (r.isReserve && !r.replacedTeamId)
      );
      if (bad.length > 0) {
        throw new Error(
          "Hay filas sin piloto o suplentes sin equipo reemplazado."
        );
      }

      const timeByDriver = new Map(
        imported.filter((t) => t.driverId).map((t) => [t.driverId!, t.bestTime])
      );

      const r = await fetch("/api/admin/publish-race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          monthLabel,
          isOfficial,
          results: results.map((x) => ({
            ...x,
            bestTime: x.bestTime ?? timeByDriver.get(x.driverId) ?? null,
          })),
          dotd,
          lapTimes,
          newMappings,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMsg({ kind: "ok", text: "✅ Fecha publicada. Los standings ya están actualizados." });
      setStep(4);
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  const STEPS = ["Fecha", "Tiempos", "Posiciones", "DOTD", "Publicar"];

  return (
    <div>
      <div className="admin-steps">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`admin-step${i === step ? " active" : i < step ? " done" : ""}`}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {msg && <div className={`admin-msg ${msg.kind}`}>{msg.text}</div>}

      {step === 0 && (
        <div className="admin-card">
          <h2>1 · Fecha de la sesión</h2>
          <div className="admin-field">
            <label>Fecha (día de la carrera)</label>
            <input
              type="date"
              className="admin-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label>Mes del campeonato</label>
            <select
              className="admin-select"
              value={monthLabel}
              onChange={(e) => setMonthLabel(e.target.value)}
            >
              <option value="">— Selecciona —</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label>
              <input
                type="checkbox"
                checked={isOfficial}
                onChange={(e) => setIsOfficial(e.target.checked)}
              />{" "}
              Fecha oficial del campeonato (cuenta para standings)
            </label>
          </div>
          <button
            className="admin-btn"
            disabled={!date || !monthLabel}
            onClick={() => setStep(1)}
          >
            Continuar →
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="admin-card">
          <h2>2 · Importar tiempos desde Karteando</h2>
          <button className="admin-btn secondary" disabled={loading || !date} onClick={loadSessions}>
            {loading ? "Cargando…" : `Buscar sesiones del ${date}`}
          </button>
          {sessions.length > 0 && (
            <table className="admin-table" style={{ marginTop: 16 }}>
              <thead>
                <tr><th>Sesión</th><th>Tipo</th><th>Hora</th><th>Pilotos</th><th></th></tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.sessionId}>
                    <td>{s.sessionName}</td>
                    <td>{s.sessionType}</td>
                    <td>{s.displayTime}</td>
                    <td>{s.totalDrivers}</td>
                    <td>
                      <button
                        className="admin-btn secondary"
                        disabled={loading}
                        onClick={() => importSession(s.sessionId)}
                      >
                        Importar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {imported.length > 0 && (
            <>
              <h2 style={{ marginTop: 24 }}>Tiempos importados — confirma los nombres</h2>
              <table className="admin-table">
                <thead>
                  <tr><th>Nombre web</th><th>Mejor vuelta</th><th>Piloto GKD</th></tr>
                </thead>
                <tbody>
                  {imported.map((t, i) => (
                    <tr key={t.webName}>
                      <td>{t.webName}</td>
                      <td>{t.bestTime?.toFixed(3) ?? "—"}</td>
                      <td>
                        <select
                          className="admin-select"
                          value={t.driverId ?? ""}
                          onChange={(e) =>
                            setImported((arr) =>
                              arr.map((x, j) =>
                                j === i ? { ...x, driverId: e.target.value || null } : x
                              )
                            )
                          }
                        >
                          <option value="">(ignorar)</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.alias}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button className="admin-btn secondary" onClick={() => setStep(0)}>← Volver</button>
            <button className="admin-btn" onClick={gotoPositions}>
              Continuar → {imported.length === 0 ? "(sin tiempos)" : ""}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="admin-card">
          <h2>3 · Posiciones finales {isOfficial ? "" : "(fecha no oficial — opcional)"}</h2>
          {(["F1", "F2"] as const).map((cat) => (
            <div key={cat} style={{ marginBottom: 24 }}>
              <h2 style={{ color: "var(--gold)" }}>
                {cat === "F1" ? "🏎 New Era — F1" : "🏁 Era Antigua — F2"}
              </h2>
              <table className="admin-table">
                <thead>
                  <tr><th>Pos</th><th>Piloto</th><th>Suplente</th><th>Reemplaza a</th><th></th></tr>
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
                        <td style={{ textAlign: "center" }}>
                          {r.isReserve ? "Sí (RD)" : "—"}
                        </td>
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
                onClick={() => addResultRow(cat)}
              >
                + Agregar piloto {cat}
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="admin-btn secondary" onClick={() => setStep(1)}>← Volver</button>
            <button className="admin-btn" onClick={() => setStep(3)}>Continuar →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="admin-card">
          <h2>4 · Driver of the Day</h2>
          {([
            ["F1 Moderna", dotdF1, setDotdF1],
            ["F1 Clásica", dotdF2, setDotdF2],
          ] as const).map(([label, value, setter]) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <div className="admin-field">
                <label>DOTD — {label}</label>
                <select
                  className="admin-select"
                  value={value.driverId}
                  onChange={(e) => setter({ ...value, driverId: e.target.value })}
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
                  value={value.reason}
                  placeholder="Por qué ganó el DOTD…"
                  onChange={(e) => setter({ ...value, reason: e.target.value })}
                />
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="admin-btn secondary" onClick={() => setStep(2)}>← Volver</button>
            <button className="admin-btn" disabled={loading} onClick={publish}>
              {loading ? "Publicando…" : "🏁 Publicar fecha"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="admin-card" style={{ textAlign: "center" }}>
          <h2>🏆 Fecha publicada</h2>
          <p style={{ color: "var(--gray)" }}>
            Standings, Vuelta Rápida y DOTD ya están actualizados en la página
            pública. No hay que correr ningún script.
          </p>
        </div>
      )}
    </div>
  );
}
