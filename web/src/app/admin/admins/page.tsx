"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AdminRow {
  email: string;
  created_at: string;
}

export default function AdminsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [me, setMe] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [{ data }, { data: auth }] = await Promise.all([
      supabase.from("admins").select("*").order("created_at"),
      supabase.auth.getUser(),
    ]);
    setRows((data as AdminRow[]) ?? []);
    setMe(auth.user?.email ?? "");
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    setMsg(null);
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setMsg({ kind: "err", text: "Eso no parece un correo válido." });
      return;
    }
    const { error } = await supabase.from("admins").insert({ email: clean });
    if (error) {
      setMsg({
        kind: "err",
        text: error.code === "23505" ? "Ese correo ya es admin." : error.message,
      });
      return;
    }
    setMsg({ kind: "ok", text: `${clean} ya puede entrar al panel con Google.` });
    setEmail("");
    await load();
  }

  async function remove(target: string) {
    if (target === me) {
      setMsg({ kind: "err", text: "No puedes quitarte a ti mismo (te quedarías afuera)." });
      return;
    }
    if (!window.confirm(`¿Quitar acceso de admin a ${target}?`)) return;
    const { error } = await supabase.from("admins").delete().eq("email", target);
    if (error) setMsg({ kind: "err", text: error.message });
    await load();
  }

  return (
    <div>
      <div className="admin-card">
        <h2>🔐 Administradores</h2>
        <p style={{ color: "var(--gray)", fontSize: "0.85rem", marginBottom: 12 }}>
          Cualquier correo de esta lista puede entrar al panel iniciando sesión
          con Google — no necesitan configurar nada más.
        </p>
        {msg && <div className={`admin-msg ${msg.kind}`}>{msg.text}</div>}
        <div className="admin-grid">
          <div className="admin-field">
            <label>Correo (cuenta de Google)</label>
            <input
              className="admin-input"
              type="email"
              placeholder="persona@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
        </div>
        <button className="admin-btn" disabled={!email.trim()} onClick={add}>
          + Dar acceso
        </button>
      </div>

      <div className="admin-card">
        <h2>Con acceso ({rows.length})</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Correo</th><th>Desde</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email}>
                <td>
                  <strong>{r.email}</strong>
                  {r.email === me && (
                    <span style={{ color: "var(--gray)", marginLeft: 8, fontSize: "0.78rem" }}>
                      (tú)
                    </span>
                  )}
                </td>
                <td style={{ color: "var(--gray)" }}>
                  {new Date(r.created_at).toLocaleDateString("es-CL")}
                </td>
                <td>
                  <button
                    className="admin-btn danger"
                    disabled={r.email === me}
                    onClick={() => remove(r.email)}
                  >
                    Quitar
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
