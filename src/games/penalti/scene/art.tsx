import { EMBLEM_SHAPES } from "@/components/ui/TeamEmblem";
import { DARK, HAIR, PANTS, SKIN } from "../../shared/kid";
import { GOAL_BOTTOM, GOAL_CX, GOAL_HALF, GOAL_TOP, NET_BACK, POST, SPOT, WORLD_LEFT, WORLD_RIGHT } from "./geometry";

/**
 * Penaltı sahnesinin durağan çizimi: gece maçı, ışıklı stadyum, iki takımın taraftarları, kale ve ağ,
 * kaleci ve sırtı kameraya dönük iki şutçu. Hareket eden parçalar `data-part` ile işaretlidir.
 */

export type ArtTeam = { base: string; deep: string; emblem: keyof typeof EMBLEM_SHAPES };

export const NET_COLS = 13;
export const NET_ROWS = 9;
export const DUST_COUNT = 40;
export const CROWD_ROWS = 8;

/** Ağın arka yüzündeki düğüm noktaları (motor gol olunca bunları esnetir). */
export function netGrid(): { x: number; y: number }[][] {
  return Array.from({ length: NET_ROWS }, (_, r) =>
    Array.from({ length: NET_COLS }, (_, c) => ({
      x: NET_BACK.left + ((NET_BACK.right - NET_BACK.left) * c) / (NET_COLS - 1),
      y: NET_BACK.top + ((NET_BACK.bottom - NET_BACK.top) * r) / (NET_ROWS - 1),
    })),
  );
}

export const KICKER_LOOKS = [
  { skin: SKIN[1], hair: HAIR[0], number: "7" },
  { skin: SKIN[2], hair: HAIR[2], number: "10" },
];

const L = GOAL_CX - GOAL_HALF;
const R = GOAL_CX + GOAL_HALF;

/** Kalabalık sırası: tek path'te yan yana başlar ve omuzlar (çok sayıda öğe yerine). */
function crowdRow(y: number, from: number, to: number, seed: number) {
  let heads = "";
  let bodies = "";
  let light = "";
  for (let x = from, i = 0; x < to; x += 23, i++) {
    const jitter = ((i * 37 + seed * 11) % 9) - 4;
    const hx = x + jitter;
    const hy = y - ((i * 13 + seed) % 5);
    const r = 8 + ((i + seed) % 3);
    heads += `M${hx - r} ${hy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    const body = `M${hx - 12} ${hy + 30} q0 -20 12 -20 q12 0 12 20Z`;
    if ((i + seed) % 4 === 0) light += body;
    else bodies += body;
  }
  return { heads, bodies, light };
}

export function SceneArt({ teams }: { teams: [ArtTeam, ArtTeam] }) {
  const grid = netGrid();
  return (
    <>
      <defs>
        <linearGradient id="pn-sky" gradientUnits="userSpaceOnUse" x1="0" y1="-300" x2="0" y2="480">
          <stop offset="0" stopColor="var(--color-ink-950)" />
          <stop offset="1" stopColor="var(--color-ink-800)" />
        </linearGradient>
        <linearGradient id="pn-pitch" gradientUnits="userSpaceOnUse" x1="0" y1="500" x2="0" y2="1100">
          <stop offset="0" stopColor="var(--color-saha)" />
          <stop offset="1" stopColor="var(--color-saha-acik)" />
        </linearGradient>
        <radialGradient id="pn-glare" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--color-ufuk-acik)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--color-ufuk-acik)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Gece göğü ve tribünler */}
      <rect x={WORLD_LEFT} y={-400} width={WORLD_RIGHT - WORLD_LEFT} height={900} fill="url(#pn-sky)" />
      <path d={`M${WORLD_LEFT} 150 L ${WORLD_RIGHT} 150 L ${WORLD_RIGHT} 470 L ${WORLD_LEFT} 470 Z`} fill="var(--color-ink-900)" />
      <path d={`M${WORLD_LEFT} 140 H ${WORLD_RIGHT} V 162 H ${WORLD_LEFT} Z`} fill="var(--color-ink-700)" />
      {([0, 1] as const).map((side) =>
        Array.from({ length: CROWD_ROWS }, (_, r) => {
          const y = 196 + r * 33;
          const from = side === 0 ? WORLD_LEFT : GOAL_CX + 4;
          const to = side === 0 ? GOAL_CX - 4 : WORLD_RIGHT;
          const row = crowdRow(y, from, to, r * 3 + side * 7);
          return (
            <g key={`${side}-${r}`} data-crowd={side} data-row={r}>
              <path d={row.bodies} fill={r % 2 ? teams[side].deep : teams[side].base} opacity={0.55 + r * 0.05} />
              <path d={row.light} fill="var(--color-cream)" opacity={0.55 + r * 0.04} />
              <path d={row.heads} fill={SKIN[(r + side) % SKIN.length]} opacity={0.5 + r * 0.05} />
            </g>
          );
        }),
      )}
      {/* Taraftar bayrakları */}
      {([0, 1] as const).map((side) => (
        <g key={side} transform={`translate(${side === 0 ? 260 : 1340} 150)`}>
          <rect x={-90} y={0} width={180} height={46} rx={4} fill={teams[side].base} />
          <g transform="translate(-14 10) scale(1.1)" fill="var(--color-ink-950)" opacity={0.8}>
            {EMBLEM_SHAPES[teams[side].emblem]}
          </g>
        </g>
      ))}

      {/* Işık kuleleri */}
      {[-150, 1750].map((x, i) => (
        <g key={i}>
          <path d={`M${x - 8} 470 L ${x - 4} 20 H ${x + 4} L ${x + 8} 470 Z`} fill="var(--color-ink-700)" />
          <rect x={x - 70} y={-20} width={140} height={70} rx={6} fill="var(--color-ink-700)" />
          {Array.from({ length: 10 }, (_, k) => (
            <circle key={k} cx={x - 52 + (k % 5) * 26} cy={-2 + Math.floor(k / 5) * 32} r={10} fill="var(--color-cream)" />
          ))}
          <circle cx={x} cy={15} r={260} fill="url(#pn-glare)" />
        </g>
      ))}

      {/* Reklam panoları */}
      <g data-part="led">
        <rect x={WORLD_LEFT} y={466} width={WORLD_RIGHT - WORLD_LEFT} height={42} fill="var(--color-ink-950)" />
        <rect data-part="led-glow" x={WORLD_LEFT} y={466} width={WORLD_RIGHT - WORLD_LEFT} height={42} fill="var(--color-firuze)" opacity={0} />
        {Array.from({ length: 12 }, (_, i) => (
          <text key={i} x={WORLD_LEFT + 160 + i * 340} y={496} fontSize={26} fontWeight={700} fill={i % 3 === 1 ? "var(--color-kehribar)" : "var(--color-firuze)"} letterSpacing={4}>
            {i % 3 === 1 ? "BİLEN ATAR" : "OYNABİL"}
          </text>
        ))}
      </g>

      {/* Çim: perspektifli biçme şeritleri ve çizgiler */}
      <rect x={WORLD_LEFT} y={508} width={WORLD_RIGHT - WORLD_LEFT} height={700} fill="url(#pn-pitch)" />
      {Array.from({ length: 10 }, (_, k) => {
        const y0 = 508 + 600 * (k / 10) ** 1.5;
        const y1 = 508 + 600 * ((k + 0.5) / 10) ** 1.5;
        return <rect key={k} x={WORLD_LEFT} y={y0} width={WORLD_RIGHT - WORLD_LEFT} height={y1 - y0} fill="var(--color-saha)" opacity={0.55} />;
      })}
      <g stroke="var(--color-cream)" strokeOpacity={0.8} fill="none" strokeLinejoin="round">
        <line x1={WORLD_LEFT} y1={GOAL_BOTTOM} x2={WORLD_RIGHT} y2={GOAL_BOTTOM} strokeWidth={4} />
        <path d={`M${L - 70} ${GOAL_BOTTOM} L ${L - 150} 712 H ${R + 150} L ${R + 70} ${GOAL_BOTTOM}`} strokeWidth={5} />
        <path d={`M${L - 380} ${GOAL_BOTTOM} L ${L - 600} 935 H ${R + 600} L ${R + 380} ${GOAL_BOTTOM}`} strokeWidth={7} />
      </g>
      <ellipse cx={SPOT.x} cy={SPOT.y + 18} rx={16} ry={6} fill="var(--color-cream)" opacity={0.85} />

      {/* Kalenin gölgesi ve ağ: arka yüz, yanlar, tavan */}
      <path d={`M${L} ${GOAL_BOTTOM} L ${NET_BACK.left} ${NET_BACK.bottom + 6} H ${NET_BACK.right} L ${R} ${GOAL_BOTTOM} Z`} fill="rgb(0 0 0 / 0.22)" />
      <g stroke="var(--color-cream)" strokeOpacity={0.36} strokeWidth={1.8} fill="none">
        {grid.map((row, r) => (
          <path key={`h${r}`} data-net-row={r} d={`M${row.map((p) => `${p.x} ${p.y}`).join(" L ")}`} />
        ))}
        {grid[0].map((_, c) => (
          <path key={`v${c}`} data-net-col={c} d={`M${grid.map((row) => `${row[c].x} ${row[c].y}`).join(" L ")}`} />
        ))}
        {Array.from({ length: 6 }, (_, k) => {
          const t = k / 5;
          return (
            <g key={k}>
              <line x1={L + POST / 2} y1={GOAL_TOP + t * (GOAL_BOTTOM - GOAL_TOP)} x2={NET_BACK.left} y2={NET_BACK.top + t * (NET_BACK.bottom - NET_BACK.top)} />
              <line x1={R - POST / 2} y1={GOAL_TOP + t * (GOAL_BOTTOM - GOAL_TOP)} x2={NET_BACK.right} y2={NET_BACK.top + t * (NET_BACK.bottom - NET_BACK.top)} />
              <line x1={L + t * (R - L)} y1={GOAL_TOP} x2={NET_BACK.left + t * (NET_BACK.right - NET_BACK.left)} y2={NET_BACK.top} />
            </g>
          );
        })}
      </g>

      {/* Ağa giren top (kale ağzının arkasında kalır) */}
      <g data-part="ball-back" opacity={0}>
        <Ball />
      </g>

      {/* Direkler */}
      <g data-part="posts">
        <rect data-part="post-left" x={L - POST / 2} y={GOAL_TOP - POST / 2} width={POST} height={GOAL_BOTTOM - GOAL_TOP + POST / 2} rx={3} fill="var(--color-cream)" />
        <rect data-part="post-right" x={R - POST / 2} y={GOAL_TOP - POST / 2} width={POST} height={GOAL_BOTTOM - GOAL_TOP + POST / 2} rx={3} fill="var(--color-cream)" />
        <rect data-part="crossbar" x={L - POST / 2} y={GOAL_TOP - POST / 2} width={R - L + POST} height={POST} rx={3} fill="var(--color-cream)" />
        <rect x={L - POST / 2} y={GOAL_TOP - POST / 2} width={4} height={GOAL_BOTTOM - GOAL_TOP} fill="var(--color-ink-300)" opacity={0.5} />
      </g>

      {/* Kalecinin gölgesi ve kendisi */}
      <ellipse data-part="keeper-shadow" cx={GOAL_CX} cy={GOAL_BOTTOM + 2} rx={48} ry={8} fill="rgb(0 0 0 / 0.3)" />
      <Keeper />

      {/* Topun gölgesi ve top */}
      <ellipse data-part="ball-shadow" cx={SPOT.x} cy={SPOT.y + 16} rx={30} ry={8} fill="rgb(0 0 0 / 0.3)" />
      <g data-part="ball">
        <Ball />
      </g>

      {/* Şutçular (ön planda, sırtları kameraya dönük) */}
      {([0, 1] as const).map((side) => (
        <Kicker key={side} side={side} team={teams[side]} />
      ))}

      {/* Toz */}
      <g>
        {Array.from({ length: DUST_COUNT }, (_, i) => (
          <circle key={i} data-dust={i} r={0} fill="var(--color-toz)" opacity={0} />
        ))}
      </g>

      {/* Kurtarışta eldivenlerden çıkan yıldız */}
      <g data-part="star" opacity={0}>
        <path d={STAR} fill="var(--color-kehribar)" />
        <path d={STAR} fill="var(--color-cream)" transform="scale(0.5) rotate(22)" />
      </g>
      <circle data-part="flash" r={0} fill="none" stroke="var(--color-cream)" strokeWidth={10} opacity={0} />

      {/* Nişan: topdan parmağa kesikli çizgi ve hedef */}
      <g data-part="aim" opacity={0}>
        <path data-part="aim-line" fill="none" stroke="var(--color-cream)" strokeWidth={6} strokeDasharray="4 16" strokeLinecap="round" />
        <g data-part="aim-target">
          <circle r={30} fill="rgb(7 18 40 / 0.25)" stroke="var(--color-ink-950)" strokeWidth={11} />
          <circle data-part="aim-ring" r={30} fill="none" strokeWidth={6} />
          <circle r={6} fill="var(--color-cream)" />
        </g>
      </g>

      {/* Büyük yazı: GOL!, KURTARDI!, DİREK!, AUT! */}
      <g data-part="banner" opacity={0} textAnchor="middle" fontWeight={800} style={{ paintOrder: "stroke" }}>
        <text data-part="banner-text" y={0} fontSize={150} stroke="var(--color-ink-950)" strokeWidth={16} strokeLinejoin="round" />
      </g>
    </>
  );
}

const STAR = (() => {
  const pts: string[] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    const r = k % 2 === 0 ? 70 : 24;
    pts.push(`${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(" L ")} Z`;
})();

/** Top: beyaz, siyah beşgenler; birim yarıçap, motor ölçekler ve döndürür. */
export function Ball() {
  return (
    <g data-part="ball-body">
      <circle r={1} fill="var(--color-cream)" />
      <g data-part="ball-spin" fill="var(--color-ink-950)">
        <path d="M0 -0.28 L0.27 -0.09 L0.17 0.23 L-0.17 0.23 L-0.27 -0.09 Z" />
        <path d="M0 -0.98 L0.24 -0.82 L0.14 -0.62 L-0.14 -0.62 L-0.24 -0.82 Z" />
        <path d="M0.93 -0.3 L0.94 0.05 L0.72 0.12 L0.64 -0.14 L0.78 -0.36 Z" />
        <path d="M0.58 0.8 L0.32 0.92 L0.2 0.72 L0.4 0.52 L0.62 0.58 Z" />
        <path d="M-0.58 0.8 L-0.32 0.92 L-0.2 0.72 L-0.4 0.52 L-0.62 0.58 Z" />
        <path d="M-0.93 -0.3 L-0.94 0.05 L-0.72 0.12 L-0.64 -0.14 L-0.78 -0.36 Z" />
      </g>
      <circle r={1} fill="none" stroke="var(--color-ink-400)" strokeWidth={0.06} />
      <circle cx={-0.35} cy={-0.4} r={0.22} fill="var(--color-cream)" opacity={0.7} />
    </g>
  );
}

/** Kaleci: önden görünüş; yerel başlangıç noktası kalça. Kollar motorda çözülür. */
function Keeper() {
  const skin = SKIN[0];
  return (
    <g data-part="keeper">
      {/* Bacaklar: motor çömelmeye ve uçuşa göre büker */}
      {(["left", "right"] as const).map((s) => (
        <g key={s}>
          <path data-part={`keeper-thigh-${s}`} stroke={PANTS} strokeWidth={17} strokeLinecap="round" fill="none" />
          <path data-part={`keeper-shin-${s}`} stroke="var(--color-kehribar-deep)" strokeWidth={15} strokeLinecap="round" fill="none" />
          <ellipse data-part={`keeper-boot-${s}`} rx={13} ry={7} fill="var(--color-ink-950)" />
        </g>
      ))}
      {/* Şort ve forma */}
      <path d="M-31 -4 H31 L34 24 H4 L0 16 L-4 24 H-34 Z" fill="var(--color-ink-900)" />
      <path d="M-36 -66 Q0 -76 36 -66 L31 2 H-31 Z" fill="var(--color-kehribar)" />
      <path d="M-36 -66 L-31 2 H-22 L-26 -68 Z" fill="var(--color-kehribar-deep)" opacity={0.7} />
      <path d="M36 -66 L31 2 H22 L26 -68 Z" fill="var(--color-kehribar-deep)" opacity={0.7} />
      <text x={0} y={-22} textAnchor="middle" fontSize={34} fontWeight={800} fill="var(--color-ink-950)">
        1
      </text>
      {/* Kollar (motor çizer) */}
      {(["left", "right"] as const).map((s) => (
        <g key={s}>
          <path data-part={`keeper-upper-${s}`} stroke="var(--color-kehribar)" strokeWidth={15} strokeLinecap="round" fill="none" />
          <path data-part={`keeper-fore-${s}`} stroke="var(--color-kehribar)" strokeWidth={13} strokeLinecap="round" fill="none" />
          <g data-part={`keeper-glove-${s}`}>
            <circle r={15} fill="var(--color-cream)" stroke="var(--color-kehribar-deep)" strokeWidth={4} />
            <path d="M-8 -8 L-2 -14 M0 -9 L5 -15" stroke="var(--color-ink-300)" strokeWidth={2.5} strokeLinecap="round" />
          </g>
        </g>
      ))}
      {/* Baş */}
      <rect x={-8} y={-82} width={16} height={14} fill={skin} />
      <g data-part="keeper-head" transform="translate(0 -96)">
        <circle cx={-21} cy={2} r={6} fill={skin} />
        <circle cx={21} cy={2} r={6} fill={skin} />
        <circle r={22} fill={skin} />
        <path d="M-22 -2 C-24 -22 -8 -30 4 -28 C16 -27 24 -18 22 -2 C16 -12 8 -16 0 -15 C-8 -14 -16 -10 -22 -2 Z" fill={HAIR[1]} />
        <rect x={-22} y={-12} width={44} height={6} rx={3} fill="var(--color-kehribar-deep)" />
        <ellipse cx={-8} cy={0} rx={2.6} ry={3.4} fill={DARK} />
        <ellipse cx={8} cy={0} rx={2.6} ry={3.4} fill={DARK} />
        <path d="M-12 -7 L-4 -6 M4 -6 L12 -7" stroke={DARK} strokeWidth={2.4} strokeLinecap="round" />
        <path data-part="keeper-mouth-focus" d="M-7 11 L7 11" stroke={DARK} strokeWidth={2.6} strokeLinecap="round" />
        <ellipse data-part="keeper-mouth-shock" cx={0} cy={12} rx={4.5} ry={5.5} fill={DARK} opacity={0} />
        <path data-part="keeper-mouth-grin" d="M-9 8 Q0 19 9 8 Z" fill={DARK} opacity={0} />
      </g>
    </g>
  );
}

/** Şutçu: arkadan görünüş; yerel başlangıç noktası ayakların ortası. Kollar ve vuran bacak motorda çözülür. */
function Kicker({ side, team }: { side: 0 | 1; team: ArtTeam }) {
  const look = KICKER_LOOKS[side];
  return (
    <g data-kicker={side}>
      <ellipse data-part="shadow" cx={0} cy={4} rx={50} ry={10} fill="rgb(0 0 0 / 0.3)" />
      {/* Destek bacağı ve vuran bacak */}
      {(["support", "kick"] as const).map((leg) => (
        <g key={leg}>
          <path data-part={`${leg}-leg`} stroke={look.skin} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path data-part={`${leg}-sock`} stroke={team.deep} strokeWidth={22} strokeLinecap="round" fill="none" />
          <ellipse data-part={`${leg}-boot`} rx={17} ry={10} fill="var(--color-ink-950)" />
        </g>
      ))}
      <path d="M-32 -132 H32 L34 -96 H4 L0 -104 L-4 -96 H-34 Z" fill={PANTS} />
      {/* Kollar (motor çizer), forma ve sırt numarası */}
      {(["left", "right"] as const).map((s) => (
        <g key={s}>
          <path data-part={`arm-${s}`} stroke={team.base} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle data-part={`hand-${s}`} r={10} fill={look.skin} />
        </g>
      ))}
      <path d="M-38 -196 Q0 -210 38 -196 L34 -126 H-34 Z" fill={team.base} />
      <path d="M-38 -196 L-34 -126 H-26 L-30 -198 Z" fill={team.deep} opacity={0.6} />
      <text x={0} y={-140} textAnchor="middle" fontSize={50} fontWeight={800} fill="var(--color-cream)">
        {look.number}
      </text>
      <rect x={-9} y={-214} width={18} height={14} fill={look.skin} />
      <g data-part="kicker-head" transform="translate(0 -236)">
        <circle cx={-25} cy={4} r={7} fill={look.skin} />
        <circle cx={25} cy={4} r={7} fill={look.skin} />
        <circle r={26} fill={look.hair} />
        <path d="M-24 10 Q0 22 24 10 L22 18 Q0 28 -22 18 Z" fill={look.hair} opacity={0.7} />
      </g>
    </g>
  );
}
