# GKD Championship 2026

Herramientas de análisis, automatización de standings y web app del campeonato de karting GKD 2026.

---

## Estructura del proyecto

```
karting-data-extractor/
├── index.html              ← Web app principal (GitHub Pages)
├── assets/
│   ├── css/main.css        ← Design system GKD
│   ├── js/app.js           ← Lógica frontend (fetch + render)
│   └── images/
│       ├── logo/           ← gkd-logo.png
│       ├── pilots/         ← una foto por piloto (ver convención abajo)
│       └── teams/          ← una foto por equipo
├── standings.py            ← Crea/actualiza hojas del campeonato
├── team_assignment.py      ← Crea/actualiza hoja Equipos e Inscritos
├── APPS_SCRIPT.js          ← Apps Script para Google Sheets (pegar completo)
├── Karting_Analysis.ipynb  ← Notebook de análisis y ranking
└── MEDIA_PLANNING_SCRIPT.js← Script auxiliar de media
```

---

## Configuración inicial

### 1. Credenciales de Google Sheets

El archivo `credentials.json` debe estar en la raíz del proyecto. Contiene las credenciales de la cuenta de servicio con acceso al spreadsheet "Mundial de Karting 2026".

### 2. Entorno Python

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Apps Script

1. Abre el spreadsheet → **Extensiones → Apps Script**
2. Reemplaza todo el contenido con el archivo `APPS_SCRIPT.js`
3. Guarda (Cmd+S) y autoriza

---

## Comandos de actualización

| Evento | Comando |
|--------|---------|
| Ingresar posiciones de una carrera | Manual en Google Sheets → se ordena automáticamente |
| Actualizar tiempos de desempate tras carrera oficial | `python standings.py --tiebreaker` |
| Cambios en la lista de inscritos / equipos | `python team_assignment.py` |
| Reconstruir solo Team Standings | `python standings.py --team-only` |
| Reconstruir todo (Drivers + Teams) | `python standings.py` |
| Crear/reconstruir hoja Suplentes | `python standings.py --suplentes` |
| Crear/reconstruir hoja DOTD | `python standings.py --dotd-sheet` |

---

## Web App — Deploy en GitHub Pages

### Paso 1: Configurar el API de datos

1. En Google Sheets → **Extensiones → Apps Script** → asegúrate de tener `APPS_SCRIPT.js` pegado
2. Click en **Implementar → Nueva implementación**
3. Tipo: **Aplicación web**
4. Ejecutar como: **Yo**
5. Quién tiene acceso: **Cualquiera**
6. Click **Implementar** → copia la URL generada
7. Abre `assets/js/app.js` y reemplaza:
   ```js
   const GKD_API_URL = "TU_URL_AQUI";
   ```

### Paso 2: Publicar en GitHub Pages

1. Sube el proyecto a un repositorio de GitHub
2. Ve a **Settings → Pages → Source: Deploy from branch → main / root**
3. La página estará disponible en `https://<tu-usuario>.github.io/<repo>/`

La página fetchea los datos frescos desde el Apps Script **cada vez que alguien la visita**.

---

## Fotos — Dónde ponerlas y cómo nombrarlas

### Pilotos (`assets/images/pilots/`)

Nombre: **alias del piloto en lowercase con guiones**, sin acentos.

| Alias en el sheet | Nombre del archivo |
|-------------------|--------------------|
| NICO E            | `nico-e.jpg`       |
| WIDOW             | `widow.jpg`        |
| PAJARITO          | `pajarito.jpg`     |
| JUAN CAMPOS       | `juan-campos.jpg`  |
| ILYAN30F          | `ilyan30f.jpg`     |
| JAVIER V          | `javier-v.jpg`     |
| ... (resto de pilotos) | mismo patrón |

Formato recomendado: JPG, proporción 1:1 (cuadrada), mínimo 300×300px.  
Si no hay foto, la web muestra automáticamente las iniciales del piloto sobre fondo oscuro.

### Equipos (`assets/images/teams/`)

Nombre: `<categoría>-<escudería-slug>.jpg`

| Equipo | Nombre del archivo |
|--------|--------------------|
| F1 — McLaren       | `f1-mclaren.jpg`       |
| F1 — Aston Martin  | `f1-aston-martin.jpg`  |
| F1 — Ferrari       | `f1-ferrari.jpg`       |
| F1 — Mercedes      | `f1-mercedes.jpg`      |
| F2 — Lotus         | `f2-lotus.jpg`         |
| F2 — Renault       | `f2-renault.jpg`       |
| ... (resto)        | mismo patrón           |

Formato recomendado: JPG, proporción 4:3, mínimo 400×300px.  
Si no hay foto, la web muestra el color oficial de la escudería como fondo.

### Logo (`assets/images/logo/`)

| Archivo | Uso |
|---------|-----|
| `gkd-logo.png` | Logo principal (navbar, hero, footer). Fondo transparente, mínimo 200×200px. |

---

## Driver of the Day (DOTD)

La hoja **DOTD** en el spreadsheet tiene las columnas:

| Fecha | Piloto | Categoría | Razón |
|-------|--------|-----------|-------|
| 22/03/2026 | NICO E | F1 Moderna | Mejor tiempo histórico del campeonato — 37.620s |
| 12/04/2026 | STEPHY | F1 Clásica | Primera victoria en carrera oficial |

- **Fecha**: formato DD/MM/YYYY
- **Categoría**: `F1 Moderna` o `F1 Clásica` (dropdown)
- **Razón**: texto libre, aparece en la web debajo del nombre del piloto

---

## Suplentes (Pilotos de refuerzo)

La hoja **Suplentes** registra pilotos que reemplazan a un titular en una fecha.  
Sus puntos cuentan para el equipo pero **no** para el ranking individual del piloto titular.

Columnas: `Fecha | Escudería | Suplente | Posición | Categoría | Puntos`  
Los puntos se calculan automáticamente según la posición y categoría.

---

## Sistema de desempate (Standings)

Si dos pilotos/equipos tienen los mismos puntos, el orden se determina por:

1. **Puntos Totales** — más puntos gana (principal)
2. **Pos Promedio** — menor promedio de posición gana (columna T / O)
3. **Mejor Tiempo en carrera oficial** — F1=Carrera 2, F2=Carrera 1 de fechas oficiales (columna U / P)

Actualizar las columnas de desempate tras cada carrera:
```bash
python standings.py --tiebreaker
```

---

## Sistema de puntos

| Posición | F1 Moderna | F1 Clásica |
|----------|-----------|-----------|
| 1°       | 16 pts    | 15 pts    |
| 2°       | 15 pts    | 14 pts    |
| ...      | ...       | ...       |
| 16°      | 1 pt      | —         |
| 15°      | —         | 1 pt      |
