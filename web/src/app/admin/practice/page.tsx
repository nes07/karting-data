"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dedupeLapTimes } from "@/lib/lap-times";

interface DriverOpt {
  id: string;
  alias: string;
}
interface KSession {
  sessionId: string;
  sessionName: string;
  sessionType: string;
  displayTime: string;
  totalDrivers: number;
}
interface TimeRow {
  key: string;
  /** Karteando web name; null for manually added rows. */
  webName: string | null;
  bestTime: number | null;
  driverId: string | null;
}

function newManualRow(): TimeRow {
  return {
    key: `manual-${crypto.randomUUID()}`,
    webName: null,
    bestTime: null,
    driverId: null,
  };
}

export default function PracticePage() {
  const supabase = useMemo(() => createClient(), []);
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [date, setDate] = useState("");
  const [sessions, setSessions] = useState<KSession[]>([]);
  const [rows, setRows] = useState<TimeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    supabase
      .from("drivers")
      .select("id, alias")
      .eq("active", true)
      .order("alias")
      .then(({ data }) => setDrivers((data as DriverOpt[]) ?? []));
  }, [supabase]);

  function patchRow(key: string, patch: Partial<TimeRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  async function loadExisting() {
    if (!date) return;
    setLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from("lap_times")
        .select("driver_id, best_time")
        .eq("session_date", date);
      if (error) throw new Error(error.message);
      const loaded: TimeRow[] = (data ?? []).map((r) => ({
        key: `saved-${r.driver_id}`,
        webName: null,
        bestTime: Number(r.best_time),
        driverId: r.driver_id,
      }));
      setRows(loaded);
      setMsg({
        kind: "ok",
        text: loaded.length
          ? `${loaded.length} tiempos cargados de esta fecha. Puedes editar o agregar más.`
          : "No hay tiempos guardados para esta fecha. Agrega filas manualmente abajo.",
      });
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  async function loadSessions() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/karteando?date=${date}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `Karteando ${r.status}`);
      setSessions(data.races ?? []);
      if ((data.races ?? []).length === 0) {
        setMsg({
          kind: "err",
          text: "No hay sesiones en Karteando para esa fecha. Usa entrada manual abajo.",
        });
      }
    } catch (e) {
      setMsg({
        kind: "err",
        text: `${e instanceof Error ? e.message : e} — puedes cargar tiempos existentes o agregar filas manualmente.`,
      });
      setSessions([]);
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
      if (!r.ok) throw new Error(data.error ?? `Karteando ${r.status}`);
      setRows((prev) => {
        const merged = new Map<string, TimeRow>();
        for (const r of prev) {
          const id = r.webName ?? r.driverId ?? r.key;
          merged.set(id, r);
        }
        for (const raw of data.results as Omit<TimeRow, "key">[]) {
          const webName = raw.webName ?? null;
          if (!webName) continue;
          const cur = merged.get(webName);
          const row: TimeRow = {
            key: cur?.key ?? `k-${webName}`,
            webName,
            bestTime: raw.bestTime,
            driverId: cur?.driverId ?? raw.driverId,
          };
          if (
            !cur ||
            (row.bestTime != null &&
              (cur.bestTime == null || row.bestTime < cur.bestTime))
          ) {
            merged.set(webName, row);
          }
        }
        return [...merged.values()];
      });
      setMsg({ kind: "ok", text: "Sesión importada. Revisa pilotos y guarda." });
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!date) {
      setMsg({ kind: "err", text: "Selecciona una fecha." });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const valid = rows.filter((t) => t.driverId && t.bestTime != null);
      if (valid.length === 0) {
        throw new Error("Agrega al menos un piloto con tiempo.");
      }
      const lapRows = dedupeLapTimes(
        valid.map((t) => ({ driverId: t.driverId!, bestTime: t.bestTime! }))
      ).map((t) => ({
        driver_id: t.driverId,
        session_date: date,
        best_time: t.bestTime,
      }));
      const { error } = await supabase.from("lap_times").upsert(lapRows, {
        onConflict: "driver_id,session_date",
      });
      if (error) throw new Error(error.message);

      const mappings = valid.filter((t) => t.webName && t.driverId);
      if (mappings.length > 0) {
        const { error: mapErr } = await supabase.from("name_mappings").upsert(
          mappings.map((t) => ({ web_name: t.webName!, driver_id: t.driverId! })),
          { onConflict: "web_name" }
        );
        if (mapErr) throw new Error(mapErr.message);
      }

      setMsg({
        kind: "ok",
        text: `✅ ${lapRows.length} tiempos guardados. Vuelta Rápida actualizada.`,
      });
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-card">
      <h2>Tiempos de práctica (fecha no oficial)</h2>
      <p style={{ color: "var(--gray)", fontSize: "0.85rem", marginBottom: 16 }}>
        Alimenta la tabla Vuelta Rápida. Puedes importar desde Karteando o cargar/editar
        tiempos a mano si el servicio no está disponible.
      </p>
      {msg && <div className={`admin-msg ${msg.kind}`}>{msg.text}</div>}

      <div className="admin-field">
        <label>Fecha de la sesión</label>
        <input
          type="date"
          className="admin-input"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSessions([]);
          }}
        />
      </div>

      {date && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <button
            className="admin-btn secondary"
            disabled={loading}
            onClick={loadSessions}
          >
            {loading ? "Cargando…" : "Buscar sesiones en Karteando"}
          </button>
          <button
            className="admin-btn secondary"
            disabled={loading}
            onClick={loadExisting}
          >
            Cargar tiempos ya guardados
          </button>
        </div>
      )}

      {sessions.length > 0 && (
        <table className="admin-table" style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              <th>Sesión</th>
              <th>Hora</th>
              <th>Pilotos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.sessionId}>
                <td>{s.sessionName}</td>
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

      <h2 style={{ fontSize: "1rem", marginBottom: 8 }}>Tiempos — manual o importados</h2>
      {!date ? (
        <p style={{ color: "var(--gray)" }}>Elige una fecha para empezar.</p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Origen</th>
                <th>Piloto GKD</th>
                <th>Mejor vuelta (seg)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "var(--gray)", textAlign: "center" }}>
                    Sin filas. Importa desde Karteando, carga los ya guardados, o agrega pilotos.
                  </td>
                </tr>
              )}
              {rows.map((t) => (
                <tr key={t.key}>
                  <td style={{ color: "var(--gray)", fontSize: "0.85rem" }}>
                    {t.webName ?? "Manual"}
                  </td>
                  <td>
                    <select
                      className="admin-select"
                      value={t.driverId ?? ""}
                      onChange={(e) =>
                        patchRow(t.key, { driverId: e.target.value || null })
                      }
                    >
                      <option value="">— Piloto —</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.alias}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ width: 120 }}>
                    <input
                      type="number"
                      step="0.001"
                      min={0}
                      className="admin-input"
                      style={{ width: 100 }}
                      placeholder="58.432"
                      value={t.bestTime ?? ""}
                      onChange={(e) =>
                        patchRow(t.key, {
                          bestTime: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="admin-btn danger"
                      type="button"
                      onClick={() => removeRow(t.key)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button
              className="admin-btn secondary"
              type="button"
              onClick={() => setRows((r) => [...r, newManualRow()])}
            >
              + Agregar piloto
            </button>
            <button className="admin-btn" disabled={loading || rows.length === 0} onClick={save}>
              {loading ? "Guardando…" : "Guardar tiempos"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
