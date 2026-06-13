# GKD Championship — Guía de Actualización

> Referencia rápida para actualizar el campeonato después de cada fecha.
> El sitio web (GitHub Pages) se actualiza automáticamente al cargar la página — no requiere redeployar nada en el día a día.

---

## Caso A: Solo actualizar Vuelta Rápida (tiempos de vuelta)

Usar cuando hay sesiones de práctica, clasificación, o simplemente se quiere actualizar el ranking de mejores tiempos **sin que haya habido una fecha oficial del campeonato**.

### 1. Extraer tiempos desde la API de Karteando

```bash
python main.py
```

El script preguntará:
- **Fecha** → formato `YYYY-MM-DD` (ej: `2026-04-12`)
- **Carreras** → seleccionar cuáles sesiones importar (ej: `1` para solo Carrera 1)

Esto escribe los tiempos en la hoja **"Tiempos 2026"**.

### 2. Reconstruir variaciones

```bash
python variation_builder.py
```

Actualiza la hoja **"Variaciones"** que calcula cuántas posiciones ganó/perdió cada piloto en el ranking de vuelta rápida.

### 3. Listo ✓

El sitio web lee los datos en vivo desde Google Sheets. Recargar la página ya muestra los nuevos tiempos en la sección **Vuelta Rápida**.

---

## Caso B: Actualización completa post-fecha oficial

Usar después de **cada fecha del campeonato** (Marzo, Abril, etc.). Incluye tiempos Y posiciones de carrera.

### 1. Extraer tiempos desde la API de Karteando

```bash
python main.py
```

- Ingresar la **fecha oficial** (ej: `2026-04-12`)
- Seleccionar **todas las carreras** de la fecha (F1 + F2)

Actualiza la hoja **"Tiempos 2026"**.

### 2. Reconstruir variaciones

```bash
python variation_builder.py
```

### 3. Ingresar posiciones de carrera en Google Sheets (manual)

Abrir la hoja **"Drivers Standings"** y llenar la columna de la fecha correspondiente:
- Columna **Posición** (ej: Abril = col F) → ingresar `1`, `2`, `3`... para cada piloto
- Los **Puntos Totales** y el orden se actualizan automáticamente por fórmula y `onEdit`

### 4. Recalcular standings

```bash
python standings.py
```

Reconstruye las hojas **"Drivers Standings"** y **"Team Standings"** con el formato oficial, ordenamiento y cálculo de puntos.

> ⚠️ Solo correr si se necesita reconstruir la estructura completa. Si solo se actualizaron posiciones en la hoja existente, el `onEdit` del Apps Script ya ordena automáticamente.

### 5. Registrar el Driver of the Day (manual en Google Sheets)

Abrir la hoja **"DOTD"** y agregar una fila por categoría:
| date | pilot | category | reason |
|------|-------|----------|--------|
| 12/04/2026 | Nico E | F1 Moderna | Mejor tiempo histórico GKD |

### 6. Agregar fotos al Drive (opcional)

En la carpeta **GKD Media** de Google Drive:
- Subir fotos de la fecha a una nueva subcarpeta: `Fecha 3 [2026-05-17]`
- Las fotos aparecen automáticamente en el carrusel de la sección **Media**

Después de subir las fotos, limpiar el caché del Apps Script para que las encuentre de inmediato:

```javascript
// Pegar en Apps Script editor → Run
function clearDriveCache() {
  CacheService.getScriptCache().remove("gkd_drive_images");
}
```

### 7. Listo ✓

Recargar el sitio web. Todos los cambios (standings, resultados, VR, DOTD, media) aparecen en vivo.

---

## Caso C: Cambio de trazado (reset de tiempos)

Usar cuando cambia el layout de pista y los tiempos anteriores ya no son comparables.

**Configuración actual del proyecto:** reset desde `2026-05-10`.

Qué pasa con cada ranking:
- **Drivers/Teams standings (puntos):** se mantienen igual (histórico completo).
- **Vuelta Rápida / mejores tiempos / best_time en resultados:** se calculan solo desde la fecha de reset.

### Flujo recomendado

1. Cargar tiempos nuevos en **"Tiempos 2026"** (manual o `python main.py`).
2. Reconstruir campeonato de vuelta rápida:

```bash
python fast_lap_championship.py
```

3. Reconstruir variaciones:

```bash
python variation_builder.py
```

4. Recargar la web.

### Importante

- Si hay pilotos sin sesiones en el nuevo trazado, aparecerán sin tiempo (`null`) o fuera del ranking VR.
- Es esperado que en la primera fecha post-reset la variación (`Δ`) parta vacía para muchos pilotos.

---

## Referencia rápida de scripts

| Script | Qué hace |
|--------|----------|
| `main.py` | Extrae tiempos desde API Karteando → escribe en "Tiempos 2026" |
| `variation_builder.py` | Calcula variaciones para el ranking de Vuelta Rápida |
| `standings.py` | Reconstruye hojas "Drivers Standings" y "Team Standings" |
| `team_assignment.py` | Asigna pilotos a equipos en la hoja "Equipos" |
| `fast_lap_championship.py` | Actualiza hoja "Campeonato Vuelta Rápida" |

---

## Si hay cambios en el código del sitio web

```bash
git add -A
git commit -m "descripción del cambio"
git push
```

GitHub Pages actualiza el sitio en ~2 minutos.

---

## Si hay cambios en el Apps Script

1. Copiar el contenido de `APPS_SCRIPT.js` al editor de Apps Script
2. **Implementar → Administrar implementaciones → ✏️ → Nueva versión → Implementar**
3. No es necesario actualizar el URL del sitio (el deployment URL no cambia al crear una nueva versión)
