# GKD Championship — Web Platform

Plataforma web del Mundial de Karting GKD 2026: página pública (standings,
resultados, vuelta rápida, media, DOTD) + panel de administración que
reemplaza todos los scripts de Python y la edición manual del spreadsheet.

- **Frontend/Backend**: Next.js (App Router) — hosting gratis en Vercel
- **Base de datos + Auth**: Supabase (Postgres, free tier) — login con Google
- **Motor de puntos**: `src/lib/scoring/engine.ts` (testeado contra el
  spreadsheet real con `scripts/migrate_to_supabase.ts --check`)

---

## Setup inicial (una sola vez)

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (free tier).
2. SQL Editor → pega y ejecuta `supabase/migrations/0001_schema.sql`.
3. Authentication → Providers → Google → habilítalo. Necesitas un OAuth
   Client de Google Cloud Console:
   - [console.cloud.google.com](https://console.cloud.google.com) → APIs &
     Services → Credentials → Create OAuth client ID (Web application).
   - Authorized redirect URI: `https://TU-PROYECTO.supabase.co/auth/v1/callback`
   - Copia Client ID + Secret en Supabase.
4. Agrega los administradores (SQL Editor):

   ```sql
   insert into admins (email) values ('tu-email@gmail.com');
   ```

### 2. Variables de entorno

```bash
cp .env.example .env.local
# completa NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
# y SUPABASE_SERVICE_ROLE_KEY (solo para la migración)
```

### 3. Migración de datos desde el spreadsheet

Desde la raíz del repo (necesita `credentials.json`):

```bash
# 1. Exportar snapshot del spreadsheet
python web/scripts/export_sheet_snapshot.py

# 2. Validar que el motor reproduce el sheet EXACTAMENTE (sin escribir nada)
cd web && npx tsx scripts/migrate_to_supabase.ts --check

# 3. Si la paridad está OK, poblar Supabase
npx tsx scripts/migrate_to_supabase.ts --seed
```

### 4. Deploy en Vercel

1. [vercel.com](https://vercel.com) → Add New Project → importa el repo.
2. **Root Directory**: `web`
3. Environment Variables: las mismas de `.env.local` (el service role key
   no es necesario en producción).
4. Deploy → la página queda en `https://<proyecto>.vercel.app`.
   Un dominio propio se conecta después sin cambiar código.
5. En Supabase → Authentication → URL Configuration: agrega
   `https://<proyecto>.vercel.app` como Site URL / Redirect URL.

---

## Operación (reemplaza UPDATES.md)

### Día de carrera oficial

`/admin/race-day` — un solo flujo, sin scripts:

1. Fecha + mes del campeonato.
2. Importar tiempos desde Karteando (resuelve nombres automáticamente;
   confirmas los desconocidos una vez y quedan guardados).
3. Posiciones finales por categoría. Los suplentes se detectan solos
   (piloto sin asiento oficial) y eliges a qué equipo reemplazan.
4. DOTD por categoría con razón.
5. Publicar → standings, vuelta rápida y página pública actualizados al
   instante. Nada más que correr.

### Práctica / fecha no oficial

`/admin/practice` — importa tiempos de Karteando; solo alimenta Vuelta Rápida.

### Pilotos o equipos nuevos a mitad de temporada

`/admin/drivers` y `/admin/teams` — alta inmediata; los standings se
recalculan solos en la próxima carga de página. Sin tocar filas de
spreadsheet ni correr migraciones.

### Reglas de puntaje

En la tabla `scoring_config` de Supabase (puntos por posición, bono de
participación, DOTD, factor de suplentes). Cambias el valor y todo se
recalcula — incluso retroactivamente.

---

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # tests del motor de puntos
npm run build
```

## Sistema de puntos (implementado en el engine)

| Regla | Valor |
|---|---|
| Puntos por posición | `max(0, 17 − posición)` — P1 = 16 (ambas categorías) |
| Participación piloto | +1 por fecha corrida (incluye últimos lugares con 0 pts) |
| DOTD | +1 por premio |
| Suplente (RD) | 100% de puntos para su ranking individual; 50% para el equipo reemplazado; escudería "RD" |
| Participación equipo | +1 por fecha donde corrió ≥1 piloto oficial (reemplazo total no suma) |
| Desempates | Puntos → posición promedio → mejor tiempo |
| Var | Posición actual vs. standings antes de la última fecha (debut = sin Var) |
