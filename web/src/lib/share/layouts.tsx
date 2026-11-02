/**
 * Satori/ImageResponse layouts for shareable PNGs (Instagram story & post).
 * Satori rules: flexbox only, inline styles, explicit display:flex on
 * multi-child divs. Photos must be absolute URLs.
 */
import type { CSSProperties, ReactNode } from "react";
import { CONSTRUCTOR_COLORS } from "@/lib/constants";
import type { DebriefShare } from "./debrief";
import type {
  DriverProfileShare,
  RoundShare,
  ShareFormat,
  ShareRow,
  StandingsShare,
} from "./data";
import { SHARE_SIZES } from "./data";

const C = {
  bg: "#0a0a0e",
  card: "#12141a",
  card2: "#1a1d26",
  border: "rgba(255,255,255,0.10)",
  red: "#E8192C",
  gold: "#C9A84C",
  goldLight: "#e8c56b",
  silver: "#a8a8a8",
  bronze: "#cd7f32",
  white: "#f0f0f0",
  gray: "#8a8f9e",
  grayLight: "#c0c4d0",
};

const HEAD = "Microgramma";
const BODY = "Inter";

const SITE_URL = "gkd-racing.cl";
const HASHTAG = "#NEWERA2026";

function ringColor(rank: number): string {
  if (rank === 1) return C.gold;
  if (rank === 2) return C.silver;
  if (rank === 3) return C.bronze;
  return C.border;
}

function badgeColors(rank: number): { bg: string; fg: string } {
  if (rank === 1) return { bg: C.gold, fg: "#000" };
  if (rank === 2) return { bg: "#c0c0c0", fg: "#000" };
  if (rank === 3) return { bg: C.bronze, fg: "#fff" };
  return { bg: "#262a34", fg: C.grayLight };
}

function rowTint(rank: number, highlighted: boolean): string {
  if (highlighted) return "rgba(232,25,44,0.14)";
  if (rank === 1) return "rgba(201,168,76,0.12)";
  if (rank === 2) return "rgba(192,192,192,0.08)";
  if (rank === 3) return "rgba(180,100,40,0.10)";
  return "rgba(255,255,255,0.02)";
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function placeholderColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360},40%,22%)`;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function VarBadge({ v, fontSize }: { v: number | null; fontSize: number }) {
  const text = v == null ? "—" : v === 0 ? "=" : v > 0 ? `▲${v}` : `▼${Math.abs(v)}`;
  const color =
    v == null ? "rgba(255,255,255,0.25)" : v === 0 ? C.gray : v > 0 ? "#3ddc84" : "#ff5a5a";
  return (
    <div style={{ display: "flex", fontSize, fontWeight: 700, color }}>{text}</div>
  );
}

/* ── building blocks ─────────────────────────────────────────── */

function Frame({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.bg,
        position: "relative",
        fontFamily: BODY,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height: Math.round(height * 0.5),
          background:
            "radial-gradient(ellipse 90% 80% at 50% 0%, rgba(232,25,44,0.16) 0%, rgba(232,25,44,0) 65%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width,
          height: Math.round(height * 0.35),
          background:
            "radial-gradient(ellipse 70% 90% at 85% 100%, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0) 60%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          display: "flex",
          flexDirection: "column",
          padding: "56px 56px 40px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function GkdMark({ size = 56 }: { size?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <div
        style={{
          fontFamily: HEAD,
          fontSize: size,
          fontWeight: 700,
          color: "rgba(255,255,255,0.22)",
          letterSpacing: 2,
        }}
      >
        GKD
      </div>
      <div
        style={{
          fontSize: Math.round(size * 0.26),
          color: "rgba(255,255,255,0.30)",
          letterSpacing: Math.round(size * 0.16),
          marginTop: 2,
        }}
      >
        CHAMPIONSHIP
      </div>
    </div>
  );
}

function Header({ title, subtitle, meta }: { title: string; subtitle: string; meta?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 30,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontFamily: HEAD,
            fontSize: 72,
            fontWeight: 700,
            color: C.white,
            letterSpacing: 1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: HEAD,
            fontSize: 40,
            fontWeight: 700,
            color: C.red,
            letterSpacing: 4,
            marginTop: 6,
          }}
        >
          {subtitle}
        </div>
        {meta ? (
          <div style={{ fontSize: 26, color: C.gray, marginTop: 10 }}>{meta}</div>
        ) : null}
      </div>
      <GkdMark />
    </div>
  );
}

function Pill({ escuderia, fontSize = 22 }: { escuderia: string; fontSize?: number }) {
  const c = CONSTRUCTOR_COLORS[escuderia] ?? { bg: "#333", fg: "#fff" };
  return (
    <div
      style={{
        display: "flex",
        backgroundColor: c.bg,
        color: c.fg,
        borderRadius: 999,
        padding: `${Math.round(fontSize * 0.28)}px ${Math.round(fontSize * 0.9)}px`,
        fontFamily: HEAD,
        fontSize,
        fontWeight: 700,
      }}
    >
      {escuderia}
    </div>
  );
}

function Avatar({
  photo,
  label,
  size,
  ring,
  rank,
}: {
  photo: string | null;
  label: string;
  size: number;
  ring: string;
  rank?: number;
}) {
  const badge = rank != null ? badgeColors(rank) : null;
  const badgeSize = Math.max(36, Math.round(size * 0.26));
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={label}
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            objectFit: "cover",
            border: `${Math.max(4, Math.round(size * 0.035))}px solid ${ring}`,
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: placeholderColor(label),
            border: `${Math.max(4, Math.round(size * 0.035))}px solid ${ring}`,
            fontFamily: HEAD,
            fontSize: Math.round(size * 0.3),
            fontWeight: 700,
            color: C.white,
          }}
        >
          {initialsOf(label)}
        </div>
      )}
      {badge ? (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: badgeSize,
            height: badgeSize,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: badge.bg,
            color: badge.fg,
            border: `4px solid ${C.bg}`,
            fontFamily: HEAD,
            fontSize: Math.round(badgeSize * 0.44),
            fontWeight: 700,
          }}
        >
          {rank}
        </div>
      ) : null}
    </div>
  );
}

function PodiumCard({
  row,
  big,
  valueLabel,
  small,
}: {
  row: ShareRow;
  big: boolean;
  valueLabel: string;
  small: boolean;
}) {
  const ring = ringColor(row.rank);
  const valueColor = row.rank === 1 ? C.gold : C.white;
  // Lap times ("38.080") are wider than points ("80") — stack the label
  // below the value, centered, so nothing spills out of the card.
  const stacked = row.value.length > 4;
  const scale = small ? 0.82 : 1;
  const valueSize = Math.round((stacked ? (big ? 42 : 34) : big ? 52 : 42) * scale);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: C.card,
        border: `2px solid ${row.rank === 1 ? "rgba(201,168,76,0.5)" : C.border}`,
        borderRadius: 24,
        padding: big ? "26px 22px 22px" : "20px 18px 18px",
        width: Math.round((big ? 330 : 296) * scale),
        marginTop: big ? 0 : Math.round(40 * scale),
      }}
    >
      <Avatar
        photo={row.photo}
        label={row.label}
        size={Math.round((big ? 168 : 132) * scale)}
        ring={ring}
        rank={row.rank}
      />
      <div
        style={{
          fontFamily: HEAD,
          fontSize: Math.round((big ? 36 : 29) * scale),
          fontWeight: 700,
          color: C.white,
          marginTop: 16,
          textAlign: "center",
        }}
      >
        {row.label}
      </div>
      {row.escuderia ? (
        <div style={{ display: "flex", marginTop: 10 }}>
          <Pill escuderia={row.escuderia} fontSize={Math.round((big ? 22 : 19) * scale)} />
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          alignItems: stacked ? "center" : "baseline",
          marginTop: 12,
        }}
      >
        <div
          style={{
            fontFamily: HEAD,
            fontSize: valueSize,
            fontWeight: 700,
            color: valueColor,
            textAlign: "center",
          }}
        >
          {row.value}
        </div>
        <div
          style={{
            fontFamily: HEAD,
            fontSize: Math.round((big ? 20 : 17) * scale),
            fontWeight: 700,
            color: valueColor === C.gold ? C.gold : C.gray,
            marginLeft: stacked ? 0 : 8,
            marginTop: stacked ? 4 : 0,
            letterSpacing: stacked ? 3 : 0,
            textAlign: "center",
          }}
        >
          {valueLabel}
        </div>
      </div>
    </div>
  );
}

function Podium({
  rows,
  valueLabel,
  small = false,
}: {
  rows: ShareRow[];
  valueLabel: string;
  small?: boolean;
}) {
  const p1 = rows.find((r) => r.rank === 1);
  const p2 = rows.find((r) => r.rank === 2);
  const p3 = rows.find((r) => r.rank === 3);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: 22,
        marginBottom: small ? 24 : 30,
      }}
    >
      {p2 ? <PodiumCard row={p2} big={false} valueLabel={valueLabel} small={small} /> : null}
      {p1 ? <PodiumCard row={p1} big valueLabel={valueLabel} small={small} /> : null}
      {p3 ? <PodiumCard row={p3} big={false} valueLabel={valueLabel} small={small} /> : null}
    </div>
  );
}

function HighlightHero({ row, valueLabel }: { row: ShareRow; valueLabel: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        backgroundColor: C.card,
        border: "2px solid rgba(232,25,44,0.55)",
        borderRadius: 28,
        padding: "40px 48px",
        marginBottom: 36,
        gap: 48,
      }}
    >
      <Avatar photo={row.photo} label={row.label} size={280} ring={C.red} />
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <div
          style={{
            fontFamily: HEAD,
            fontSize: 88,
            fontWeight: 700,
            color: C.red,
          }}
        >
          {`P${row.rank}`}
        </div>
        <div
          style={{
            fontFamily: HEAD,
            fontSize: 60,
            fontWeight: 700,
            color: C.white,
            marginTop: 4,
          }}
        >
          {row.label}
        </div>
        {row.escuderia ? (
          <div style={{ display: "flex", marginTop: 18 }}>
            <Pill escuderia={row.escuderia} fontSize={28} />
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 18 }}>
          <div style={{ fontFamily: HEAD, fontSize: 64, fontWeight: 700, color: C.white }}>
            {row.value}
          </div>
          <div style={{ fontFamily: HEAD, fontSize: 30, fontWeight: 700, color: C.gray, marginLeft: 12 }}>
            {valueLabel}
          </div>
        </div>
        {row.variation != null && row.variation !== 0 ? (
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              color: row.variation > 0 ? "#3ddc84" : "#ff5a5a",
              marginTop: 12,
            }}
          >
            {`${row.variation > 0 ? "▲" : "▼"} ${Math.abs(row.variation)} ${
              Math.abs(row.variation) === 1 ? "posición" : "posiciones"
            }`}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Microgramma Extended is wide; ~0.70em per capital on average. */
function fitFontSize(text: string, maxWidth: number, max: number, min: number): number {
  let size = max;
  while (size > min && text.length * size * 0.7 > maxWidth) size -= 1;
  return size;
}

function Table({
  rows,
  valueLabel,
  labelHeader,
  compact,
  showVar = true,
  varHeader = "VAR",
  extraHeader,
  canvasWidth = 968,
}: {
  rows: ShareRow[];
  valueLabel: string;
  labelHeader: string;
  compact: boolean;
  /** Hide the VAR column (e.g. round results have no rank variation). */
  showVar?: boolean;
  varHeader?: string;
  /** Header of the optional trailing column fed by row.extra. */
  extraHeader?: string;
  /** Inner frame width (image width minus Frame padding). */
  canvasWidth?: number;
}) {
  const showGap = rows.some((r) => r.gap != null);
  const showExtra = extraHeader != null;
  const dense = showGap && showExtra;
  const badge = compact ? 34 : 46;
  const rowPadX = compact ? 16 : 22;
  const posCol = compact ? 56 : 70;
  const varCol = showVar ? Math.min(120, Math.max(56, varHeader.length * 13 + 10)) : 0;
  const extraCol = showExtra ? (dense ? 62 : 80) : 0;
  const gapCol = showGap ? (dense ? 96 : 130) : 0;
  const valueCol = dense ? 112 : showGap ? 128 : 140;
  const longestEsc = rows.reduce((m, r) => Math.max(m, (r.escuderia ?? "").length), 0);
  const pillFs = compact ? 15 : 18;
  const escCol = Math.min(dense ? 168 : 210, Math.max(72, Math.round(longestEsc * pillFs * 0.62 + pillFs * 1.8)));
  const inner = canvasWidth - rowPadX * 2;
  const nameCol = Math.max(
    110,
    inner - (posCol + varCol + extraCol + gapCol + valueCol + escCol + 16)
  );
  const longestName = rows.reduce((m, r) => Math.max(m, r.label.length), 1);
  const nameSize = fitFontSize(
    "X".repeat(longestName),
    nameCol - 4,
    dense ? (compact ? 20 : 24) : compact ? 24 : 28,
    15
  );
  const pad = compact ? `4px ${rowPadX}px` : `10px ${rowPadX}px`;
  const headStyle: CSSProperties = {
    fontSize: dense ? 15 : 18,
    color: C.gray,
    letterSpacing: dense ? 1 : 2,
    fontWeight: 700,
    flexShrink: 0,
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgba(18,20,26,0.85)",
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        padding: "18px 0",
        flexGrow: 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: `0 ${rowPadX}px 12px`,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ ...headStyle, width: posCol, display: "flex" }}>POS</div>
        {showVar ? (
          <div style={{ ...headStyle, width: varCol, display: "flex" }}>{varHeader}</div>
        ) : null}
        <div style={{ ...headStyle, width: nameCol, display: "flex", flexShrink: 1 }}>{labelHeader}</div>
        <div style={{ ...headStyle, width: escCol, display: "flex" }}>ESC.</div>
        {showGap ? (
          <div style={{ ...headStyle, width: gapCol, display: "flex", justifyContent: "flex-end" }}>
            {dense ? "GAP" : "GAP TO LEADER"}
          </div>
        ) : null}
        <div style={{ ...headStyle, width: valueCol, display: "flex", justifyContent: "flex-end" }}>
          {valueLabel}
        </div>
        {showExtra ? (
          <div style={{ ...headStyle, width: extraCol, display: "flex", justifyContent: "flex-end" }}>
            {extraHeader}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "space-around",
        }}
      >
      {rows.flatMap((r, i) => {
        const prev = rows[i - 1];
        const jumped = prev != null && r.rank > prev.rank + 1;
        const b = badgeColors(r.rank);
        const nodes: ReactNode[] = [];
        if (prev != null && jumped) {
          const skipped = r.rank - prev.rank - 1;
          nodes.push(
            <div
              key={`gap-${prev.rank}-${r.rank}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: compact ? "6px 24px" : "10px 28px",
                margin: compact ? "2px 12px" : "4px 12px",
              }}
            >
              {[0, 1, 2].map((d) => (
                <div
                  key={d}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    backgroundColor: d === 1 ? C.gold : "rgba(201,168,76,0.45)",
                  }}
                />
              ))}
              <div
                style={{
                  fontSize: compact ? 16 : 18,
                  color: C.gray,
                  letterSpacing: 3,
                  marginLeft: 8,
                }}
              >
                {skipped === 1 ? "1 POSICIÓN" : `${skipped} POSICIONES`}
              </div>
            </div>
          );
        }
        nodes.push(
          <div
            key={`${r.rank}-${r.label}`}
            style={{
              display: "flex",
              alignItems: "center",
              padding: pad,
              backgroundColor: rowTint(r.rank, r.highlighted),
              border: r.highlighted ? `2px solid ${C.red}` : "2px solid rgba(0,0,0,0)",
              borderRadius: 12,
              margin: compact ? "2px 12px" : "3px 12px",
              flexGrow: 1,
              maxHeight: compact ? 74 : 96,
            }}
          >
            <div style={{ display: "flex", width: posCol, flexShrink: 0 }}>
              <div
                style={{
                  width: badge,
                  height: badge,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: b.bg,
                  color: b.fg,
                  fontFamily: HEAD,
                  fontSize: Math.round(badge * 0.42),
                  fontWeight: 700,
                }}
              >
                {r.rank}
              </div>
            </div>
            {showVar ? (
              <div style={{ display: "flex", width: varCol, flexShrink: 0 }}>
                <VarBadge v={r.variation} fontSize={Math.max(16, nameSize - 2)} />
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                width: nameCol,
                overflow: "hidden",
                flexShrink: 1,
                fontFamily: HEAD,
                fontSize: nameSize,
                fontWeight: 700,
                color: C.white,
                whiteSpace: "nowrap",
              }}
            >
              {r.label}
            </div>
            <div style={{ display: "flex", width: escCol, flexShrink: 0, overflow: "hidden" }}>
              {r.escuderia ? <Pill escuderia={r.escuderia} fontSize={pillFs} /> : null}
            </div>
            {showGap ? (
              <div
                style={{
                  display: "flex",
                  width: gapCol,
                  flexShrink: 0,
                  justifyContent: "flex-end",
                  fontSize: Math.max(16, nameSize - 2),
                  fontWeight: 700,
                  color: r.gap === "—" ? "#3ddc84" : C.grayLight,
                }}
              >
                {r.gap ?? "—"}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                width: valueCol,
                flexShrink: 0,
                justifyContent: "flex-end",
                fontFamily: HEAD,
                fontSize: nameSize + 1,
                fontWeight: 700,
                color: r.rank === 1 ? C.gold : C.white,
              }}
            >
              {r.value}
            </div>
            {showExtra ? (
              <div
                style={{
                  display: "flex",
                  width: extraCol,
                  flexShrink: 0,
                  justifyContent: "flex-end",
                  fontFamily: HEAD,
                  fontSize: nameSize,
                  fontWeight: 700,
                  color: r.rank === 1 ? C.gold : C.white,
                }}
              >
                {r.extra ?? "—"}
              </div>
            ) : null}
          </div>
        );
        return nodes;
      })}
      </div>
    </div>
  );
}

function Footer({ pageInfo }: { pageInfo?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: 22,
      }}
    >
      <div
        style={{
          fontFamily: HEAD,
          fontSize: 34,
          fontWeight: 700,
          color: C.white,
          letterSpacing: 4,
        }}
      >
        GKD
      </div>
      <div style={{ fontSize: 22, color: C.gray, marginTop: 4 }}>{SITE_URL}</div>
      <div
        style={{
          fontFamily: HEAD,
          fontSize: 22,
          fontWeight: 700,
          color: C.red,
          letterSpacing: 6,
          marginTop: 6,
        }}
      >
        {HASHTAG}
      </div>
      {pageInfo ? (
        <div style={{ fontSize: 20, color: C.gray, marginTop: 8, letterSpacing: 2 }}>
          {pageInfo}
        </div>
      ) : null}
    </div>
  );
}

/* ── exported images ─────────────────────────────────────────── */

export function StandingsImage({
  data,
  format,
}: {
  data: StandingsShare;
  format: ShareFormat;
}) {
  const { width, height } = SHARE_SIZES[format];
  const tableRows = data.rows;
  const hasTop3 = [1, 2, 3].every((n) => tableRows.some((r) => r.rank === n));
  const showPodium = !data.highlight && hasTop3;
  const compact = format === "post" || tableRows.length > 10;
  return (
    <Frame width={width} height={height}>
      <Header title={data.title} subtitle={data.subtitle} />
      {data.highlight ? (
        <HighlightHero row={data.highlight} valueLabel={data.valueLabel} />
      ) : showPodium ? (
        <Podium
          rows={tableRows.slice(0, 3)}
          valueLabel={data.valueLabel}
          small={format === "post"}
        />
      ) : null}
      <Table
        rows={tableRows}
        valueLabel={data.valueLabel}
        labelHeader={data.labelHeader}
        compact={compact}
        canvasWidth={width - 112}
      />
      <Footer />
    </Frame>
  );
}

export function DriverProfileImage({
  profile,
  format,
}: {
  profile: DriverProfileShare;
  format: ShareFormat;
}) {
  const { width, height } = SHARE_SIZES[format];
  const story = format === "story";
  const statCard: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: C.card,
    border: "1px solid rgba(201,168,76,0.35)",
    borderRadius: 20,
    padding: "30px 16px",
  };
  const statValue: CSSProperties = {
    fontFamily: HEAD,
    fontSize: story ? 58 : 48,
    fontWeight: 700,
    color: C.white,
  };
  const statLabel: CSSProperties = {
    fontSize: 22,
    color: C.gray,
    letterSpacing: 3,
    marginTop: 10,
  };
  return (
    <Frame width={width} height={height}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            fontFamily: HEAD,
            fontSize: 36,
            fontWeight: 700,
            color: C.red,
            letterSpacing: 8,
          }}
        >
          PILOTO
        </div>
        <GkdMark />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <Avatar
          photo={profile.photo}
          label={profile.alias}
          size={story ? 430 : 340}
          ring={C.gold}
        />
        <div
          style={{
            fontFamily: HEAD,
            fontSize: story ? 92 : 76,
            fontWeight: 700,
            color: C.white,
            marginTop: 36,
          }}
        >
          {profile.alias}
        </div>
        {profile.escuderia ? (
          <div style={{ display: "flex", marginTop: 20 }}>
            <Pill escuderia={profile.escuderia} fontSize={30} />
          </div>
        ) : null}
        <div
          style={{
            fontSize: 28,
            color: C.grayLight,
            letterSpacing: 8,
            marginTop: 22,
          }}
        >
          {profile.categoryLabel}
        </div>
        <div
          style={{
            display: "flex",
            gap: 22,
            marginTop: story ? 52 : 40,
            width: "100%",
          }}
        >
          <div style={statCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ ...statValue, color: C.gold }}>{`P${profile.champRank}`}</div>
              {profile.variation != null && profile.variation !== 0 ? (
                <VarBadge v={profile.variation} fontSize={26} />
              ) : null}
            </div>
            <div style={statLabel}>CAMPEONATO</div>
          </div>
          <div style={statCard}>
            <div style={statValue}>{profile.bestTime}</div>
            <div style={statLabel}>MEJOR VUELTA</div>
          </div>
          <div style={statCard}>
            <div style={statValue}>{profile.vrRank != null ? `#${profile.vrRank}` : "—"}</div>
            <div style={statLabel}>RANKING VR</div>
            {profile.vrLabel ? (
              <div style={{ fontSize: 18, color: C.gray, marginTop: 6 }}>{profile.vrLabel}</div>
            ) : null}
          </div>
        </div>
        {profile.positionsGained != null ? (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              marginTop: story ? 28 : 20,
              gap: 10,
            }}
          >
            <div
              style={{
                fontFamily: HEAD,
                fontSize: story ? 42 : 36,
                fontWeight: 700,
                color:
                  profile.positionsGained > 0
                    ? "#3ddc84"
                    : profile.positionsGained < 0
                      ? "#ff5a5a"
                      : C.grayLight,
              }}
            >
              {profile.positionsGained === 0
                ? "="
                : profile.positionsGained > 0
                  ? `+${profile.positionsGained}`
                  : String(profile.positionsGained)}
            </div>
            <div
              style={{
                fontSize: 20,
                color: C.gray,
                letterSpacing: 3,
              }}
            >
              POS ÚLTIMA CARRERA
            </div>
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: story ? 44 : 32,
          }}
        >
          <div style={{ fontFamily: HEAD, fontSize: 48, fontWeight: 700, color: C.white }}>
            {profile.totalPoints}
          </div>
          <div style={{ fontFamily: HEAD, fontSize: 26, fontWeight: 700, color: C.gray, marginLeft: 10 }}>
            PTS
          </div>
        </div>
      </div>
      <Footer />
    </Frame>
  );
}

export function RoundImage({ round, format }: { round: RoundShare; format: ShareFormat }) {
  const { width, height } = SHARE_SIZES[format];
  const tableRows: ShareRow[] = round.rows.map((r) => ({
    rank: r.pos,
    label: r.alias,
    escuderia: r.escuderia,
    value: r.time,
    photo: r.photo,
    variation: r.gained,
    highlighted: round.highlight != null && r.alias === round.highlight.alias,
    // Best lap of the round shows "—" (green), same as the VR leader.
    gap: r.dif === "+0.000" ? "—" : r.dif,
    extra: String(r.pts),
  }));
  const highlightRow = round.highlight
    ? tableRows.find((r) => r.label === round.highlight!.alias) ?? {
        rank: round.highlight.pos,
        label: round.highlight.alias,
        escuderia: round.highlight.escuderia,
        value: round.highlight.time,
        photo: round.highlight.photo,
        variation: round.highlight.gained,
        highlighted: true,
      }
    : null;
  const top3: ShareRow[] = round.rows
    .filter((r) => r.pos <= 3)
    .map((r) => ({
      rank: r.pos,
      label: r.alias,
      escuderia: r.escuderia,
      value: String(r.pts),
      photo: r.photo,
      variation: r.gained,
      highlighted: false,
    }));
  const showPodium = !highlightRow && top3.length >= 3;
  const compact = format === "post" || round.rows.length > 10;
  return (
    <Frame width={width} height={height}>
      <Header
        title={`ROUND ${round.roundNumber}`}
        subtitle={`RESULTADOS ${round.category}`}
        meta={`${round.monthLabel} — ${shortDate(round.date)}`}
      />
      {highlightRow ? (
        <HighlightHero row={highlightRow} valueLabel="TIEMPO" />
      ) : showPodium ? (
        <Podium rows={top3} valueLabel="PTS" small={format === "post"} />
      ) : null}
      <Table
        rows={tableRows}
        valueLabel="TIEMPO"
        labelHeader="PILOTO"
        compact={compact}
        showVar
        varHeader="GANADAS"
        extraHeader="PTS"
        canvasWidth={width - 112}
      />
      <Footer />
    </Frame>
  );
}

function debriefTitleSize(title: string, format: ShareFormat): number {
  const n = title.length;
  if (format === "story") {
    if (n > 100) return 46;
    if (n > 70) return 54;
    return 64;
  }
  if (n > 100) return 40;
  if (n > 70) return 46;
  return 54;
}

export function DebriefImage({ data, format }: { data: DebriefShare; format: ShareFormat }) {
  const { width, height } = SHARE_SIZES[format];
  const inner = width - 112;
  const gap = 16;
  const maxH = format === "story" ? 640 : 360;
  const count = data.people.length;
  const fitted =
    count > 0 ? Math.floor((inner - gap * (count - 1)) / count) : Math.round(maxH * 0.75);
  const cardW = Math.min(Math.round(maxH * 0.75), fitted);
  const photoH = Math.round((cardW * 4) / 3);
  const nameSize = cardW < 220 ? 20 : 26;

  return (
    <Frame width={width} height={height}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: HEAD,
              fontSize: format === "story" ? 28 : 24,
              fontWeight: 700,
              color: C.red,
              letterSpacing: 4,
            }}
          >
            {data.kicker}
          </div>
          <div style={{ fontSize: 24, color: C.gray, marginTop: 10 }}>{data.dateLabel}</div>
        </div>
        <GkdMark size={format === "story" ? 52 : 44} />
      </div>

      <div
        style={{
          display: "flex",
          fontFamily: HEAD,
          fontSize: debriefTitleSize(data.title, format),
          fontWeight: 700,
          color: C.white,
          letterSpacing: 1,
          lineHeight: 1.15,
          marginTop: format === "story" ? 56 : 36,
        }}
      >
        {data.title}
      </div>

      {data.excerpt ? (
        <div
          style={{
            display: "flex",
            fontSize: format === "story" ? 30 : 26,
            lineHeight: 1.45,
            color: C.grayLight,
            marginTop: 28,
          }}
        >
          {data.excerpt}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
        {count > 0 ? (
          <div style={{ display: "flex", justifyContent: "center", gap }}>
            {data.people.map((person) => (
              <div
                key={person.alias}
                style={{ display: "flex", flexDirection: "column", width: cardW }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={person.photo}
                  alt={person.alias}
                  width={cardW}
                  height={photoH}
                  style={{
                    width: cardW,
                    height: photoH,
                    objectFit: "cover",
                    objectPosition: "center 18%",
                    borderRadius: 22,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    fontFamily: HEAD,
                    fontSize: nameSize,
                    fontWeight: 700,
                    color: C.white,
                    letterSpacing: 1,
                    marginTop: 14,
                  }}
                >
                  {person.alias}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <Footer />
      </div>
    </Frame>
  );
}
