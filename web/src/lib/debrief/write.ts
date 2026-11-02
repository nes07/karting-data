import type { Category } from "@/lib/scoring/types";
import { formatPositionsGained } from "@/lib/positions-gained";
import type {
  CatFacts,
  DebriefArticle,
  DebriefFacts,
  DebriefSection,
  ResultFact,
} from "./types";

export type ArticleSource = "llm" | "template";

const CAT_NAME: Record<Category, string> = {
  F1: "F1 Moderna",
  F2: "F1 Clásica",
};

function fmtTime(t: number | null): string {
  return t == null ? "sin tiempo" : t.toFixed(3);
}

function joined(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function raceParagraph(cat: CatFacts): string | null {
  const w = cat.winner;
  if (!w) return null;
  const grid =
    w.grid != null
      ? w.grid === 1
        ? "Desde la pole"
        : `Salió ${w.grid}º`
      : "Sin dato de grilla";
  const gained =
    w.gained != null && w.gained !== 0
      ? ` y cerró con ${formatPositionsGained(w.gained)} posiciones`
      : "";
  return `${w.alias} (${w.escuderia}) se quedó con la Round en ${CAT_NAME[cat.category]}. ${grid}${gained}. Mejor vuelta ${fmtTime(w.time)}.`;
}

function podiumParagraph(cat: CatFacts): string | null {
  if (cat.podium.length < 2) return null;
  const bits = cat.podium.map((p) => `P${p.pos} ${p.alias}`);
  return `El podio: ${joined(bits)}.`;
}

function swingParagraph(cat: CatFacts): string | null {
  const parts: string[] = [];
  if (cat.gainers[0]) {
    const g = cat.gainers[0];
    parts.push(
      `La remontada de la tarde fue de ${g.alias}: salió ${g.grid}º y terminó P${g.pos} (${formatPositionsGained(g.gained)}).`
    );
  }
  if (cat.losers[0]) {
    const l = cat.losers[0];
    parts.push(
      `${l.alias} pagó caro el domingo: de ${l.grid}º en la grilla a P${l.pos} (${formatPositionsGained(l.gained)}).`
    );
  }
  return parts.length ? parts.join(" ") : null;
}

function formParagraph(cat: CatFacts): string | null {
  const parts: string[] = [];
  for (const f of cat.formUp.slice(0, 2)) {
    parts.push(
      `${f.alias} llegó P${f.thisPos}, claramente por encima de su promedio oficial (${f.avgPos} en ${f.racesBefore} fechas).`
    );
  }
  for (const f of cat.formDown.slice(0, 2)) {
    parts.push(
      `${f.alias} se fue a P${f.thisPos}, lejos de su media de ${f.avgPos}. Día para olvidar.`
    );
  }
  return parts.length ? parts.join(" ") : null;
}

function battleParagraphs(battles: CatFacts["battles"]): string[] {
  if (battles.length === 0) return [];
  return battles.slice(0, 3).map((b) => `${b.a} vs ${b.b}: ${b.note}`);
}

function catSections(cat: CatFacts): DebriefSection[] {
  if (!cat.winner) return [];
  const raceParas = [raceParagraph(cat), podiumParagraph(cat), swingParagraph(cat)].filter(
    (p): p is string => Boolean(p)
  );
  const form = formParagraph(cat);
  const champ = [
    cat.drivers[0]
      ? `En el campeonato de ${CAT_NAME[cat.category]}, ${cat.drivers[0].alias} manda con ${cat.drivers[0].pts} pts.`
      : null,
    ...battleParagraphs(cat.battles),
    cat.teams[0]
      ? `En constructores, ${cat.teams[0].alias} lidera con ${cat.teams[0].pts} pts.`
      : null,
    ...battleParagraphs(cat.teamBattles),
  ].filter((p): p is string => Boolean(p));

  const mentions = [
    cat.winner.alias,
    ...cat.podium.map((p) => p.alias),
    ...cat.gainers.slice(0, 2).map((p) => p.alias),
    ...cat.formUp.slice(0, 2).map((p) => p.alias),
    ...cat.formDown.slice(0, 1).map((p) => p.alias),
    ...cat.drivers.slice(0, 3).map((p) => p.alias),
  ];

  const sections: DebriefSection[] = [
    {
      heading: `${CAT_NAME[cat.category]} — la carrera`,
      paragraphs: raceParas,
      mentions,
    },
  ];
  if (form) {
    sections.push({
      heading: `${CAT_NAME[cat.category]} — forma`,
      paragraphs: [form],
      mentions: [...cat.formUp, ...cat.formDown].map((f) => f.alias),
    });
  }
  if (champ.length) {
    sections.push({
      heading: `${CAT_NAME[cat.category]} — el campeonato`,
      paragraphs: champ,
      mentions: [
        ...cat.drivers.slice(0, 4).map((d) => d.alias),
        ...cat.teams.slice(0, 3).map((t) => t.alias),
      ],
    });
  }
  return sections;
}

function vrSection(facts: DebriefFacts): DebriefSection | null {
  const paras: string[] = [];
  if (facts.vr.big.length) {
    const bits = facts.vr.big.slice(0, 4).map((m) => {
      if (m.from == null) {
        return `${m.alias} entra al ranking de VR en el P${m.to} (${m.time.toFixed(3)})`;
      }
      const dir = (m.deltaRank ?? 0) > 0 ? "sube" : "baja";
      return `${m.alias} ${dir} del P${m.from} al P${m.to} (${m.time.toFixed(3)})`;
    });
    paras.push(`Los saltos grandes de Vuelta Rápida: ${bits.join("; ")}.`);
  }
  if (facts.vr.small.length) {
    paras.push(
      `Movimientos de un puesto, para el registro: ${facts.vr.small
        .slice(0, 6)
        .map((m) => `${m.alias} P${m.from}→P${m.to}`)
        .join(", ")}.`
    );
  }
  if (!paras.length) return null;
  return {
    heading: "Vuelta Rápida",
    paragraphs: paras,
    mentions: [...facts.vr.big, ...facts.vr.small].map((m) => m.alias),
  };
}

function featuredOf(facts: DebriefFacts): string[] {
  const names = [
    facts.F1.winner?.alias,
    facts.F2.winner?.alias,
    ...facts.F1.podium.map((p) => p.alias),
    ...facts.F2.podium.map((p) => p.alias),
    facts.F1.gainers[0]?.alias,
    facts.F2.gainers[0]?.alias,
    ...facts.vr.big.slice(0, 3).map((m) => m.alias),
  ].filter((n): n is string => Boolean(n));
  return [...new Set(names)].slice(0, 8);
}

export function writeTemplateArticle(facts: DebriefFacts): DebriefArticle {
  const w1 = facts.F1.winner?.alias;
  const w2 = facts.F2.winner?.alias;
  const winners =
    w1 && w2 ? `${w1} y ${w2}` : w1 ?? w2 ?? "el pelotón";
  const title = `Round ${facts.roundNumber}: ${facts.monthLabel} — ${winners} mandan`;
  const excerpt = [
    raceParagraph(facts.F1),
    raceParagraph(facts.F2),
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 280);

  const sections = [
    ...catSections(facts.F1),
    ...catSections(facts.F2),
    vrSection(facts),
  ].filter((s): s is DebriefSection => s != null && s.paragraphs.length > 0);

  return { title, excerpt, sections, featured: featuredOf(facts) };
}

export function parseArticle(raw: unknown): DebriefArticle | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== "string" || !o.title.trim()) return null;
  if (typeof o.excerpt !== "string") return null;
  if (!Array.isArray(o.sections)) return null;
  const sections: DebriefSection[] = [];
  for (const s of o.sections) {
    if (!s || typeof s !== "object") continue;
    const sec = s as Record<string, unknown>;
    if (typeof sec.heading !== "string") continue;
    const paragraphs = Array.isArray(sec.paragraphs)
      ? sec.paragraphs.filter((p) => typeof p === "string" && p.trim())
      : [];
    if (!paragraphs.length) continue;
    const mentions = Array.isArray(sec.mentions)
      ? sec.mentions.filter((m) => typeof m === "string")
      : [];
    sections.push({ heading: sec.heading, paragraphs, mentions });
  }
  if (!sections.length) return null;
  const featured = Array.isArray(o.featured)
    ? o.featured.filter((m) => typeof m === "string")
    : [];
  return {
    title: o.title.trim(),
    excerpt: o.excerpt.trim(),
    sections,
    featured,
  };
}

const LLM_INSTRUCTIONS = `Eres el cronista oficial del GKD Championship (karting indoor, Chile).
Escribe un debrief en español de una fecha oficial. Tono: crónica deportiva, directo, sin relleno, sin emojis.
REGLAS:
- Usa SOLO los números y nombres del JSON de hechos. No inventes tiempos, posiciones ni puntos.
- Destaca remontadas de 2+ puestos, batallas de campeonato que se achican o se abren, y saltos grandes de Vuelta Rápida (2+ puestos o debut en el top 20).
- Los +1/−1 de VR se mencionan al final, de pasada.
- Si alguien termina 3+ puestos mejor o peor que su promedio oficial, dilo.
- 4 a 7 secciones. Párrafos cortos (2–4 oraciones).
- featured: 4 a 8 alias clave (ganadores, podio, héroe de la remontada, VR).
Responde SOLO un JSON con forma:
{"title":"...","excerpt":"...","sections":[{"heading":"...","paragraphs":["..."],"mentions":["ALIAS"]}],"featured":["ALIAS"]}`;

export async function writeArticleWithLlm(
  facts: DebriefFacts,
  apiKey: string
): Promise<DebriefArticle | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: LLM_INSTRUCTIONS },
        {
          role: "user",
          content: JSON.stringify(facts),
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return parseArticle(JSON.parse(content));
  } catch {
    return null;
  }
}

export async function writeDebriefArticle(
  facts: DebriefFacts
): Promise<{ article: DebriefArticle; source: ArticleSource }> {
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    try {
      const llm = await writeArticleWithLlm(facts, key);
      if (llm) return { article: llm, source: "llm" };
    } catch {
      // fall through to template
    }
  }
  return { article: writeTemplateArticle(facts), source: "template" };
}

/** Kept for tests that want to inspect quali-vs-race lines. */
export function qualiVsRaceLine(r: ResultFact): string | null {
  if (r.gained == null || r.grid == null) return null;
  return `${r.alias}: grilla ${r.grid} → P${r.pos} (${formatPositionsGained(r.gained)})`;
}
