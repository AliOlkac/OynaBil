import { EMBLEM_SHAPES } from "@/components/ui/TeamEmblem";
import { HAIR, Head, PANTS, SHOE, SKIN, STYLES, type KidLook } from "../../shared/kid";
import {
  ARM_LEN,
  BASE_HALF,
  BODY_HALF,
  CATAPULT_X,
  CRANK_R,
  DRUM,
  GROUND,
  PARAPET_HALF,
  PILE,
  PIVOT,
  ROOF_HALF,
  TOWER_X,
  Y_APEX,
  Y_BASE_TOP,
  Y_BODY_TOP,
  Y_PARAPET,
  Y_ROOF_BASE,
  Y_WINDOW_BOTTOM,
  Y_WINDOW_TOP,
  dirOf,
} from "./geometry";

/**
 * Kule Yıkmaca sahnesinin durağan çizimi. Hareket eden her parça `data-part` ile işaretlidir;
 * motor bunları tek bir requestAnimationFrame döngüsünde günceller, React yeniden çizmez.
 *
 * Sahne: gün batımında iki taş kule. Kuleler orta çağ Anadolu burçlarından esinlenir: taş gövde,
 * çini kuşak, mazgallı burç ve takım renginde kiremitli külah. Mancınıklar ahşap, ekipler çocuk.
 */

export type ArtTeam = { base: string; deep: string; emblem: keyof typeof EMBLEM_SHAPES };

export const DUST_COUNT = 80;
export const CHIP_COUNT = 44;
export const BLOCK_COUNT = 14;
export const TRAIL_COUNT = 8;
export const CLOUDS: { x: number; y: number; s: number }[] = [
  { x: -260, y: 120, s: 1.3 },
  { x: 380, y: 40, s: 0.9 },
  { x: 900, y: 170, s: 1.15 },
  { x: 1500, y: 70, s: 1 },
  { x: 2050, y: 150, s: 0.8 },
];

/** Ekip: her mancınıkta kurucu (arkada, vinçte) ve gözcü (önde). */
export const CREW: { side: 0 | 1; role: "kurucu" | "gozcu"; look: KidLook }[] = [
  { side: 0, role: "kurucu", look: { skin: SKIN[1], hair: HAIR[0], style: STYLES[0] } },
  { side: 0, role: "gozcu", look: { skin: SKIN[0], hair: HAIR[3], style: STYLES[1] } },
  { side: 1, role: "kurucu", look: { skin: SKIN[2], hair: HAIR[2], style: STYLES[2] } },
  { side: 1, role: "gozcu", look: { skin: SKIN[3], hair: HAIR[1], style: STYLES[3] } },
];
export const CREW_X = { kurucu: -98, gozcu: 112 } as const;
export const CREW_SCALE = 1.05;

const STONE = "M-6 -5 L5 -6 L8 2 L0 7 L-7 3 Z";

export function SceneArt({ teams }: { teams: [ArtTeam, ArtTeam] }) {
  return (
    <>
      <defs>
        <linearGradient id="ky-sky" gradientUnits="userSpaceOnUse" x1="0" y1="-700" x2="0" y2="700">
          <stop offset="0" stopColor="var(--color-ink-950)" />
          <stop offset="0.5" stopColor="var(--color-ink-700)" />
          <stop offset="0.82" stopColor="var(--color-ufuk)" />
          <stop offset="1" stopColor="var(--color-ufuk-acik)" />
        </linearGradient>
        <linearGradient id="ky-stone" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--color-tas-koyu)" />
          <stop offset="0.55" stopColor="var(--color-tas)" />
          <stop offset="1" stopColor="var(--color-tas-acik)" />
        </linearGradient>
        <radialGradient id="ky-glow" cx="0.5" cy="0.65" r="0.6">
          <stop offset="0" stopColor="var(--color-ufuk-acik)" />
          <stop offset="0.6" stopColor="var(--color-kehribar)" />
          <stop offset="1" stopColor="var(--color-ates)" />
        </radialGradient>
        <linearGradient id="ky-field" gradientUnits="userSpaceOnUse" x1="0" y1="690" x2="0" y2="1000">
          <stop offset="0" stopColor="var(--color-saha)" />
          <stop offset="1" stopColor="var(--color-saha-acik)" />
        </linearGradient>
      </defs>

      {/* Gökyüzü, güneş, bulutlar */}
      <rect x={-1500} y={-800} width={4600} height={1520} fill="url(#ky-sky)" />
      <circle cx={800} cy={640} r={150} fill="var(--color-ufuk-acik)" opacity={0.22} />
      <circle cx={800} cy={640} r={86} fill="var(--color-ufuk-acik)" opacity={0.9} />
      <g data-part="clouds">
        {CLOUDS.map((c, i) => (
          <g key={i} data-cloud={i} transform={`translate(${c.x} ${c.y}) scale(${c.s})`}>
            <Cloud />
          </g>
        ))}
      </g>

      {/* Uzak tepeler ve serviler */}
      <path d="M-1500 650 L -900 640 C -600 590 -380 600 -150 620 S 250 560 520 600 S 900 640 1120 590 S 1500 560 1760 610 S 2200 600 2500 580 L 3100 600 V 720 H -1500 Z" fill="var(--color-ink-800)" />
      <path d="M-1500 676 L -900 680 C -500 650 -250 690 60 668 S 520 640 760 676 S 1180 650 1420 672 S 1900 650 2500 666 L 3100 670 V 730 H -1500 Z" fill="var(--color-ink-850)" />
      {[-420, -360, 30, 1010, 1060, 1640, 1700, 2020].map((x, i) => (
        <Cypress key={i} x={x} y={i % 2 ? 676 : 670} h={i % 3 === 0 ? 74 : 58} />
      ))}

      {/* Çayır, yol, kulelerin önündeki toprak */}
      <rect x={-1500} y={690} width={4600} height={400} fill="url(#ky-field)" />
      <rect x={-1500} y={690} width={4600} height={8} fill="rgb(0 0 0 / 0.16)" />
      <path d="M-1500 806 L -900 800 C -300 780 300 820 800 800 S 1900 780 2500 806 L 3100 810 L 3100 840 L 2500 836 C 1900 812 1300 834 800 828 S -300 812 -900 830 L -1500 834 Z" fill="var(--color-camur)" opacity={0.35} />
      {[0, 1].map((side) => (
        <ellipse key={side} cx={TOWER_X[side] + dirOf(side as 0 | 1) * 170} cy={GROUND + 14} rx={150} ry={16} fill="var(--color-camur)" opacity={0.55} />
      ))}
      {GRASS.map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} l-5 -12 M${x} ${y} l1 -15 M${x} ${y} l6 -11`} stroke="var(--color-saha-acik)" strokeWidth={3} strokeLinecap="round" />
      ))}

      {/* Kuleler */}
      {([0, 1] as const).map((side) => (
        <Tower key={side} side={side} team={teams[side]} />
      ))}

      {/* Kurucular mancınığın arkasında */}
      {CREW.map((c, i) => (c.role === "kurucu" ? <CrewKid key={i} index={i} look={c.look} team={teams[c.side]} /> : null))}

      {/* Mancınıklar */}
      {([0, 1] as const).map((side) => (
        <Catapult key={side} side={side} team={teams[side]} />
      ))}

      {/* Gözcüler mancınığın önünde */}
      {CREW.map((c, i) => (c.role === "gozcu" ? <CrewKid key={i} index={i} look={c.look} team={teams[c.side]} /> : null))}

      {/* Tutukluk yapan mancınığın düşürdüğü taş */}
      <g data-part="dud" opacity={0}>
        <Stone />
      </g>

      {/* Mermi: gölge, iz, taş ve ateş */}
      <ellipse data-part="shot-shadow" rx={18} ry={5} fill="rgb(0 0 0 / 0.28)" opacity={0} />
      <g>
        {Array.from({ length: TRAIL_COUNT }, (_, i) => (
          <circle key={i} data-trail={i} r={0} opacity={0} />
        ))}
      </g>
      <g data-part="shot" opacity={0}>
        <g data-part="shot-fire" opacity={0}>
          <path d="M0 -15 C -30 -14 -58 -6 -78 0 C -58 6 -30 14 0 15 Z" fill="var(--color-ates)" opacity={0.85} />
          <path d="M0 -10 C -20 -9 -36 -4 -48 0 C -36 4 -20 9 0 10 Z" fill="var(--color-kehribar)" />
        </g>
        <g data-part="shot-stone">
          <Stone />
        </g>
      </g>

      {/* Düşen bloklar: mazgal, kiremit, yıkılışta kule parçaları */}
      <g>
        {Array.from({ length: BLOCK_COUNT }, (_, i) => (
          <g key={i} data-block={i} opacity={0}>
            <rect x={-13} y={-22} width={26} height={44} rx={3} fill="var(--color-tas)" />
            <rect x={-13} y={-22} width={10} height={44} rx={3} fill="var(--color-tas-koyu)" opacity={0.6} />
            <line x1={-13} y1={0} x2={13} y2={0} stroke="var(--color-tas-derz)" strokeWidth={2} opacity={0.6} />
          </g>
        ))}
      </g>

      {/* Parçacıklar: toz ve taş kırıkları */}
      <g>
        {Array.from({ length: DUST_COUNT }, (_, i) => (
          <circle key={i} data-dust={i} r={0} opacity={0} />
        ))}
        {Array.from({ length: CHIP_COUNT }, (_, i) => (
          <path key={i} data-chip={i} d={STONE} opacity={0} />
        ))}
      </g>
      <circle data-part="ring" r={0} fill="none" stroke="var(--color-kehribar)" strokeWidth={8} opacity={0} />

      {/* Nişangâh */}
      <g data-part="crosshair" opacity={0}>
        <line data-part="aim-line" stroke="var(--color-cream)" strokeWidth={4} strokeDasharray="14 10" opacity={0.85} />
        <g data-part="reticle">
          <circle r={34} fill="rgb(7 18 40 / 0.25)" stroke="var(--color-ink-950)" strokeWidth={11} />
          <circle data-part="reticle-ring" r={34} fill="none" strokeWidth={6} />
          {[0, 90, 180, 270].map((a) => (
            <line key={a} x1={0} y1={-46} x2={0} y2={-24} stroke="var(--color-cream)" strokeWidth={6} strokeLinecap="round" transform={`rotate(${a})`} />
          ))}
          <circle r={6} fill="var(--color-cream)" />
        </g>
      </g>

      {/* Hasar yazısı */}
      <g data-part="popup" opacity={0} style={{ paintOrder: "stroke" }} textAnchor="middle" fontWeight={700}>
        <text data-part="popup-value" y={0} fontSize={92} stroke="var(--color-ink-950)" strokeWidth={14} strokeLinejoin="round" />
        <text data-part="popup-label" y={50} fontSize={40} fill="var(--color-cream)" stroke="var(--color-ink-950)" strokeWidth={10} strokeLinejoin="round" />
      </g>
    </>
  );
}

const GRASS: [number, number][] = [
  [-120, 740], [60, 800], [340, 776], [460, 850], [690, 770], [760, 880], [930, 790], [1180, 860], [1260, 772], [1540, 820], [1720, 760], [1880, 860],
];

function Cloud() {
  return (
    <g fill="var(--color-cream)" opacity={0.78}>
      <ellipse cx={0} cy={0} rx={90} ry={26} />
      <circle cx={-34} cy={-16} r={30} />
      <circle cx={10} cy={-28} r={38} />
      <circle cx={52} cy={-12} r={26} />
      <ellipse cx={4} cy={10} rx={86} ry={14} fill="var(--color-ufuk-acik)" opacity={0.7} />
    </g>
  );
}

function Cypress({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g>
      <path d={`M${x} ${y - h} C ${x + 14} ${y - h * 0.6} ${x + 14} ${y - 8} ${x + 3} ${y} H ${x - 3} C ${x - 14} ${y - 8} ${x - 14} ${y - h * 0.6} ${x} ${y - h} Z`} fill="var(--color-servi)" />
    </g>
  );
}

export function Stone() {
  return (
    <>
      <circle r={16} fill="var(--color-tas-koyu)" />
      <circle cx={-4} cy={-5} r={8} fill="var(--color-tas)" opacity={0.75} />
      <circle cx={5} cy={6} r={3.5} fill="var(--color-tas-derz)" />
      <circle cx={-7} cy={6} r={2.2} fill="var(--color-tas-derz)" />
      <circle cx={-6} cy={-8} r={2.6} fill="var(--color-tas-acik)" />
    </>
  );
}

/** Derz çizgileri: sıralı taş örgü. */
function Masonry({ top, bottom, half, offset = 0 }: { top: number; bottom: number; half: number; offset?: number }) {
  const rows: string[] = [];
  const step = 20;
  for (let y = bottom - step, r = 0; y > top + 2; y -= step, r++) {
    rows.push(`M${-half} ${y} H${half}`);
  }
  for (let y = bottom, r = 0; y > top + 2; y -= step, r++) {
    const shift = (r + offset) % 2 ? 0 : 22;
    for (let x = -half + 12 + shift; x < half - 6; x += 44) rows.push(`M${x} ${y} V${Math.max(top, y - step)}`);
  }
  return <path d={rows.join("")} stroke="var(--color-tas-derz)" strokeWidth={2.2} opacity={0.45} fill="none" />;
}

function Tower({ side, team }: { side: 0 | 1; team: ArtTeam }) {
  const mirror = side === 1 ? -1 : 1;
  const midWindow = (Y_WINDOW_BOTTOM + Y_WINDOW_TOP) / 2;
  return (
    <g data-tower={side} transform={`translate(${TOWER_X[side]} 0) scale(${mirror} 1)`}>
      {/* Hasarla biriken moloz */}
      <g data-part="debris" opacity={0}>
        {[[118, 4, 1], [138, 10, 0.8], [104, 12, 0.7], [156, 6, 0.6], [-112, 8, 0.7]].map(([x, y, s], i) => (
          <path key={i} d={STONE} transform={`translate(${x} ${GROUND + y}) scale(${s * 2.4})`} fill={i % 2 ? "var(--color-tas)" : "var(--color-tas-koyu)"} />
        ))}
      </g>

      <g data-part="tower-body">
        {/* 0: temel */}
        <g data-seg={0}>
          <path d={`M${-BASE_HALF - 6} ${GROUND} L${-BASE_HALF + 4} ${Y_BASE_TOP} H${BASE_HALF - 4} L${BASE_HALF + 6} ${GROUND} Z`} fill="url(#ky-stone)" />
          <Masonry top={Y_BASE_TOP} bottom={GROUND} half={BASE_HALF - 2} />
          <path d={`M-21 ${GROUND} V${GROUND - 34} A21 21 0 0 1 21 ${GROUND - 34} V${GROUND} Z`} fill="var(--color-ahsap-koyu)" />
          <path d={`M-7 ${GROUND} V${GROUND - 50} M7 ${GROUND} V${GROUND - 50}`} stroke="var(--color-ahsap)" strokeWidth={3} />
          <rect x={-BASE_HALF + 4} y={Y_BASE_TOP - 6} width={(BASE_HALF - 4) * 2} height={8} fill="var(--color-tas-acik)" />
          <path data-part="chips" d={`M${BASE_HALF - 2} ${GROUND - 40} l-14 6 l4 12 l12 2 Z M${BASE_HALF - 8} ${Y_BASE_TOP + 10} l-12 2 l2 10 l12 -2 Z`} fill="var(--color-tas-derz)" opacity={0} />
        </g>
        {/* 1: alt gövde */}
        <g data-seg={1}>
          <rect x={-BODY_HALF} y={Y_WINDOW_BOTTOM} width={BODY_HALF * 2} height={Y_BASE_TOP - Y_WINDOW_BOTTOM} fill="url(#ky-stone)" />
          <Masonry top={Y_WINDOW_BOTTOM} bottom={Y_BASE_TOP} half={BODY_HALF} offset={1} />
        </g>
        {/* 2: pencere katı */}
        <g data-seg={2}>
          <rect x={-BODY_HALF} y={Y_WINDOW_TOP} width={BODY_HALF * 2} height={Y_WINDOW_BOTTOM - Y_WINDOW_TOP} fill="url(#ky-stone)" />
          <Masonry top={Y_WINDOW_TOP} bottom={Y_WINDOW_BOTTOM} half={BODY_HALF} />
          <path d={`M-26 ${Y_WINDOW_BOTTOM - 2} V${midWindow - 2} A26 26 0 0 1 26 ${midWindow - 2} V${Y_WINDOW_BOTTOM - 2} Z`} fill="var(--color-tas-acik)" />
          <path d={`M-18 ${Y_WINDOW_BOTTOM - 6} V${midWindow} A18 18 0 0 1 18 ${midWindow} V${Y_WINDOW_BOTTOM - 6} Z`} fill="var(--color-ink-950)" />
          <path data-part="glow" d={`M-18 ${Y_WINDOW_BOTTOM - 6} V${midWindow} A18 18 0 0 1 18 ${midWindow} V${Y_WINDOW_BOTTOM - 6} Z`} fill="url(#ky-glow)" />
          <path data-part="mullion" d={`M0 ${midWindow - 18} V${Y_WINDOW_BOTTOM - 6} M-18 ${midWindow + 4} H18`} stroke="var(--color-ahsap-koyu)" strokeWidth={4} />
          <g data-part="shutters">
            <path d={`M-21 ${Y_WINDOW_BOTTOM - 6} V${midWindow - 4} L-40 ${midWindow - 8} V${Y_WINDOW_BOTTOM - 2} Z`} fill={team.deep} />
            <path d={`M21 ${Y_WINDOW_BOTTOM - 6} V${midWindow - 4} L40 ${midWindow - 8} V${Y_WINDOW_BOTTOM - 2} Z`} fill={team.deep} />
            <path d={`M-31 ${midWindow} V${Y_WINDOW_BOTTOM - 6} M31 ${midWindow} V${Y_WINDOW_BOTTOM - 6}`} stroke={team.base} strokeWidth={3} />
          </g>
          <path data-part="broken" d={`M-30 ${Y_WINDOW_BOTTOM} L-34 ${midWindow + 6} L-24 ${midWindow - 16} L-6 ${midWindow - 30} L12 ${midWindow - 24} L30 ${midWindow - 10} L36 ${midWindow + 12} L28 ${Y_WINDOW_BOTTOM + 4} Z`} fill="var(--color-ink-950)" opacity={0} />
          <rect x={-30} y={Y_WINDOW_BOTTOM - 4} width={60} height={8} rx={2} fill="var(--color-tas-acik)" />
        </g>
        {/* 3: üst gövde, çini kuşak */}
        <g data-seg={3}>
          <rect x={-BODY_HALF} y={Y_BODY_TOP} width={BODY_HALF * 2} height={Y_WINDOW_TOP - Y_BODY_TOP} fill="url(#ky-stone)" />
          <Masonry top={Y_BODY_TOP + 14} bottom={Y_WINDOW_TOP} half={BODY_HALF} offset={1} />
          <rect x={-5} y={Y_WINDOW_TOP - 54} width={10} height={34} rx={5} fill="var(--color-ink-950)" />
          <rect x={-BODY_HALF} y={Y_BODY_TOP + 2} width={BODY_HALF * 2} height={14} fill="var(--color-firuze-deep)" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M${-BODY_HALF + 9 + i * 18.5} ${Y_BODY_TOP + 9} l7 -6 l7 6 l-7 6 Z`} fill={i % 2 ? "var(--color-cream)" : "var(--color-firuze)"} />
          ))}
        </g>
        {/* 4: burç ve mazgallar */}
        <g data-seg={4}>
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M${-80 + i * 20} ${Y_BODY_TOP} q 6 12 12 0 Z`} fill="var(--color-tas-koyu)" />
          ))}
          <rect x={-PARAPET_HALF} y={Y_PARAPET} width={PARAPET_HALF * 2} height={Y_BODY_TOP - Y_PARAPET} fill="url(#ky-stone)" />
          <line x1={-PARAPET_HALF} y1={Y_PARAPET + 2} x2={PARAPET_HALF} y2={Y_PARAPET + 2} stroke="var(--color-tas-acik)" strokeWidth={4} />
          {MERLONS.map((x, k) => (
            <g key={k} data-merlon={k}>
              <rect x={x} y={Y_ROOF_BASE + 4} width={24} height={Y_PARAPET - Y_ROOF_BASE - 4} fill="url(#ky-stone)" />
              <rect x={x} y={Y_ROOF_BASE + 4} width={24} height={5} fill="var(--color-tas-acik)" />
            </g>
          ))}
        </g>
        {/* 5: külah ve bayrak */}
        <g data-seg={5}>
          <g data-part="roof">
            <path d={`M${-ROOF_HALF} ${Y_ROOF_BASE} L0 ${Y_APEX} L${ROOF_HALF} ${Y_ROOF_BASE} Z`} fill={team.deep} />
            {[0.28, 0.52, 0.76].map((t) => {
              const y = Y_APEX + (Y_ROOF_BASE - Y_APEX) * t;
              const hw = ROOF_HALF * t;
              return <line key={t} x1={-hw} y1={y} x2={hw} y2={y} stroke={team.base} strokeWidth={7} />;
            })}
            <path d={`M0 ${Y_APEX} L${ROOF_HALF * 0.5} ${Y_ROOF_BASE} M0 ${Y_APEX} L${-ROOF_HALF * 0.5} ${Y_ROOF_BASE}`} stroke="rgb(7 18 40 / 0.25)" strokeWidth={3} />
            <path d={`M0 ${Y_APEX} L${ROOF_HALF} ${Y_ROOF_BASE} L${ROOF_HALF * 0.55} ${Y_ROOF_BASE} Z`} fill="rgb(255 255 255 / 0.12)" />
            <rect x={-ROOF_HALF - 6} y={Y_ROOF_BASE - 2} width={(ROOF_HALF + 6) * 2} height={8} rx={2} fill="var(--color-ahsap-koyu)" />
            <path data-part="roof-hole" d={`M30 ${Y_ROOF_BASE - 6} L22 ${Y_ROOF_BASE - 22} L36 ${Y_ROOF_BASE - 34} L52 ${Y_ROOF_BASE - 26} L58 ${Y_ROOF_BASE - 8} Z`} fill="var(--color-ink-950)" opacity={0} />
          </g>
          <line x1={0} y1={Y_APEX} x2={0} y2={Y_APEX - 58} stroke="var(--color-ink-300)" strokeWidth={4} strokeLinecap="round" />
          <circle cx={0} cy={Y_APEX - 2} r={6} fill="var(--color-kehribar)" />
          <g data-part="flag" transform={`translate(0 ${Y_APEX - 56})`}>
            <path data-part="flag-cloth" fill={team.base} />
          </g>
        </g>
        {/* Çatlaklar: kulenin isabet alan iç yüzünde */}
        <g fill="none" stroke="var(--color-tas-derz)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round">
          {CRACKS.map((d, k) => (
            <path key={k} data-crack={k} d={d} opacity={0} />
          ))}
        </g>
      </g>

      {/* Yıkılınca kalan moloz yığını */}
      <g data-part="rubble" transform={`translate(0 ${GROUND}) scale(1 0)`}>
        <path d="M-170 10 C -150 -40 -100 -70 -40 -78 C 0 -96 50 -80 90 -66 C 140 -48 168 -20 180 10 Z" fill="var(--color-tas-koyu)" />
        {RUBBLE.map(([x, y, s, r], i) => (
          <path key={i} d={STONE} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} fill={i % 3 === 0 ? "var(--color-tas-acik)" : "var(--color-tas)"} />
        ))}
        <line x1={20} y1={-70} x2={70} y2={-170} stroke="var(--color-ink-300)" strokeWidth={4} strokeLinecap="round" />
        <path d="M70 -170 L118 -160 L104 -150 L116 -138 L66 -146 Z" fill={team.base} />
      </g>
    </g>
  );
}

const MERLONS = [-90, -51, -12, 27, 66];
const CRACKS = [
  `M${BASE_HALF - 4} ${GROUND - 30} l-16 -8 l-6 -14 l-14 -4`,
  `M${BODY_HALF} ${Y_BASE_TOP - 30} l-18 6 l-10 -12 l-16 2 l-8 14`,
  `M${BODY_HALF} ${Y_WINDOW_TOP - 20} l-14 -10 l-18 4 l-6 -16`,
  `M${BODY_HALF - 30} ${Y_WINDOW_BOTTOM + 30} l-20 18 l-6 22 l-18 10`,
  `M${-BODY_HALF + 10} ${Y_WINDOW_TOP - 40} l18 10 l4 18 l16 8`,
  `M${PARAPET_HALF - 10} ${Y_BODY_TOP - 6} l-14 12 l-20 -2`,
];
const RUBBLE: [number, number, number, number][] = [
  [-130, -6, 3, 10], [-96, -30, 3.4, 40], [-60, -50, 3, -20], [-20, -66, 3.6, 15], [24, -70, 3.2, 60], [64, -52, 3.4, -35], [104, -34, 3, 25], [140, -10, 3.2, -10],
  [-80, -8, 2.4, 70], [-30, -30, 2.6, 0], [40, -24, 2.8, 90], [96, -6, 2.4, 45], [0, -84, 2.2, 30], [-150, 4, 2, 0], [160, 4, 2.2, 20],
];

function Catapult({ side, team }: { side: 0 | 1; team: ArtTeam }) {
  const d = dirOf(side);
  const wheel = (cx: number) => (
    <g data-part="wheel" transform={`translate(${cx} -24)`}>
      <circle r={24} fill="var(--color-ahsap-koyu)" />
      <circle r={17} fill="var(--color-ahsap)" />
      <g stroke="var(--color-ahsap-koyu)" strokeWidth={4}>
        <line x1={-17} y1={0} x2={17} y2={0} />
        <line x1={-8.5} y1={-14.7} x2={8.5} y2={14.7} />
        <line x1={-8.5} y1={14.7} x2={8.5} y2={-14.7} />
      </g>
      <circle r={5} fill="var(--color-ink-950)" />
    </g>
  );
  return (
    <g data-catapult={side} transform={`translate(${CATAPULT_X[side]} ${GROUND}) scale(${d} 1)`}>
      {/* Taş yığını: kurucu taşı buradan alır */}
      <g transform={`translate(${PILE.x} ${PILE.y})`}>
        {[[-14, -13], [14, -13], [0, -36]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(0.85)`}>
            <Stone />
          </g>
        ))}
      </g>
      <g data-part="cat-body">
        {/* Takım flaması */}
        <line x1={-112} y1={-34} x2={-112} y2={-196} stroke="var(--color-ahsap-koyu)" strokeWidth={6} strokeLinecap="round" />
        <g transform="translate(-112 -194)">
          <path data-part="pennant" fill={team.base} />
          <g data-part="pennant-emblem" transform="translate(10 6) scale(1.05)" fill="var(--color-ink-950)" opacity={0.85}>
            {EMBLEM_SHAPES[team.emblem]}
          </g>
        </g>
        {/* Gövde: kızak, dikmeler, kasnak */}
        <rect x={-96} y={-42} width={180} height={16} rx={5} fill="var(--color-ahsap)" />
        <rect x={-96} y={-42} width={180} height={5} rx={2} fill="var(--color-ahsap-acik)" />
        <path d="M-22 -36 L22 -166 M70 -36 L30 -166" stroke="var(--color-ahsap)" strokeWidth={13} strokeLinecap="round" />
        <path d="M2 -98 L50 -98" stroke="var(--color-ahsap-koyu)" strokeWidth={8} strokeLinecap="round" />
        <rect x={8} y={-178} width={46} height={16} rx={4} fill="var(--color-ahsap-koyu)" />
        <rect x={6} y={-170} width={14} height={24} rx={6} fill={team.base} />
        {/* Vinç */}
        <path d={`M${DRUM.x - 10} -36 L${DRUM.x} ${DRUM.y} L${DRUM.x + 10} -36`} stroke="var(--color-ahsap-koyu)" strokeWidth={8} fill="none" strokeLinejoin="round" />
        <circle cx={DRUM.x} cy={DRUM.y} r={13} fill="var(--color-ahsap-koyu)" />
        <circle cx={DRUM.x} cy={DRUM.y} r={8} fill="var(--color-ip)" />
        <path data-part="winch-rope" stroke="var(--color-ip)" strokeWidth={4} fill="none" strokeLinecap="round" />
        {/* Kol: kepçe ve yüklü taş */}
        <g data-part="arm">
          <rect x={-14} y={-7} width={ARM_LEN - 6} height={14} rx={6} fill="var(--color-ahsap-acik)" />
          <rect x={-14} y={2} width={ARM_LEN - 6} height={5} rx={2} fill="var(--color-ahsap)" />
          <path d="M40 -8 V8 M48 -8 V8 M56 -8 V8" stroke="var(--color-ip-koyu)" strokeWidth={3} />
          <g data-part="loaded" opacity={0} transform={`translate(${ARM_LEN} 5)`}>
            <g data-part="loaded-fire" opacity={0}>
              <path d="M-14 -4 C -20 10 -10 26 0 34 C 10 26 20 10 14 -4 Z" fill="var(--color-ates)" />
              <path d="M-7 0 C -10 10 -5 18 0 24 C 5 18 10 10 7 0 Z" fill="var(--color-kehribar)" />
            </g>
            <Stone />
          </g>
          <path d={`M${ARM_LEN - 22} 0 A22 20 0 0 1 ${ARM_LEN + 22} 0 L${ARM_LEN + 15} 0 A15 13 0 0 0 ${ARM_LEN - 15} 0 Z`} fill="var(--color-ahsap-koyu)" />
        </g>
        <circle cx={PIVOT.x} cy={PIVOT.y} r={9} fill="var(--color-ink-950)" />
        <circle cx={PIVOT.x} cy={PIVOT.y} r={4} fill="var(--color-ink-400)" />
        <g data-part="crank" transform={`translate(${DRUM.x} ${DRUM.y})`}>
          <line x1={0} y1={0} x2={CRANK_R} y2={0} stroke="var(--color-ink-950)" strokeWidth={5} strokeLinecap="round" />
          <circle cx={CRANK_R} cy={0} r={5} fill="var(--color-ahsap-acik)" />
        </g>
        {wheel(-62)}
        {wheel(56)}
      </g>
    </g>
  );
}

function CrewKid({ index, look, team }: { index: number; look: KidLook; team: ArtTeam }) {
  return (
    <g data-crew={index}>
      <path data-part="farUpper" stroke={team.deep} strokeWidth={12} strokeLinecap="round" fill="none" />
      <path data-part="farFore" stroke={look.skin} strokeWidth={10} strokeLinecap="round" fill="none" />
      <circle data-part="farHand" r={6.5} fill={look.skin} />
      <path data-part="legBack" stroke={PANTS} strokeWidth={14} strokeLinecap="round" fill="none" />
      <ellipse data-part="shoeBack" cy={-3} rx={12} ry={6.5} fill={SHOE} />
      <path data-part="legFront" stroke={PANTS} strokeWidth={14} strokeLinecap="round" fill="none" />
      <ellipse data-part="shoeFront" cy={-3} rx={12} ry={6.5} fill={SHOE} />
      <circle data-part="shorts" r={15} fill={PANTS} />
      <path data-part="torso" stroke={team.base} strokeWidth={32} strokeLinecap="round" fill="none" />
      <path data-part="stripe" stroke={team.deep} strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.8} />
      <g data-part="head">
        <Head look={look} />
      </g>
      <path data-part="nearUpper" stroke={team.base} strokeWidth={13} strokeLinecap="round" fill="none" />
      <path data-part="nearFore" stroke={look.skin} strokeWidth={10.5} strokeLinecap="round" fill="none" />
      <circle data-part="nearHand" r={7} fill={look.skin} stroke="rgb(0 0 0 / 0.15)" strokeWidth={1.5} />
      <g data-part="held" opacity={0}>
        <Stone />
      </g>
    </g>
  );
}

/** Nişan alırken kulenin yanında beliren hasar cetveli: hangi yüksekliğin kaç hasar verdiği. */
export function DamageRuler({ target, values }: { target: 0 | 1; values: { from: number; to: number; damage: number; crit: boolean }[] }) {
  const d = dirOf(target === 0 ? 1 : 0);
  // Cetvel, hedef kulenin dış yanında durur; nişan çizgisi kuleyi boydan boya geçip cetvele ulaşır.
  const x = TOWER_X[target] + d * (BASE_HALF + 40);
  return (
    <g data-part="ruler" opacity={0}>
      {values.map((v, i) => {
        const top = Math.min(v.from, v.to);
        const h = Math.abs(v.to - v.from);
        const fill = v.damage === 0 ? "var(--color-ink-600)" : v.crit ? "var(--color-kehribar)" : "var(--color-cream)";
        return (
          <g key={i}>
            <rect x={x - 9} y={top + 1.5} width={18} height={h - 3} rx={4} fill={fill} opacity={v.damage === 0 ? 0.55 : 0.92} stroke="var(--color-ink-950)" strokeWidth={3} />
            {v.damage > 0 && (
              <text
                x={x + d * 36}
                y={top + h / 2 + 12}
                fontSize={v.crit ? 40 : 32}
                fontWeight={700}
                textAnchor="middle"
                fill={v.crit ? "var(--color-kehribar)" : "var(--color-cream)"}
                stroke="var(--color-ink-950)"
                strokeWidth={8}
                strokeLinejoin="round"
                style={{ paintOrder: "stroke" }}
              >
                {v.damage}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
