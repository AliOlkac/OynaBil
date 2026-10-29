import { useId } from "react";

/**
 * Selçuklu sekiz köşeli yıldızından örülmüş geometrik desen.
 * 5. ve 6. sınıf müfredatı bu motifleri işler; desen dersin kimliğidir, süs değil.
 * Ortada içerik okunsun diye kenarlara doğru belirginleşir.
 */
const TILE = 96;
const C = TILE / 2;
const A = 20;
const R = A * Math.SQRT2;
const r = A / Math.cos(Math.PI / 8);

function starPath(): string {
  const pts: string[] = [];
  for (let k = 0; k < 16; k++) {
    const angle = (k * Math.PI) / 8;
    const radius = k % 2 === 0 ? R : r;
    pts.push(`${(C + radius * Math.cos(angle)).toFixed(2)} ${(C + radius * Math.sin(angle)).toFixed(2)}`);
  }
  const d = `M${pts.join("L")}Z`;
  const tips = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
    const angle = (k * Math.PI) / 4;
    const x = C + R * Math.cos(angle);
    const y = C + R * Math.sin(angle);
    const tx = C + C * Math.sign(Math.round(Math.cos(angle) * 1000));
    const ty = C + C * Math.sign(Math.round(Math.sin(angle) * 1000));
    return `M${x.toFixed(2)} ${y.toFixed(2)}L${tx} ${ty}`;
  });
  return d + tips.join("");
}

const PATH = starPath();

export function Girih({ className = "", scale = 1, fade = true }: { className?: string; scale?: number; fade?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={
        fade
          ? {
              maskImage: "radial-gradient(ellipse 70% 65% at 50% 45%, transparent 35%, black 100%)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 65% at 50% 45%, transparent 35%, black 100%)",
            }
          : undefined
      }
    >
      <defs>
        <pattern id={`girih-${id}`} width={TILE * scale} height={TILE * scale} patternUnits="userSpaceOnUse">
          <path
            d={PATH}
            transform={`scale(${scale})`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25 / scale}
            strokeLinejoin="round"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#girih-${id})`} />
    </svg>
  );
}
