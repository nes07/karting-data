"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface DriverRow {
  id: string;
  alias: string;
  full_name: string | null;
  email: string | null;
  photo_url: string | null;
  active: boolean;
}

export default function DriversPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [alias, setAlias] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("drivers").select("*").order("alias");
    setRows((data as DriverRow[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    setMsg(null);
    const { error } = await supabase
      .from("drivers")
      .insert({ alias: alias.trim().toUpperCase(), full_name: fullName.trim() || null });
    if (error) {
      setMsg(error.message);
      return;
    }
    setAlias("");
    setFullName("");
    await load();
  }

  async function toggleActive(d: DriverRow) {
    await supabase.from("drivers").update({ active: !d.active }).eq("id", d.id);
    await load();
  }

  async function uploadPhoto(d: DriverRow, file: File) {
    setMsg(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `pilots/${d.id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("fotos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setMsg(
        `${upErr.message} — ¿corriste la migración 0002_photos.sql en Supabase?`
      );
      return;
    }
    const { data } = supabase.storage.from("fotos").getPublicUrl(path);
    // Cache-buster so replacing a photo updates immediately.
    const url = `${data.publicUrl}?v=${file.lastModified}`;
    const { error } = await supabase
      .from("drivers")
      .update({ photo_url: url })
      .eq("id", d.id);
    if (error) setMsg(error.message);
    await load();
  }

  return (
    <div>
      <div className="admin-card">
        <h2>Inscribir piloto nuevo</h2>
        {msg && <div className="admin-msg err">{msg}</div>}
        <div className="admin-grid">
          <div className="admin-field">
            <label>Alias (como aparece en standings)</label>
            <input className="admin-input" value={alias} onChange={(e) => setAlias(e.target.value)} />
          </div>
          <div className="admin-field">
            <label>Nombre completo</label>
            <input className="admin-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
        </div>
        <button className="admin-btn" disabled={!alias.trim()} onClick={add}>
          + Inscribir
        </button>
        <p style={{ color: "var(--gray)", fontSize: "0.78rem", marginTop: 12 }}>
          El piloto aparece de inmediato y puede correr como suplente (RD) o
          ser asignado a un equipo en la pestaña Equipos. Los standings se
          recalculan solos.
        </p>
      </div>

      <div className="admin-card">
        <h2>Pilotos ({rows.length})</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Foto</th><th>Alias</th><th>Nombre</th><th>Estado</th><th></th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} style={{ opacity: d.active ? 1 : 0.45 }}>
                <td>
                  {d.photo_url ? (
                    <img
                      src={d.photo_url}
                      alt={d.alias}
                      style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ color: "var(--gray)" }}>—</span>
                  )}
                </td>
                <td><strong>{d.alias}</strong></td>
                <td>{d.full_name ?? "—"}</td>
                <td>{d.active ? "Activo" : "Retirado"}</td>
                <td>
                  <label className="admin-btn secondary" style={{ cursor: "pointer" }}>
                    {d.photo_url ? "Cambiar foto" : "Subir foto"}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadPhoto(d, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </td>
                <td>
                  <button className="admin-btn secondary" onClick={() => toggleActive(d)}>
                    {d.active ? "Retirar" : "Reactivar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
