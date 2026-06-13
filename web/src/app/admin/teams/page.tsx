"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CONSTRUCTOR_COLORS } from "@/lib/constants";

interface DriverOpt {
  id: string;
  alias: string;
}
interface TeamRow {
  id: string;
  name: string;
  escuderia: string;
  category: "F1" | "F2";
  driver1_id: string | null;
  driver2_id: string | null;
  active: boolean;
}

const ESCUDERIAS = Object.keys(CONSTRUCTOR_COLORS).filter((e) => e !== "RD");

export default function TeamsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    escuderia: "",
    category: "F1" as "F1" | "F2",
  });

  async function load() {
    const [t, d] = await Promise.all([
      supabase.from("teams").select("*").order("category").order("name"),
      supabase.from("drivers").select("id, alias").eq("active", true).order("alias"),
    ]);
    setTeams((t.data as TeamRow[]) ?? []);
    setDrivers((d.data as DriverOpt[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    setMsg(null);
    const { error } = await supabase.from("teams").insert({
      name: draft.name.trim(),
      escuderia: draft.escuderia,
      category: draft.category,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setDraft({ name: "", escuderia: "", category: "F1" });
    await load();
  }

  async function patch(id: string, p: Partial<TeamRow>) {
    const { error } = await supabase.from("teams").update(p).eq("id", id);
    if (error) setMsg(error.message);
    await load();
  }

  function seatSelect(t: TeamRow, seat: "driver1_id" | "driver2_id") {
    return (
      <select
        className="admin-select"
        value={t[seat] ?? ""}
        onChange={(e) => patch(t.id, { [seat]: e.target.value || null })}
      >
        <option value="">— TBD —</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>{d.alias}</option>
        ))}
      </select>
    );
  }

  return (
    <div>
      <div className="admin-card">
        <h2>Crear equipo nuevo</h2>
        {msg && <div className="admin-msg err">{msg}</div>}
        <div className="admin-grid">
          <div className="admin-field">
            <label>Nombre (ej. Equipo 10)</label>
            <input
              className="admin-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="admin-field">
            <label>Escudería</label>
            <select
              className="admin-select"
              value={draft.escuderia}
              onChange={(e) => setDraft({ ...draft, escuderia: e.target.value })}
            >
              <option value="">— Selecciona —</option>
              {ESCUDERIAS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label>Categoría</label>
            <select
              className="admin-select"
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value as "F1" | "F2" })
              }
            >
              <option value="F1">F1 — New Era</option>
              <option value="F2">F2 — Era Antigua</option>
            </select>
          </div>
        </div>
        <button
          className="admin-btn"
          disabled={!draft.name.trim() || !draft.escuderia}
          onClick={add}
        >
          + Crear equipo
        </button>
      </div>

      {(["F1", "F2"] as const).map((cat) => (
        <div className="admin-card" key={cat}>
          <h2>{cat === "F1" ? "🏎 New Era — F1" : "🏁 Era Antigua — F2"}</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Equipo</th><th>Escudería</th><th>Piloto 1</th><th>Piloto 2</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {teams
                .filter((t) => t.category === cat)
                .map((t) => (
                  <tr key={t.id} style={{ opacity: t.active ? 1 : 0.45 }}>
                    <td><strong>{t.name}</strong></td>
                    <td>
                      <select
                        className="admin-select"
                        value={t.escuderia}
                        onChange={(e) => patch(t.id, { escuderia: e.target.value })}
                      >
                        {ESCUDERIAS.map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </td>
                    <td>{seatSelect(t, "driver1_id")}</td>
                    <td>{seatSelect(t, "driver2_id")}</td>
                    <td>{t.active ? "Activo" : "Retirado"}</td>
                    <td>
                      <button
                        className="admin-btn secondary"
                        onClick={() => patch(t.id, { active: !t.active })}
                      >
                        {t.active ? "Retirar" : "Reactivar"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
