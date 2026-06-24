export function SetupNotice({ message }: { message: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <h1 className="section-title">
          GKD <span className="accent">Championship</span>
        </h1>
        <p className="section-subtitle" style={{ marginTop: 16 }}>
          Configura las variables de entorno de Supabase para ver los datos.
        </p>
        <code style={{ color: "var(--gray)" }}>{message}</code>
      </div>
    </main>
  );
}
