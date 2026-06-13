import { CONSTRUCTOR_COLORS } from "@/lib/constants";
import { initials, rankBadgeClass, stringToColor } from "./format";

export function RankBadge({ rank }: { rank: number }) {
  return <span className={rankBadgeClass(rank)}>{rank}</span>;
}

export function ConstructorBadge({ escuderia }: { escuderia: string }) {
  const c = CONSTRUCTOR_COLORS[escuderia] ?? { bg: "#333", fg: "#fff" };
  return (
    <span
      className="constructor-badge"
      style={{ background: c.bg, color: c.fg }}
    >
      {escuderia}
    </span>
  );
}

export function PilotPlaceholder({
  alias,
  className,
}: {
  alias: string;
  className?: string;
}) {
  return (
    <div
      className={className ?? "pilot-placeholder"}
      style={{ display: "flex", background: stringToColor(alias) }}
    >
      {initials(alias)}
    </div>
  );
}
