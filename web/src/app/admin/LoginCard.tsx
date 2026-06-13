"use client";

import { createClient } from "@/lib/supabase/client";

export function LoginCard() {
  async function signIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin`,
      },
    });
  }

  return (
    <div className="admin-card" style={{ maxWidth: 420, margin: "80px auto", textAlign: "center" }}>
      <h2>Panel de Administración</h2>
      <p style={{ color: "var(--gray)", fontSize: "0.9rem", marginBottom: 24 }}>
        Inicia sesión con tu cuenta de Google autorizada para gestionar el
        campeonato.
      </p>
      <button className="admin-btn" onClick={signIn}>
        Entrar con Google
      </button>
      <p style={{ color: "var(--gray)", fontSize: "0.75rem", marginTop: 16 }}>
        Si tu cuenta no está en la lista de administradores, no podrás
        realizar cambios.
      </p>
    </div>
  );
}
