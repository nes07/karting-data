/**
 * GKD Championship 2026 — app.js
 * ================================
 * Fetches live data from the Google Apps Script Web App and renders all sections.
 *
 * HOW TO SET UP:
 *   1. In Google Sheets → Extensions → Apps Script → paste APPS_SCRIPT.js
 *   2. Deploy → New deployment → Web App → Execute as: Me → Access: Anyone
 *   3. Copy the generated URL and paste it below as GKD_API_URL
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
// Replace this URL after deploying the Apps Script Web App.
const GKD_API_URL = "https://script.google.com/macros/s/AKfycbyzmktQeDF-2icJOXsrRQMb795ka020cYFDrKzcN9t3fJ8G2dPYCw37MTg8rsk0GWKe/exec";

// Image base paths (relative to index.html)
const IMG = {
  logo:   "assets/images/logo/gkd-logo.png",
  pilot:  (alias)            => `assets/images/pilots/${slugify(alias)}.jpg`,
  team:   (cat, escuderia)   => `assets/images/teams/${cat.toLowerCase()}-${slugify(escuderia)}.jpg`,
  logo_f1:(escuderia)        => `assets/images/logos/${slugify(escuderia)}.png`,
};

// Drive image lookup maps — populated in init() from data.drive_images
window._drivePilots = {};
window._driveTeams  = {};

/** Returns a Google Drive thumbnail URL for a given file ID. */
function driveThumb(fileId, size) {
  size = size || "w800";
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=${size}`;
}

// Constructor colors (mirrors APPS_SCRIPT.js CONSTRUCTOR_COLORS)
const CONSTRUCTOR_COLORS = {
  "McLaren":         { bg: "#EF8733", fg: "#000000" },
  "Red Bull":        { bg: "#4570C0", fg: "#FFFFFF" },
  "Mercedes":        { bg: "#75F1D3", fg: "#000000" },
  "Ferrari":         { bg: "#D52E37", fg: "#FFFFFF" },
  "Williams":        { bg: "#3267D4", fg: "#FFFFFF" },
  "Aston Martin":    { bg: "#4B9774", fg: "#FFFFFF" },
  "Alpine":          { bg: "#479FE2", fg: "#FFFFFF" },
  "Haas":            { bg: "#DFE1E2", fg: "#000000" },
  "Racing Bulls":    { bg: "#7091F8", fg: "#FFFFFF" },
  "Audi":            { bg: "#EB4526", fg: "#FFFFFF" },
  "Cadillac":        { bg: "#AAAADD", fg: "#000000" },
  "Lotus":           { bg: "#0B3D2E", fg: "#FFD700" },
  "Sauber":          { bg: "#003A8F", fg: "#FFFFFF" },
  "BMW":             { bg: "#0066B1", fg: "#FFFFFF" },
  "Renault":         { bg: "#FFD700", fg: "#000000" },
  "Arrows":          { bg: "#FF7A00", fg: "#000000" },
  "Benetton":        { bg: "#00A94F", fg: "#FFFFFF" },
  "Ferrari Classic": { bg: "#8B0000", fg: "#FFD700" },
  "Jaguar":          { bg: "#004225", fg: "#FFFFFF" },
  "Minardi":         { bg: "#1C1C1C", fg: "#FFD700" },
  "Brawn GP":        { bg: "#E6FF00", fg: "#000000" },
  "Brabham":         { bg: "#001A57", fg: "#FFFFFF" },
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  let then;
  const s = String(dateStr).trim();
  // DD/MM/YYYY (expected from Apps Script formatted dates)
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/").map(Number);
    then = new Date(y, m - 1, d);
  } else {
    // Full JS date string e.g. "Sun Apr 12 2026 00:00:00 GMT-0400 ..."
    then = new Date(s);
  }
  if (!then || isNaN(then.getTime())) return "—";
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days < 0)   return "—";
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7)   return `Hace ${days} días`;
  if (days < 14)  return "Hace 1 semana";
  if (days < 30)  return `Hace ${Math.floor(days / 7)} semanas`;
  if (days < 60)  return "Hace 1 mes";
  if (days < 365) return `Hace ${Math.floor(days / 30)} meses`;
  if (days < 730) return "Hace 1 año";
  return `Hace ${Math.floor(days / 365)} años`;
}

function navigateToStandings(type, name, category) {
  if (!category) return;
  // 1. Scroll to standings section
  document.getElementById("standings")?.scrollIntoView({ behavior: "smooth" });
  // 2. Activate the correct tab
  const tabId = type === "driver" ? `tab-ds-${category}` : `tab-ts-${category}`;
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.click();
  // 3. After the tab switch + scroll settle, find row and flash it
  setTimeout(() => {
    const rowId = type === "driver" ? `dr-${slugify(name)}` : `tm-${slugify(name)}`;
    const row = document.getElementById(rowId);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.remove("row-highlight");
    void row.offsetWidth; // force reflow to restart animation
    row.classList.add("row-highlight");
    setTimeout(() => row.classList.remove("row-highlight"), 2200);
  }, 450);
}

function initials(alias) {
  return alias.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtTime(t) {
  if (!t || t >= 999) return "—";
  return Number(t).toFixed(3);
}

function fmtPts(p) {
  if (p === null || p === undefined || p === "") return "—";
  return Number(p);
}

function rankBadge(rank) {
  if (rank === 1) return `<span class="rank-badge gold">${rank}</span>`;
  if (rank === 2) return `<span class="rank-badge silver">${rank}</span>`;
  if (rank === 3) return `<span class="rank-badge bronze">${rank}</span>`;
  return `<span class="rank-badge normal">${rank}</span>`;
}

function rowClass(rank) {
  if (rank === 1) return "rank-1";
  if (rank === 2) return "rank-2";
  if (rank === 3) return "rank-3";
  return "";
}

function constructorBadge(escuderia) {
  const c = CONSTRUCTOR_COLORS[escuderia] || { bg: "#333", fg: "#fff" };
  return `<span class="constructor-badge" style="background:${c.bg};color:${c.fg}">${escuderia}</span>`;
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h},40%,18%)`;
}

function pilotImgOrPlaceholder(alias, classes) {
  classes = classes || "";
  const slug    = slugify(alias);
  const driveEntry = window._drivePilots[slug];
  const src     = driveEntry ? driveThumb(driveEntry.id, "w400") : IMG.pilot(alias);
  const ini     = initials(alias);
  const color   = stringToColor(alias);
  return `
    <img src="${src}" alt="${alias}" class="${classes}"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="pilot-placeholder" style="display:none;background:${color}">${ini}</div>
  `;
}

function teamImgOrPlaceholder(cat, escuderia) {
  const slug       = slugify(escuderia);
  const driveEntry = window._driveTeams[slug];
  const src        = driveEntry ? driveThumb(driveEntry.id, "w600") : IMG.team(cat, escuderia);
  const c          = CONSTRUCTOR_COLORS[escuderia] || { bg: "#1a1d26", fg: "#fff" };
  return `
    <img src="${src}" alt="${escuderia}"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <div class="team-placeholder" style="display:none;background:linear-gradient(135deg,${c.bg}33,#12141a)">
      <span class="team-escuderia-label">${escuderia}</span>
    </div>
  `;
}

// ── COUNTDOWN ─────────────────────────────────────────────────────────────────
function startCountdown(raceDates) {
  const now = new Date();
  const upcoming = raceDates
    .map(r => ({ ...r, parsed: parseDate(r.date) }))
    .filter(r => r.parsed && r.parsed > now)
    .sort((a, b) => a.parsed - b.parsed);

  const nextRaceEl  = document.getElementById("next-race-info");
  const countdownEl = document.getElementById("countdown");

  if (!upcoming.length) {
    if (nextRaceEl) nextRaceEl.textContent = "Temporada completada";
    if (countdownEl) countdownEl.style.display = "none";
    return;
  }

  const next = upcoming[0];
  if (nextRaceEl) {
    nextRaceEl.innerHTML = `
      <div class="next-race-label">Próxima carrera</div>
      <div class="next-race-date">${next.month} — ${next.date}</div>
    `;
  }

  function tick() {
    const diff = next.parsed - new Date();
    if (diff <= 0) { startCountdown(raceDates); return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000)  / 60000);
    const s = Math.floor((diff % 60000)    / 1000);
    const upd = (id, val) => {
      const e = document.getElementById(id);
      if (e) e.textContent = String(val).padStart(2, "0");
    };
    upd("cd-days", d); upd("cd-hours", h); upd("cd-mins", m); upd("cd-secs", s);
  }
  tick();
  setInterval(tick, 1000);
}

function parseDate(str) {
  if (!str) return null;
  const [d, m, y] = str.split("/");
  if (!d || !m || !y) return null;
  return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
}

// ── PILOTS SECTION ────────────────────────────────────────────────────────────
function renderPilots(inscritos) {
  const container = document.getElementById("pilots-grid");
  if (!container) return;
  if (!inscritos || !inscritos.length) {
    container.innerHTML = `<div class="table-empty">No hay pilotos inscritos aún.</div>`;
    return;
  }
  container.innerHTML = inscritos.map(p => `
    <div class="pilot-card" data-pilot="${p.alias}" data-category="${p.category || ""}">
      ${pilotImgOrPlaceholder(p.alias)}
      <div class="pilot-overlay">
        <div class="pilot-name">${p.alias}</div>
        ${p.name && p.name !== p.alias ? `<div class="pilot-fullname">${p.name}</div>` : ""}
        <div class="overlay-nav-hint">Ver en Standings →</div>
      </div>
    </div>
  `).join("");
}

// ── TEAMS SECTION ─────────────────────────────────────────────────────────────
function renderTeams(f1Teams, f2Teams) {
  renderTeamCategory("teams-grid-f1", f1Teams, "f1");
  renderTeamCategory("teams-grid-f2", f2Teams, "f2");
}

function renderTeamCategory(containerId, teams, cat) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!teams || !teams.length) {
    container.innerHTML = `<div class="table-empty">Sin equipos registrados.</div>`;
    return;
  }
  const sorted = [...teams].sort((a, b) => (a.escuderia || "").localeCompare(b.escuderia || ""));
  container.innerHTML = sorted.map(t => {
    const c = CONSTRUCTOR_COLORS[t.escuderia] || { bg: "#666", fg: "#fff" };
    return `
      <div class="team-card" data-escuderia="${t.escuderia}" data-category="${cat}">
        ${teamImgOrPlaceholder(cat, t.escuderia)}
        <div class="team-color-bar" style="background:${c.bg}"></div>
        <div class="team-overlay">
          <div class="team-overlay-name">${t.escuderia}</div>
          <div class="team-overlay-pilots">${t.pilot1}<br>${t.pilot2 || "TBD"}</div>
          <span class="team-escuderia-badge" style="background:${c.bg};color:${c.fg}">
            ${cat.toUpperCase()}
          </span>
          <div class="overlay-nav-hint">Ver en Standings →</div>
        </div>
      </div>`;
  }).join("");
}

// ── PODIUM ────────────────────────────────────────────────────────────────────
/**
 * Renders a podium (P1/P2/P3) for a drivers standings or race results section.
 * @param {string} containerId  - element ID for .podium-wrap
 * @param {Array}  entries      - array of { name, pts, escuderia? }
 * @param {"driver"|"team"} type
 */
function renderPodium(containerId, entries, type = "driver") {
  const el = document.getElementById(containerId);
  if (!el) return;
  const top3 = entries.slice(0, 3);
  if (!top3.length) { el.style.display = "none"; return; }

  el.innerHTML = top3.map(e => {
    const pos = e.rank || e.pos;
    if (type === "team") {
      return podiumSlotTeam(pos, e);
    }
    return podiumSlotDriver(pos, e);
  }).join("");
}

function podiumSlotDriver(pos, e) {
  const name     = e.pilot || e.name || "";
  const esc      = e.escuderia || "";
  const c        = esc ? (CONSTRUCTOR_COLORS[esc] || { bg: "#444", fg: "#fff" }) : null;
  const pts      = e.total_pts !== undefined ? e.total_pts : (e.pts !== undefined ? e.pts : "");
  const ptsLabel = e.pts_label !== undefined ? e.pts_label : (pts !== "" ? `${pts} pts` : "");
  const imgUrl   = IMG.pilot(name);
  const ini      = initials(name);
  const color    = stringToColor(name);

  // Subtle constructor color glow at the base of the slot
  const slotStyle = c ? `--esc-color:${c.bg}` : "";
  // Constructor badge shown between name and pts
  const teamBadge = c
    ? `<span class="podium-team-tag" style="background:${c.bg};color:${c.fg}">${esc}</span>`
    : "";

  return `
    <div class="podium-slot" data-pos="${pos}" style="${slotStyle}">
      <div class="podium-img-wrap">
        <img class="podium-pilot-img" src="${imgUrl}" alt="${name}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="podium-placeholder" style="display:none;background:${color}">${ini}</div>
        <div class="podium-pos-badge">${pos}</div>
      </div>
      <div class="podium-name">${name}</div>
      ${teamBadge}
      <div class="podium-pts">${ptsLabel}</div>
      <div class="podium-pedestal">${pos}</div>
    </div>`;
}

function podiumSlotTeam(pos, t) {
  const escuderia = t.escuderia || t.team || "";
  const pts       = t.total_pts !== undefined ? t.total_pts : (t.pts !== undefined ? t.pts : "");
  const ptsLabel  = pts !== "" ? `${pts} pts` : "";
  const logoUrl   = IMG.logo_f1(escuderia);
  const c         = CONSTRUCTOR_COLORS[escuderia] || { bg: "#1a1d26", fg: "#fff" };

  const thumb1 = t.pilot1 ? `<img class="podium-pilot-thumb" src="${IMG.pilot(t.pilot1)}"
    alt="${t.pilot1}" onerror="this.style.display='none'">` : "";
  const thumb2 = t.pilot2 ? `<img class="podium-pilot-thumb" src="${IMG.pilot(t.pilot2)}"
    alt="${t.pilot2}" onerror="this.style.display='none'">` : "";

  return `
    <div class="podium-slot" data-pos="${pos}">
      <div class="podium-img-wrap" style="border-radius:12px">
        <img class="podium-team-logo" src="${logoUrl}" alt="${escuderia}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="podium-placeholder" style="display:none;background:${c.bg};border-radius:12px;
             font-size:0.7rem;letter-spacing:0.04em;color:${c.fg};text-align:center;padding:8px;
             font-family:'Microgramma','Exo 2',sans-serif;font-weight:700">${escuderia}</div>
        <div class="podium-pos-badge">${pos}</div>
      </div>
      <div class="podium-pilots-under">${thumb1}${thumb2}</div>
      <div class="podium-name">${escuderia}</div>
      <div class="podium-pts">${ptsLabel}</div>
      <div class="podium-pedestal">${pos}</div>
    </div>`;
}

// ── DRIVERS STANDINGS TABLE ───────────────────────────────────────────────────
function renderDriversTable(containerId, pilots, months) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!pilots || !pilots.length) {
    el.innerHTML = `<div class="table-empty">Aún no hay datos de standings.</div>`;
    return;
  }
  const raceCols = months.map(m =>
    `<th>${m.slice(0,3)}<br><span style="font-size:0.6rem;opacity:.6">Pos / Pts</span></th>`
  ).join("");
  const rows = pilots.map(p => {
    const raceCells = (p.races || []).map(r => {
      const hasPos = r.pos !== null && r.pos !== undefined;
      return `<td class="pos-cell ${hasPos ? "has-value" : ""}">
        ${hasPos ? `${r.pos} / ${r.pts ?? "—"}` : "—"}
      </td>`;
    }).join("");
    return `
      <tr id="dr-${slugify(p.pilot)}" data-pilot="${p.pilot}" class="${rowClass(p.rank)}">
        <td>${rankBadge(p.rank)}</td>
        <td class="pilot-cell">${p.pilot}</td>
        <td class="pts-total">${fmtPts(p.total_pts)}</td>
        ${raceCells}
        <td class="pts-small">${p.pos_prom !== null ? Number(p.pos_prom).toFixed(1) : "—"}</td>
      </tr>`;
  }).join("");
  el.innerHTML = `
    <div class="standings-table-wrap">
      <table class="standings-table">
        <thead>
          <tr><th>#</th><th>Piloto</th><th>Pts</th>${raceCols}<th>Prom</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── TEAM STANDINGS TABLE ──────────────────────────────────────────────────────
function renderTeamsTable(containerId, teams, months) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!teams || !teams.length) {
    el.innerHTML = `<div class="table-empty">Aún no hay datos de standings.</div>`;
    return;
  }
  const raceCols = months.map(m => `<th>${m.slice(0,3)}</th>`).join("");
  const rows = teams.map(t => {
    const monthCells = months.map(m => {
      const pts = t.months ? t.months[m] : null;
      return `<td class="pts-small">${pts !== null && pts !== undefined ? pts : "—"}</td>`;
    }).join("");
    return `
      <tr id="tm-${slugify(t.escuderia)}" data-escuderia="${t.escuderia}" class="${rowClass(t.rank)}">
        <td>${rankBadge(t.rank)}</td>
        <td class="pilot-cell">${t.team || t.escuderia}</td>
        <td>${constructorBadge(t.escuderia)}</td>
        <td class="pts-small">${t.pilot1}</td>
        <td class="pts-small">${t.pilot2 || "TBD"}</td>
        <td class="pts-total">${fmtPts(t.total_pts)}</td>
        ${monthCells}
      </tr>`;
  }).join("");
  el.innerHTML = `
    <div class="standings-table-wrap">
      <table class="standings-table">
        <thead>
          <tr><th>#</th><th>Equipo</th><th>Escudería</th>
          <th>Piloto 1</th><th>Piloto 2</th><th>Pts</th>${raceCols}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── VUELTA RÁPIDA TABLE ───────────────────────────────────────────────────────
function renderVueltaRapida(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!data || !data.length) {
    el.innerHTML = `<div class="table-empty">Aún no hay datos de vuelta rápida.</div>`;
    return;
  }
  const rows = data.map((r, i) => {
    const stateClass = r.variation === null ? "vr-new"
      : r.variation > 0  ? "vr-up-up"
      : r.variation < 0  ? "vr-down"
      : "vr-neutral";
    const deltaStr = r.variation === null ? "★ Nuevo"
      : r.variation > 0  ? `▲ ${r.variation}`
      : r.variation === 0 ? "↔ —"
      : `▼ ${Math.abs(r.variation)}`;
    return `
      <tr class="${rowClass(i + 1)} ${stateClass}">
        <td>${rankBadge(i + 1)}</td>
        <td class="pilot-cell">${r.pilot}</td>
        <td class="time-cell ${i === 0 ? "best" : ""}">${fmtTime(r.time)}</td>
        <td class="vr-delta" style="font-weight:600">${deltaStr}</td>
        <td class="pts-small" title="${r.date || ""}">${timeAgo(r.date)}</td>
      </tr>`;
  }).join("");
  el.innerHTML = `
    <div class="standings-table-wrap">
      <table class="standings-table">
        <thead>
          <tr><th>#</th><th>Piloto</th><th>Mejor Tiempo</th><th>Variación</th><th>Récord</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="vr-legend">
      <span class="vr-legend-item vr-up-up">Mejoró posición</span>
      <span class="vr-legend-item vr-down">Perdió posición</span>
      <span class="vr-legend-item vr-new">Piloto nuevo</span>
      <span class="vr-legend-item vr-neutral">Sin variación</span>
    </div>`;
}

// ── RACE RESULTS SECTION ──────────────────────────────────────────────────────
/**
 * Renders the Race Results section.
 * data.race_results = [
 *   { month: "Marzo", date: "22/03/2026",
 *     f1: [ { pos, pilot, escuderia, pts, best_time }, … ],
 *     f2: [ { pos, pilot, escuderia, pts, best_time }, … ]
 *   }, …
 * ]
 */
function renderRaceResults(raceResults) {
  const navEl    = document.getElementById("results-tabs-nav");
  const panelsEl = document.getElementById("results-panels");
  if (!navEl || !panelsEl) return;

  const races = (raceResults || []).filter(r => (r.f1 && r.f1.length) || (r.f2 && r.f2.length));

  if (!races.length) {
    navEl.innerHTML = "";
    panelsEl.innerHTML = `<div class="tab-panel active" role="tabpanel">
      <div class="table-empty">Los resultados aparecerán aquí después de la primera fecha.</div>
    </div>`;
    return;
  }

  navEl.innerHTML = races.map((r, i) =>
    `<button class="tab-btn ${i === 0 ? "active" : ""}"
       data-tab="rr-panel-${i}" role="tab">Fecha ${i+1} — ${r.month}</button>`
  ).join("");

  panelsEl.innerHTML = races.map((r, i) => {
    const f1Block = raceResultsCategory("F1 Moderna",  r.f1 || [], i, "f1");
    const f2Block = raceResultsCategory("F1 Clásica",  r.f2 || [], i, "f2");
    return `
      <div id="rr-panel-${i}" class="tab-panel ${i === 0 ? "active" : ""}" role="tabpanel">
        ${f1Block}
        ${f2Block}
      </div>`;
  }).join("");

  // Wire up the new tabs
  navEl.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      navEl.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      panelsEl.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });
}

function raceResultsCategory(label, entries, raceIdx, cat) {
  if (!entries || !entries.length) return "";

  const top3  = entries.slice(0, 3);
  const rest  = entries.slice(3);

  const podiumSlots = top3.map(e => podiumSlotDriver(e.pos, {
    pilot:     e.pilot,
    escuderia: e.escuderia || "",
    pts:       e.pts,
    rank:      e.pos,
  })).join("");

  const restRows = rest.map(e => `
    <tr class="${rowClass(e.pos)}">
      <td>${rankBadge(e.pos)}</td>
      <td class="pilot-cell">${e.pilot}</td>
      <td>${constructorBadge(e.escuderia || "")}</td>
      <td class="pts-total">${e.pts !== undefined ? e.pts : "—"}</td>
      <td class="time-cell">${fmtTime(e.best_time)}</td>
    </tr>`).join("");

  const restTable = rest.length ? `
    <div class="standings-table-wrap">
      <table class="standings-table">
        <thead>
          <tr><th>#</th><th>Piloto</th><th>Escudería</th><th>Pts</th><th>Mejor Tiempo</th></tr>
        </thead>
        <tbody>${restRows}</tbody>
      </table>
    </div>` : "";

  return `
    <div class="race-sub-heading">${label}</div>
    <div class="podium-wrap" style="padding-top:32px">${podiumSlots}</div>
    ${restTable}`;
}

// ── DOTD SECTION ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// MEDIA SECTION
// ─────────────────────────────────────────────────────────────────────────────

/** Extract YouTube video ID from any youtube.com or youtu.be URL */
function ytIdFromUrl(url) {
  const m =
    url.match(/youtu\.be\/([^?&/]+)/) ||
    url.match(/[?&]v=([^?&/]+)/)      ||
    url.match(/\/embed\/([^?&/]+)/);
  return m ? m[1] : null;
}

/** Extract Google Drive file ID from a drive.google.com share URL */
function driveIdFromUrl(url) {
  const m = url.match(/\/d\/([^/?&]+)/);
  return m ? m[1] : null;
}

const PHOTO_PLACEHOLDER_LABELS = [
  { label: "Fecha 1 — Marzo 2026",     icon: "📸" },
  { label: "Fecha 2 — Abril 2026",     icon: "🏁" },
  { label: "Fecha 3 — Mayo 2026",      icon: "🎬" },
  { label: "Próximamente...",          icon: "⏳" },
];

function renderPhotoCarousel(fotos) {
  const carousel = document.getElementById("media-carousel");
  const wrap     = document.getElementById("media-gallery-wrap");
  if (!carousel) return;
  if (wrap) wrap.style.display = "";

  if (!fotos || !fotos.length) {
    // Show placeholder slides
    carousel.innerHTML = PHOTO_PLACEHOLDER_LABELS.map(p => `
      <div class="media-photo-slide media-photo-placeholder-slide">
        <div class="media-placeholder-inner">
          <span class="media-placeholder-icon">${p.icon}</span>
          <span class="media-placeholder-label">${p.label}</span>
          <span class="media-placeholder-sub">Las fotos aparecerán aquí</span>
        </div>
      </div>`).join("");
  } else {
    carousel.innerHTML = fotos.map(f => {
      // Prefer _driveId (set by renderMedia for Drive entries), then extract from URL
      const fileId = f._driveId || driveIdFromUrl(f.url);
      const imgSrc = fileId ? driveThumb(fileId, "w1200") : f.url;
      return `
        <div class="media-photo-slide">
          <a href="${f.url}" target="_blank" rel="noopener">
            <img src="${imgSrc}" alt="${f.titulo}" loading="lazy"
                 onerror="this.style.display='none'">
          </a>
          <div class="media-photo-caption">
            <span>${f.titulo}</span>
            <span class="caption-date">${f.fecha}</span>
          </div>
        </div>`;
    }).join("");
  }

  // Arrow nav
  const prev = document.getElementById("media-nav-prev");
  const next = document.getElementById("media-nav-next");
  const slideW = () => (carousel.querySelector(".media-photo-slide")?.offsetWidth || 340) + 16;
  if (prev && next) {
    prev.addEventListener("click", () => carousel.scrollBy({ left: -slideW(), behavior: "smooth" }));
    next.addEventListener("click", () => carousel.scrollBy({ left:  slideW(), behavior: "smooth" }));
  }

  // Auto-scroll every 4 s
  let autoTimer = setInterval(() => {
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    if (carousel.scrollLeft >= maxScroll - 8) {
      carousel.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      carousel.scrollBy({ left: slideW(), behavior: "smooth" });
    }
  }, 4000);

  // Pause auto-scroll on user interaction
  carousel.addEventListener("pointerdown", () => clearInterval(autoTimer), { once: true });
}

const YT_ICON_SVG = `
  <svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M66.5 7.7a8.5 8.5 0 0 0-5.9-6C55.3.5 34 .5 34 .5s-21.3 0-26.6 1.2a8.5 8.5 0 0 0-5.9 6C.3 13.1.3 24 .3 24s0 10.9 1.2 16.3a8.5 8.5 0 0 0 5.9 6C12.7 47.5 34 47.5 34 47.5s21.3 0 26.6-1.2a8.5 8.5 0 0 0 5.9-6C67.7 34.9 67.7 24 67.7 24s0-10.9-1.2-16.3z" fill="#ff0000"/>
    <path d="M27 34l17.5-10L27 14v20z" fill="#fff"/>
  </svg>`;

const IG_ICON_SVG = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="none"/>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="white"/>
  </svg>`;

function renderVideoGrid(videos) {
  const grid = document.getElementById("media-video-grid");
  const wrap  = document.getElementById("media-videos-wrap");
  if (!grid) return;
  if (wrap) wrap.style.display = "";

  if (!videos || !videos.length) {
    grid.innerHTML = `
      <div class="media-video-placeholder">
        <div class="media-yt-placeholder-thumb"><div class="media-yt-badge">${YT_ICON_SVG}</div></div>
        <div class="media-video-body">
          <div class="media-video-title">Highlights Fecha 1</div>
          <div class="media-video-date">Próximamente</div>
          <div class="media-video-cta media-video-cta-dim">Ver video →</div>
        </div>
      </div>
      <div class="media-video-placeholder">
        <div class="media-ig-thumb">${IG_ICON_SVG}</div>
        <div class="media-video-body">
          <div class="media-video-title">Reel Oficial GKD</div>
          <div class="media-video-date">Próximamente</div>
          <div class="media-video-cta media-video-cta-dim">Ver en Instagram →</div>
        </div>
      </div>`;
    return;
  }

  grid.innerHTML = videos.map(v => {
    if (v.tipo === "YouTube") {
      const vid    = ytIdFromUrl(v.url);
      const thumb  = vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : "";
      return `
        <a class="media-video-card media-yt-card" href="${v.url}" target="_blank" rel="noopener">
          <div class="media-video-thumb">
            ${thumb
              ? `<img src="${thumb}" alt="${v.titulo}" loading="lazy">`
              : `<div style="width:100%;height:100%;background:#111"></div>`}
            <div class="media-yt-badge">${YT_ICON_SVG}</div>
          </div>
          <div class="media-video-body">
            <div class="media-video-title">${v.titulo}</div>
            <div class="media-video-date">${v.fecha}</div>
            <div class="media-video-cta">Ver video →</div>
          </div>
        </a>`;
    } else {
      // Instagram
      return `
        <a class="media-video-card media-ig-card" href="${v.url}" target="_blank" rel="noopener">
          <div class="media-ig-thumb">${IG_ICON_SVG}</div>
          <div class="media-video-body">
            <div class="media-video-title">${v.titulo}</div>
            <div class="media-video-date">${v.fecha}</div>
            <div class="media-video-cta">Ver en Instagram →</div>
          </div>
        </a>`;
    }
  }).join("");
}

/**
 * @param {Array}  sheetMedia  - entries from the "Media" Google Sheet
 * @param {Array}  driveMedia  - entries from data.drive_images.media
 *                               [ { folder: "Fecha 2 [2026-04-12]", files: [{id, name}] }, … ]
 */
function renderMedia(sheetMedia, driveMedia) {
  // Convert Drive folder files into Foto entries
  const driveFotos = (driveMedia || []).flatMap(group => {
    // Try to extract a date from the folder name, e.g. "Fecha 2 [2026-04-12]"
    const dateMatch = group.folder.match(/(\d{4}-\d{2}-\d{2})/);
    const fecha     = dateMatch
      ? dateMatch[1].split("-").reverse().join("/")  // → "12/04/2026"
      : "";
    // Sort files alphabetically for consistent order
    return [...group.files].sort((a, b) => a.name.localeCompare(b.name)).map(f => ({
      tipo:     "Foto",
      titulo:   group.folder,
      url:      `https://drive.google.com/file/d/${f.id}/view`,
      fecha:    fecha,
      _driveId: f.id,
    }));
  });

  // Sheet-based Foto entries first, then Drive entries
  const sheetFotos = (sheetMedia || []).filter(m => m.tipo === "Foto");
  const fotos      = [...sheetFotos, ...driveFotos];
  const videos     = (sheetMedia  || []).filter(m => m.tipo === "YouTube" || m.tipo === "Instagram");

  // Always show the section (placeholders when empty)
  const section = document.getElementById("media");
  if (section) section.style.display = "";

  renderPhotoCarousel(fotos);
  renderVideoGrid(videos);
}

function renderDotd(dotdData) {
  const container = document.getElementById("dotd-timeline");
  if (!container) return;
  if (!dotdData || !dotdData.length) {
    container.innerHTML = `
      <div class="dotd-empty">
        El primer Driver of the Day se anunciará al finalizar la primera carrera.
      </div>`;
    return;
  }
  const sorted = [...dotdData].sort((a, b) => {
    const da = parseDate(a.date), db = parseDate(b.date);
    return (db || 0) - (da || 0);
  });
  container.innerHTML = sorted.map(d => `
    <div class="dotd-card">
      <div class="dotd-photo">
        <img src="${IMG.pilot(d.pilot)}" alt="${d.pilot}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="dotd-photo-placeholder" style="display:none">${initials(d.pilot)}</div>
      </div>
      <div class="dotd-body">
        <div class="dotd-meta">
          <span class="dotd-date">${d.date}</span>
          <span class="dotd-category">${d.category || ""}</span>
        </div>
        <div class="dotd-pilot-name">${d.pilot}</div>
        <div class="dotd-trophy">
          <span class="dotd-award-icon">🏆</span>${d.reason || "Driver of the Day"}
        </div>
      </div>
    </div>
  `).join("");
}

// ── CARD TAPS (mobile hover fallback + navigation) ───────────────────────────
function initCardTaps(pilotCategoryMap) {
  pilotCategoryMap = pilotCategoryMap || {};

  // Detect touch device: no hover capability → mobile tap mode
  const isTouch = window.matchMedia("(hover: none)").matches;

  function getCardNav(card) {
    if (card.classList.contains("pilot-card")) {
      const pilot    = card.dataset.pilot    || "";
      const category = card.dataset.category || pilotCategoryMap[pilot] || "";
      return { type: "driver", name: pilot, category };
    }
    if (card.classList.contains("team-card")) {
      return { type: "team", name: card.dataset.escuderia || "", category: card.dataset.category || "" };
    }
    return null;
  }

  function setupContainer(containerId, cardSel) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener("click", e => {
      const card = e.target.closest(cardSel);

      // Tap outside a card → close all
      if (!card) {
        container.querySelectorAll(`${cardSel}.active`).forEach(c => c.classList.remove("active"));
        return;
      }
      e.stopPropagation();

      const isActive = card.classList.contains("active");

      if (isTouch) {
        // Mobile: 1st tap shows overlay, 2nd tap navigates
        container.querySelectorAll(`${cardSel}.active`).forEach(c => c.classList.remove("active"));
        if (!isActive) {
          card.classList.add("active");
        } else {
          // 2nd tap → navigate
          const nav = getCardNav(card);
          if (nav) navigateToStandings(nav.type, nav.name, nav.category);
        }
      } else {
        // Desktop: single click navigates directly (hover already shows overlay)
        const nav = getCardNav(card);
        if (nav) navigateToStandings(nav.type, nav.name, nav.category);
      }
    });
  }

  setupContainer("pilots-grid",   ".pilot-card");
  setupContainer("teams-grid-f1", ".team-card");
  setupContainer("teams-grid-f2", ".team-card");

  // Tap anywhere outside grids closes all active cards
  document.addEventListener("click", () => {
    document.querySelectorAll(".pilot-card.active, .team-card.active")
      .forEach(c => c.classList.remove("active"));
  });
}

// ── TABS ──────────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.closest(".tabs-wrapper");
      group.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      group.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });
}

// ── NAVBAR ────────────────────────────────────────────────────────────────────
function initNavbar() {
  const burger = document.getElementById("navbar-burger");
  const links  = document.getElementById("navbar-links");
  if (burger && links) {
    burger.addEventListener("click", () => links.classList.toggle("open"));
    links.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => links.classList.remove("open"));
    });
  }
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".navbar-links a[href^='#']");
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(a => a.classList.remove("active"));
        const active = document.querySelector(`.navbar-links a[href="#${entry.target.id}"]`);
        if (active) active.classList.add("active");
      }
    });
  }, { threshold: 0.35 });
  sections.forEach(s => obs.observe(s));
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const LOADING_IDS = [
  "pilots-grid", "teams-grid-f1", "teams-grid-f2",
  "standings-ds-f1", "standings-ds-f2",
  "standings-ts-f1", "standings-ts-f2",
  "standings-vr", "dotd-timeline",
];

function setLoading(msg = "Cargando datos...") {
  LOADING_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>${msg}</span></div>`;
  });
  const resultsPanel = document.getElementById("results-panels");
  if (resultsPanel) resultsPanel.innerHTML = `<div class="tab-panel active" role="tabpanel">
    <div class="loading-state"><div class="spinner"></div><span>${msg}</span></div>
  </div>`;
}

function setError() {
  LOADING_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="error-state">Error al cargar datos. Verifica la URL del API.</div>`;
  });
}

async function init() {
  initNavbar();
  initTabs();
  initCardTaps({});
  setLoading();

  if (!GKD_API_URL || GKD_API_URL.includes("YOUR_APPS_SCRIPT")) {
    const notice = document.getElementById("config-notice");
    if (notice) notice.style.display = "block";
    startCountdown([
      { month: "Marzo",      date: "22/03/2026" },
      { month: "Abril",      date: "12/04/2026" },
      { month: "Mayo",       date: "17/05/2026" },
      { month: "Junio",      date: "14/06/2026" },
      { month: "Julio",      date: "12/07/2026" },
      { month: "Agosto",     date: "16/08/2026" },
      { month: "Septiembre", date: "27/09/2026" },
      { month: "Octubre",    date: "18/10/2026" },
    ]);
    renderMedia([]);
    return;
  }

  try {
    const resp = await fetch(GKD_API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const months = data.race_months || [
      "Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre"
    ];

    // Populate Drive image lookup maps before any rendering
    const DI = data.drive_images || { pilots: {}, teams: {}, media: [] };
    window._drivePilots = DI.pilots || {};
    window._driveTeams  = DI.teams  || {};

    // Debug: warn in console for any pilot without a Drive photo
    (data.inscritos || []).forEach(p => {
      if (!window._drivePilots[slugify(p.alias)])
        console.info(`[GKD Drive] No photo for pilot: "${p.alias}" (slug: "${slugify(p.alias)}")`);
    });

    // Countdown
    startCountdown(data.race_dates || []);

    // Build pilot → category lookup (f1 / f2)
    const pilotCategoryMap = {};
    (data.equipos_f1 || []).forEach(t => {
      if (t.pilot1) pilotCategoryMap[t.pilot1] = "f1";
      if (t.pilot2) pilotCategoryMap[t.pilot2] = "f1";
    });
    (data.equipos_f2 || []).forEach(t => {
      if (t.pilot1) pilotCategoryMap[t.pilot1] = "f2";
      if (t.pilot2) pilotCategoryMap[t.pilot2] = "f2";
    });

    // Enrich inscritos with category for card navigation
    const inscritosWithCat = (data.inscritos || []).map(p => ({
      ...p, category: pilotCategoryMap[p.alias] || "",
    }));

    // Pilots & Teams
    renderPilots(inscritosWithCat);
    renderTeams(data.equipos_f1, data.equipos_f2);
    initCardTaps(pilotCategoryMap);

    // Build pilot → escudería lookup from Equipos for podium badges
    const escuderiaMap = {};
    [...(data.equipos_f1 || []), ...(data.equipos_f2 || [])].forEach(t => {
      if (t.pilot1) escuderiaMap[t.pilot1] = t.escuderia;
      if (t.pilot2) escuderiaMap[t.pilot2] = t.escuderia;
    });
    const withEsc = arr => (arr || []).map(d => ({
      ...d, escuderia: d.escuderia || escuderiaMap[d.pilot] || "",
    }));

    // Standings — podium + table
    renderPodium("podium-ds-f1", withEsc(data.drivers_f1), "driver");
    renderDriversTable("standings-ds-f1", data.drivers_f1, months);

    renderPodium("podium-ds-f2", withEsc(data.drivers_f2), "driver");
    renderDriversTable("standings-ds-f2", data.drivers_f2, months);

    renderPodium("podium-ts-f1", data.teams_f1 || [], "team");
    renderTeamsTable("standings-ts-f1", data.teams_f1, months);

    renderPodium("podium-ts-f2", data.teams_f2 || [], "team");
    renderTeamsTable("standings-ts-f2", data.teams_f2, months);

    // VR podium — show time as label instead of pts
    renderPodium("podium-vr", (data.vuelta_rapida || []).slice(0, 3).map((r, i) => ({
      rank:      r.rank || (i + 1),
      pilot:     r.pilot,
      escuderia: escuderiaMap[r.pilot] || "",
      total_pts: null,
      pts_label: r.time ? fmtTime(r.time) : "",
    })), "driver");
    renderVueltaRapida("standings-vr", data.vuelta_rapida);

    // Race Results
    renderRaceResults(data.race_results || []);

    // Media
    renderMedia(data.media || [], DI.media || []);

    // DOTD
    renderDotd(data.dotd);

    // Last updated
    if (data.updated_at) {
      const d = new Date(data.updated_at);
      document.querySelectorAll(".last-updated").forEach(el => {
        el.textContent = `Actualizado: ${d.toLocaleString("es-CL")}`;
      });
    }
  } catch (err) {
    console.error("GKD API error:", err);
    setError();
  }
}

document.addEventListener("DOMContentLoaded", init);
