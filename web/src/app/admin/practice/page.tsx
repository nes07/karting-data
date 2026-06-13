"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
interface ImportedTime {
  webName: string;
  bestTime: number | null;
  driverId: string | null;
}

export default function PracticePage() {
  const supabase = useMemo(() => createClient(), []);
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [date, setDate] = useState("");
  const [sessions, setSessions] = useState<KSession[]>([]);
  const [imported, setImported] = useState<ImportedTime[]>([]);
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

  async function loadSessions() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/karteando?date=${date}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSessions(data.races ?? []);
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  async function importSession(sessionId: string) {
    setLoading(true);
    try {
      const r = await fetch(`/api/karteando?sessionId=${sessionId}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
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
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    setMsg(null);
    try {
      const rows = imported.filter((t) => t.driverId && t.bestTime != null);
      const { error } = await supabase.from("lap_times").upsert(
        rows.map((t) => ({
          driver_id: t.driverId!,
          session_date: date,
          best_time: t.bestTime!,
        })),
        { onConflict: "driver_id,session_date" }
      );
      if (error) throw new Error(error.message);

      const { error: mapErr } = await supabase.from("name_mappings").upsert(
        rows.map((t) => ({ web_name: t.webName, driver_id: t.driverId! })),
        { onConflict: "web_name" }
      );
      if (mapErr) throw new Error(mapErr.message);

      setMsg({ kind: "ok", text: `✅ ${rows.length} tiempos guardados. Vuelta Rápida actualizada.` });
    } catch (e) {
      setMsg({ kind: "err", text: String(e instanceof Error ? e.message : e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-card">
      <h2>Tiempos de práctica (fecha no oficial)</h2>
      {msg && <div className={`admin-msg ${msg.kind}`}>{msg.text}</div>}
      <div className="admin-field">
        <label>Fecha de la sesión</label>
        <input type="date" className="admin-input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button className="admin-btn secondary" disabled={loading || !date} onClick={loadSessions}>
        {loading ? "Cargando…" : "Buscar sesiones en Karteando"}
      </button>

      {sessions.length > 0 && (
        <table className="admin-table" style={{ marginTop: 16 }}>
          <thead>
            <tr><th>Sesión</th><th>Hora</th><th>Pilotos</th><th></th></tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.sessionId}>
                <td>{s.sessionName}</td>
                <td>{s.displayTime}</td>
                <td>{s.totalDrivers}</td>
                <td>
                  <button className="admin-btn secondary" disabled={loading} onClick={() => importSession(s.sessionId)}>
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
          <table className="admin-table" style={{ marginTop: 16 }}>
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
          <button className="admin-btn" style={{ marginTop: 16 }} disabled={loading} onClick={save}>
            Guardar tiempos
          </button>
        </>
      )}
    </div>
  );
}
