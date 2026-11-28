import { Head, HAIR, PANTS, SHOE, SKIN, type KidLook } from "@/games/shared/kid";
import type { SCENES } from "./model";

/**
 * Ders sahnelerinin çizimleri (1600x900). Canlandırma CSS ile yapılır ve hareket azaltma tercihinde durur.
 * Kural: Allah, peygamberler ve melekler resmedilmez; sahneler doğa, gök, mimari ve çocuklardır.
 */

const CSS = `
@media (prefers-reduced-motion: no-preference) {
  .ld-twinkle { animation: ld-twinkle 2.6s ease-in-out infinite; }
  .ld-float { animation: ld-float 5s ease-in-out infinite; }
  .ld-orbit { animation: ld-spin 26s linear infinite; transform-box: view-box; }
  .ld-sun { animation: ld-sun 18s ease-in-out infinite alternate; transform-box: view-box; transform-origin: 800px 900px; }
  .ld-bee { animation: ld-bee 7s ease-in-out infinite; }
  .ld-rain { animation: ld-rain 1.1s linear infinite; }
  .ld-steam { animation: ld-steam 3.2s ease-in-out infinite; }
  .ld-glow { animation: ld-glow 4s ease-in-out infinite; }
  .ld-bird { animation: ld-bird 14s linear infinite; }
  .ld-sway { animation: ld-sway 4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
}
@keyframes ld-twinkle { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
@keyframes ld-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
@keyframes ld-spin { to { transform: rotate(360deg) } }
@keyframes ld-sun { from { transform: rotate(-24deg) } to { transform: rotate(24deg) } }
@keyframes ld-bee { 0% { transform: translate(0,0) } 25% { transform: translate(90px,-50px) } 50% { transform: translate(180px,10px) } 75% { transform: translate(80px,40px) } 100% { transform: translate(0,0) } }
@keyframes ld-rain { from { transform: translateY(-30px); opacity: 0 } 20% { opacity: .9 } to { transform: translateY(120px); opacity: 0 } }
@keyframes ld-steam { 0% { transform: translateY(0) scaleX(1); opacity: 0 } 30% { opacity: .7 } 100% { transform: translateY(-70px) scaleX(1.4); opacity: 0 } }
@keyframes ld-glow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes ld-bird { from { transform: translateX(-300px) } to { transform: translateX(1900px) } }
@keyframes ld-sway { 0%,100% { transform: rotate(-2deg) } 50% { transform: rotate(2deg) } }
.ld-kid [data-part="mouthGrit"] { opacity: 0 }
.ld-kid [data-part="mouthSmile"] { opacity: 1 }
`;

/** Deterministik "rastgele": sahne her açılışta aynı görünür. */
function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Basit çocuk figürü: baş, gövde, kollar ve bacaklar. (x, y) ayakların ortasıdır. */
function Kid({ x, y, look, shirt, face = 1, scale = 1.6, wave = false }: { x: number; y: number; look: KidLook; shirt: string; face?: 1 | -1; scale?: number; wave?: boolean }) {
  return (
    <g className="ld-kid" transform={`translate(${x} ${y}) scale(${face * scale} ${scale})`}>
      <ellipse cy={4} rx={30} ry={6} fill="rgb(0 0 0 / 0.25)" />
      <path d="M-8 0 L-6 -46 M8 0 L6 -46" stroke={PANTS} strokeWidth={13} strokeLinecap="round" />
      <ellipse cx={-8} cy={1} rx={10} ry={5} fill={SHOE} />
      <ellipse cx={9} cy={1} rx={10} ry={5} fill={SHOE} />
      <rect x={-18} y={-104} width={36} height={62} rx={14} fill={shirt} />
      <path d={wave ? "M12 -92 L30 -128" : "M12 -92 L22 -58"} stroke={shirt} strokeWidth={11} strokeLinecap="round" />
      <circle cx={wave ? 31 : 22} cy={wave ? -131 : -55} r={6.5} fill={look.skin} />
      <path d="M-12 -92 L-20 -60" stroke={shirt} strokeWidth={11} strokeLinecap="round" />
      <circle cx={-20} cy={-57} r={6.5} fill={look.skin} />
      <g transform="translate(0 -124)">
        <Head look={look} />
      </g>
    </g>
  );
}

const ELIF: KidLook = { skin: SKIN[1], hair: HAIR[3], style: "ponytail" };
const CAN: KidLook = { skin: SKIN[0], hair: HAIR[0], style: "short" };
const ZEYNEP: KidLook = { skin: SKIN[2], hair: HAIR[2], style: "curly" };

/** Hilal: dış daireden iç daire çıkarılmış ay. */
function Crescent({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const id = `hilal-${cx}-${cy}`;
  return (
    <>
      <defs>
        <mask id={id}>
          <circle cx={cx} cy={cy} r={r} fill="#fff" />
          <circle cx={cx + r * 0.42} cy={cy - r * 0.18} r={r * 0.86} fill="#000" />
        </mask>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={fill} mask={`url(#${id})`} />
    </>
  );
}

function Hills({ colors, y = 690 }: { colors: [string, string, string]; y?: number }) {
  return (
    <>
      <path d={`M0 ${y - 60} C 260 ${y - 170} 520 ${y - 60} 800 ${y - 110} S 1340 ${y - 200} 1600 ${y - 90} V900 H0 Z`} fill={colors[0]} />
      <path d={`M0 ${y} C 300 ${y - 90} 600 ${y + 10} 900 ${y - 50} S 1400 ${y - 60} 1600 ${y - 10} V900 H0 Z`} fill={colors[1]} />
      <path d={`M0 ${y + 90} C 400 ${y + 30} 800 ${y + 120} 1600 ${y + 60} V900 H0 Z`} fill={colors[2]} />
    </>
  );
}

function Night() {
  const r = rnd(7);
  const stars = Array.from({ length: 70 }, () => ({ x: r() * 1600, y: r() * 560, s: 1.2 + r() * 3, d: r() * 2.6 }));
  return (
    <>
      <defs>
        <linearGradient id="ld-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060d24" />
          <stop offset="0.7" stopColor="#13285a" />
          <stop offset="1" stopColor="#2a3f7c" />
        </linearGradient>
        <radialGradient id="ld-moonglow">
          <stop offset="0" stopColor="var(--color-kehribar)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--color-kehribar)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={1600} height={900} fill="url(#ld-night)" />
      {stars.map((s, i) => (
        <circle key={i} className="ld-twinkle" style={{ animationDelay: `${s.d}s` }} cx={s.x} cy={s.y} r={s.s} fill="var(--color-cream)" />
      ))}
      <circle cx={1220} cy={200} r={190} fill="url(#ld-moonglow)" className="ld-glow" />
      <Crescent cx={1220} cy={200} r={86} fill="var(--color-kehribar)" />
      {/* Gezegenler: güneşin çevresinde dönen yollar */}
      <circle cx={380} cy={250} r={170} fill="none" stroke="var(--color-ink-400)" strokeOpacity={0.35} strokeDasharray="4 10" strokeWidth={2} />
      <circle cx={380} cy={250} r={105} fill="none" stroke="var(--color-ink-400)" strokeOpacity={0.35} strokeDasharray="4 10" strokeWidth={2} />
      <circle cx={380} cy={250} r={34} fill="var(--color-ates)" />
      <g className="ld-orbit" style={{ transformOrigin: "380px 250px" }}>
        <circle cx={550} cy={250} r={15} fill="var(--color-kobalt)" />
        <circle cx={380} cy={145} r={10} fill="var(--color-mercan)" />
      </g>
      <Hills colors={["#0f1f45", "#0b1838", "#08122b"]} y={720} />
      <g transform="translate(820 742)" opacity={0.95}>
        <Kid x={0} y={0} look={CAN} shirt="var(--color-kobalt)" face={-1} scale={1.3} />
      </g>
    </>
  );
}

function Nature() {
  const flowers = [140, 300, 520, 1060, 1260, 1460];
  return (
    <>
      <defs>
        <linearGradient id="ld-day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc4ff" />
          <stop offset="1" stopColor="#d9f0ff" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill="url(#ld-day)" />
      <g className="ld-sun">
        <circle cx={800} cy={250} r={70} fill="var(--color-kehribar)" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <line key={i} x1={800 + Math.cos(a) * 92} y1={250 + Math.sin(a) * 92} x2={800 + Math.cos(a) * 124} y2={250 + Math.sin(a) * 124} stroke="var(--color-kehribar)" strokeWidth={9} strokeLinecap="round" />;
        })}
      </g>
      {/* Yağmur bulutu */}
      <g className="ld-float">
        <g fill="#fff">
          <ellipse cx={1250} cy={180} rx={110} ry={46} />
          <circle cx={1200} cy={150} r={50} />
          <circle cx={1290} cy={140} r={60} />
        </g>
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} className="ld-rain" style={{ animationDelay: `${(i % 4) * 0.27}s` }} x1={1170 + i * 20} y1={240} x2={1162 + i * 20} y2={268} stroke="var(--color-kobalt)" strokeWidth={5} strokeLinecap="round" />
        ))}
      </g>
      <Hills colors={["#7fc97a", "#4fa863", "var(--color-cim)"]} />
      {/* Ağaçlar */}
      {[240, 1360].map((x, i) => (
        <g key={x} className="ld-sway" style={{ animationDelay: `${i * 0.8}s` }}>
          <rect x={x - 12} y={560} width={24} height={110} rx={8} fill="var(--color-ahsap-koyu)" />
          <circle cx={x} cy={540} r={74} fill="#2f8f4e" />
          <circle cx={x - 46} cy={576} r={48} fill="#38a35a" />
          <circle cx={x + 48} cy={572} r={50} fill="#2b8247" />
        </g>
      ))}
      {/* Çiçekler ve arı */}
      {flowers.map((x, i) => (
        <g key={x} transform={`translate(${x} ${760 + (i % 2) * 30})`}>
          <line y1={0} y2={50} stroke="#2b8247" strokeWidth={6} />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 14} cy={Math.sin((a * Math.PI) / 180) * 14} r={11} fill={i % 2 ? "var(--color-mercan)" : "#fff"} />
          ))}
          <circle r={9} fill="var(--color-kehribar)" />
        </g>
      ))}
      <g className="ld-bee" transform="translate(560 640)">
        <ellipse rx={22} ry={15} fill="var(--color-kehribar)" stroke="var(--color-ink-950)" strokeWidth={3} />
        <path d="M-6 -14 V14 M6 -14 V14" stroke="var(--color-ink-950)" strokeWidth={5} />
        <ellipse cx={-4} cy={-22} rx={11} ry={8} fill="#fff" opacity={0.85} />
        <ellipse cx={8} cy={-20} rx={9} ry={7} fill="#fff" opacity={0.85} />
      </g>
    </>
  );
}

function Kids() {
  return (
    <>
      <defs>
        <linearGradient id="ld-warm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe7b8" />
          <stop offset="1" stopColor="#ffd08a" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill="url(#ld-warm)" />
      <circle cx={1300} cy={210} r={90} fill="#fff4d6" />
      <Hills colors={["#a8d98a", "#86c870", "#6fb65d"]} y={720} />
      <Kid x={560} y={760} look={ELIF} shirt="var(--color-mercan)" scale={2.1} wave />
      <Kid x={1040} y={760} look={ZEYNEP} shirt="var(--color-zumrut)" face={-1} scale={2.1} />
      <g className="ld-float">
        <path d="M800 300 c -40 -50 -110 -10 -70 45 l 70 70 l 70 -70 c 40 -55 -30 -95 -70 -45 z" fill="var(--color-mercan)" />
      </g>
      {[[700, 230], [910, 210], [800, 160]].map(([x, y], i) => (
        <g key={i} className="ld-twinkle" style={{ animationDelay: `${i * 0.6}s` }}>
          <path d={`M${x} ${y - 16} L${x + 5} ${y - 5} L${x + 16} ${y} L${x + 5} ${y + 5} L${x} ${y + 16} L${x - 5} ${y + 5} L${x - 16} ${y} L${x - 5} ${y - 5} Z`} fill="var(--color-kehribar)" />
        </g>
      ))}
    </>
  );
}

function Table() {
  return (
    <>
      <defs>
        <linearGradient id="ld-room" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7e3c4" />
          <stop offset="1" stopColor="#e9c99b" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill="url(#ld-room)" />
      {/* Pencere */}
      <rect x={1080} y={120} width={330} height={260} rx={20} fill="#9fd3ff" stroke="var(--color-ahsap)" strokeWidth={16} />
      <line x1={1245} y1={120} x2={1245} y2={380} stroke="var(--color-ahsap)" strokeWidth={10} />
      <Kid x={800} y={640} look={ELIF} shirt="var(--color-kobalt)" scale={2.2} />
      {/* Sofra */}
      <rect x={300} y={600} width={1000} height={60} rx={14} fill="var(--color-mercan)" />
      <path d="M300 640 h1000 v40 h-1000 z" fill="#e0533a" />
      <rect x={340} y={680} width={40} height={180} fill="var(--color-ahsap-koyu)" />
      <rect x={1220} y={680} width={40} height={180} fill="var(--color-ahsap-koyu)" />
      {/* Çorba ve buhar */}
      <ellipse cx={800} cy={600} rx={110} ry={26} fill="#fff" />
      <path d="M700 590 Q 800 680 900 590 Z" fill="#fff" stroke="#e7dcc8" strokeWidth={4} />
      <ellipse cx={800} cy={592} rx={92} ry={16} fill="var(--color-ates)" />
      {[770, 810, 845].map((x, i) => (
        <path key={x} className="ld-steam" style={{ animationDelay: `${i * 0.9}s` }} d={`M${x} 560 q -14 -24 0 -48 q 14 -24 0 -48`} stroke="#fff" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0} />
      ))}
      {/* Ekmek ve bardak */}
      <ellipse cx={520} cy={590} rx={80} ry={30} fill="var(--color-ahsap-acik)" />
      <path d="M470 580 q 50 -20 100 0" stroke="var(--color-ahsap)" strokeWidth={5} fill="none" />
      <rect x={1040} y={520} width={56} height={84} rx={10} fill="#d4efff" opacity={0.9} stroke="#fff" strokeWidth={4} />
      <rect x={1046} y={556} width={44} height={42} rx={6} fill="#ffb35c" />
    </>
  );
}

/** Kitap: oymalı ahşap rahlede açık bir kitap; sayfalar desenle süslü, ışık süzülür. */
function Book() {
  const r = rnd(3);
  const motes = Array.from({ length: 22 }, () => ({ x: 500 + r() * 600, y: 140 + r() * 380, s: 2 + r() * 4, d: r() * 3 }));
  return (
    <>
      <defs>
        <radialGradient id="ld-light" cx="0.5" cy="0.25" r="0.75">
          <stop offset="0" stopColor="#2c4a8a" />
          <stop offset="1" stopColor="#0c1b3a" />
        </radialGradient>
        <linearGradient id="ld-ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-kehribar)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--color-kehribar)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill="url(#ld-light)" />
      <path className="ld-glow" d="M700 0 L520 620 L1080 620 L900 0 Z" fill="url(#ld-ray)" />
      {motes.map((m, i) => (
        <circle key={i} className="ld-twinkle" style={{ animationDelay: `${m.d}s` }} cx={m.x} cy={m.y} r={m.s} fill="var(--color-kehribar)" />
      ))}
      {/* Rahle */}
      <path d="M560 840 L1040 560 M1040 840 L560 560" stroke="var(--color-ahsap)" strokeWidth={34} strokeLinecap="round" />
      <path d="M560 840 L1040 560 M1040 840 L560 560" stroke="var(--color-ahsap-acik)" strokeWidth={10} strokeLinecap="round" opacity={0.6} />
      {/* Açık kitap */}
      <g className="ld-float">
        <path d="M800 560 C 700 520 600 520 520 545 L 520 400 C 600 375 700 375 800 415 Z" fill="var(--color-cream)" stroke="var(--color-kehribar-deep)" strokeWidth={6} />
        <path d="M800 560 C 900 520 1000 520 1080 545 L 1080 400 C 1000 375 900 375 800 415 Z" fill="var(--color-cream)" stroke="var(--color-kehribar-deep)" strokeWidth={6} />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} stroke="var(--color-tas-koyu)" strokeWidth={5} strokeLinecap="round" opacity={0.55}>
            <path d={`M${560} ${432 + i * 24} Q 660 ${420 + i * 24} 770 ${445 + i * 24}`} fill="none" />
            <path d={`M${830} ${445 + i * 24} Q 940 ${420 + i * 24} 1040 ${432 + i * 24}`} fill="none" />
          </g>
        ))}
        <circle cx={800} cy={395} r={14} fill="var(--color-kehribar)" />
      </g>
    </>
  );
}

function Mosque() {
  return (
    <>
      <defs>
        <linearGradient id="ld-dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2f6b" />
          <stop offset="0.55" stopColor="#c86a5a" />
          <stop offset="1" stopColor="var(--color-ufuk)" />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill="url(#ld-dusk)" />
      <circle cx={800} cy={640} r={180} fill="var(--color-ufuk-acik)" opacity={0.6} />
      <Crescent cx={1320} cy={170} r={50} fill="var(--color-cream)" />
      {/* Kuşlar */}
      {[0, 1, 2].map((i) => (
        <path key={i} className="ld-bird" style={{ animationDelay: `${i * -4}s` }} d={`M0 ${180 + i * 40} q 14 -14 28 0 q 14 -14 28 0`} stroke="#1a1420" strokeWidth={4} fill="none" />
      ))}
      {/* Cami silueti: merkezî kubbe, yarım kubbeler, iki minare */}
      <g fill="#14193a">
        <rect x={430} y={380} width={22} height={360} />
        <path d="M424 382 L441 250 L458 382 Z" />
        <rect x={420} y={470} width={42} height={12} rx={4} />
        <rect x={1148} y={380} width={22} height={360} />
        <path d="M1142 382 L1159 250 L1176 382 Z" />
        <rect x={1138} y={470} width={42} height={12} rx={4} />
        <path d="M600 600 A 200 170 0 0 1 1000 600 Z" />
        <path d="M520 640 A 120 100 0 0 1 760 640 Z" />
        <path d="M840 640 A 120 100 0 0 1 1080 640 Z" />
        <rect x={500} y={630} width={600} height={120} />
        <rect x={796} y={392} width={8} height={40} />
        <circle cx={800} cy={388} r={9} />
      </g>
      {/* Pencereler */}
      {[580, 660, 740, 860, 940, 1020].map((x) => (
        <rect key={x} className="ld-glow" x={x} y={670} width={26} height={44} rx={13} fill="var(--color-kehribar)" opacity={0.8} />
      ))}
      <rect x={0} y={750} width={1600} height={150} fill="#0f1430" />
    </>
  );
}

const ART: Record<(typeof SCENES)[number], () => React.ReactElement> = {
  gece: Night,
  doga: Nature,
  cocuklar: Kids,
  sofra: Table,
  kitap: Book,
  cami: Mosque,
};

export function Illustration({ scene, className = "" }: { scene: (typeof SCENES)[number]; className?: string }) {
  const Art = ART[scene];
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <style>{CSS}</style>
      <Art />
    </svg>
  );
}
