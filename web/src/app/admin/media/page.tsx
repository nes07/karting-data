"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface MediaRow {
  id: string;
  tipo: string;
  titulo: string;
  url: string;
  fecha: string | null;
}

export default function MediaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState({ tipo: "Foto", titulo: "", url: "", fecha: "" });

  async function load() {
    const { data } = await supabase
      .from("media")
      .select("*")
      .order("fecha", { ascending: false });
    setRows((data as MediaRow[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    setMsg(null);
    const { error } = await supabase.from("media").insert({
      tipo: draft.tipo,
      titulo: draft.titulo.trim(),
      url: draft.url.trim(),
      fecha: draft.fecha || null,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setDraft({ tipo: "Foto", titulo: "", url: "", fecha: "" });
    await load();
  }

  async function remove(id: string) {
    await supabase.from("media").delete().eq("id", id);
    await load();
  }

  return (
    <div>
      <div className="admin-card">
        <h2>Agregar contenido</h2>
        {msg && <div className="admin-msg err">{msg}</div>}
        <div className="admin-grid">
          <div className="admin-field">
            <label>Tipo</label>
            <select
              className="admin-select"
              value={draft.tipo}
              onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
            >
              <option>Foto</option>
              <option>YouTube</option>
              <option>Instagram</option>
            </select>
          </div>
          <div className="admin-field">
            <label>Título</label>
            <input className="admin-input" value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} />
          </div>
          <div className="admin-field">
            <label>URL</label>
            <input className="admin-input" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          </div>
          <div className="admin-field">
            <label>Fecha</label>
            <input type="date" className="admin-input" value={draft.fecha} onChange={(e) => setDraft({ ...draft, fecha: e.target.value })} />
          </div>
        </div>
        <button className="admin-btn" disabled={!draft.titulo.trim() || !draft.url.trim()} onClick={add}>
          + Agregar
        </button>
      </div>

      <div className="admin-card">
        <h2>Contenido ({rows.length})</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Tipo</th><th>Título</th><th>Fecha</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.tipo}</td>
                <td>
                  <a href={m.url} target="_blank" rel="noreferrer" style={{ color: "var(--gold)" }}>
                    {m.titulo}
                  </a>
                </td>
                <td>{m.fecha ?? "—"}</td>
                <td>
                  <button className="admin-btn danger" onClick={() => remove(m.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
