import { TEAM_STYLES } from "@/games/teams";
import type { TeamColor } from "@/games/types";

const SHAPES = {
  yildiz: (() => {
    const pts: string[] = [];
    for (let k = 0; k < 16; k++) {
      const angle = (k * Math.PI) / 8 - Math.PI / 2;
      const radius = k % 2 === 0 ? 11.5 : 8.8;
      pts.push(`${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`);
    }
    return <polygon points={pts.join(" ")} />;
  })(),
  altigen: <polygon points="12,1.5 21.1,6.75 21.1,17.25 12,22.5 2.9,17.25 2.9,6.75" />,
  daire: <circle cx="12" cy="12" r="10.5" />,
  baklava: <polygon points="12,1 23,12 12,23 1,12" />,
} as const;

export function TeamEmblem({
  color,
  className = "size-6",
  filled = true,
}: {
  color: TeamColor;
  className?: string;
  filled?: boolean;
}) {
  const style = TEAM_STYLES[color];
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill={filled ? style.base : "none"}
      stroke={filled ? "none" : style.base}
      strokeWidth={filled ? 0 : 2}
      strokeLinejoin="round"
    >
      {SHAPES[style.emblem]}
    </svg>
  );
}
