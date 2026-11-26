"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";
import { cssColor } from "@/lib/color";
import { DARK, HAIR, Head, SKIN, STYLES } from "../../shared/kid";
import { archeryAudio } from "../audio";
import { DRAW_MS, type Shot, type ShotResult } from "../logic";
import { arrowAt, ARROW_LEN, FACE_R, planArrow, quiver, RING_COLORS, TARGET_D, TARGET_Y, type ArrowPlan, type V3 } from "../timeline";
import type { ArcherySceneInput, SceneTeam } from "./types";

/**
 * Okçuluk sahnesinin çizim (SVG) yedeği: atış alanı yandan görünür, okçu solda, hedef sağda.
 * Tahta üç boyutlu çizemezse ya da öğretmen 3D'yi kapattıysa bu sahne oynar. Okun yolu 3D sahneyle
 * aynı zaman çizelgesinden gelir; olaylar ve sesler aynıdır.
 */

type Props = {
  input: ArcherySceneInput;
  teams: [SceneTeam, SceneTeam];
  reducedMotion: boolean;
  onContact: (index: number) => void;
  onShotDone: (index: number) => void;
  onFinale: () => void;
  onBanner?: (result: ShotResult | null, side: 0 | 1, points: number) => void;
};

const W = 1600;
const GROUND = 700;
const LINE_X = 330;
/** Yatayda sahne sıkıştırılır: 14 metre ~1000 piksel; dikeyde gerçek oran. */
const PXZ = 1000 / TARGET_D;
const PXY = 120;
const sx = (p: V3) => LINE_X - p.z * PXZ;
const sy = (y: number) => GROUND - y * PXY;
const TX = sx({ x: 0, y: 0, z: -TARGET_D });

/** Saflarda bekleyen ve atış yapan iki okçunun yeri. */
const SPOT = { line: LINE_X - 40, wait: 140 };

export function ArcheryScene({ input, teams, reducedMotion, onContact, onShotDone, onFinale, onBanner }: Props) {
  const live = useRef({ input, teams, reducedMotion, onContact, onShotDone, onFinale, onBanner });
  useEffect(() => {
    live.current = { input, teams, reducedMotion, onContact, onShotDone, onFinale, onBanner };
  });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const q = <T extends Element>(sel: string) => svg.querySelector<T>(sel);
    const arrow = q<SVGGElement>('[data-part="arrow"]');
    const stuck = q<SVGGElement>('[data-part="stuck"]');
    const flags = svg.querySelectorAll<SVGPathElement>('[data-part="flag"]');
    const kids = [0, 1].map((i) => q<SVGGElement>(`[data-kid="${i}"]`));
    const arms = [0, 1].map((i) => q<SVGPathElement>(`[data-kid="${i}"] [data-part="arms"]`));
    const strings = [0, 1].map((i) => q<SVGPathElement>(`[data-kid="${i}"] [data-part="string"]`));
    const nocked = [0, 1].map((i) => q<SVGGElement>(`[data-kid="${i}"] [data-part="nocked"]`));
    const start = live.current.input;
    const st = {
      t0: performance.now(),
      seen: start.shots.length,
      plan: null as ArrowPlan | null,
      shot: null as Shot | null,
      index: -1,
      at: 0,
      fired: new Set<number>(),
      contacted: false,
      done: false,
      finale: start.phase === "finished" ? { at: -10, called: false } : (null as null | { at: number; called: boolean }),
      mood: [0, 0] as number[],
      drawSound: -1,
    };
    const pos: V3 = { x: 0, y: 0, z: 0 };
    const dir: V3 = { x: 0, y: 0, z: -1 };
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - st.t0) / 1000;
      const { input: inp, reducedMotion: quiet } = live.current;
      const h = live.current;
      if (inp.shots.length > st.seen) {
        for (let i = st.seen; i < inp.shots.length - 1; i++) {
          h.onContact(i);
          h.onShotDone(i);
        }
        st.index = inp.shots.length - 1;
        st.seen = inp.shots.length;
        st.shot = inp.shots[st.index];
        st.plan = planArrow(st.shot);
        st.at = t;
        st.fired = new Set();
        st.contacted = st.done = false;
      }
      if (inp.phase === "question") {
        st.plan = null;
        st.shot = null;
        st.mood = [0, 0];
      }
      const plan = st.plan;
      const shot = st.shot;
      const tau = plan ? t - st.at : -1;
      if (plan && shot) {
        plan.events.forEach((e, k) => {
          if (st.fired.has(k) || tau < e.t) return;
          st.fired.add(k);
          if (e.kind === "release") {
            archeryAudio.release();
            archeryAudio.whoosh();
          } else if (e.kind === "target") archeryAudio.thud(1);
          else if (e.kind === "boss") archeryAudio.thud(0.5);
          else archeryAudio.grass();
        });
        if (!st.contacted && tau >= plan.hitAt + 0.15) {
          st.contacted = true;
          h.onContact(st.index);
          h.onBanner?.(shot.result, shot.side, shot.scored);
          if (shot.points >= 7) {
            archeryAudio.crowdCheer();
            st.mood[shot.side] = 1;
          } else if (shot.points === 0) {
            archeryAudio.crowdOoh();
            st.mood[shot.side] = -1;
          }
          archeryAudio.say(shot.result, 0.1);
        }
        if (!st.done && tau > plan.end) {
          st.done = true;
          h.onShotDone(st.index);
        }
      }
      if (inp.phase === "finished" && !st.finale && (!plan || st.done)) {
        st.finale = { at: t, called: false };
        const w = inp.winner;
        if (w === 0 || w === 1) {
          archeryAudio.crowdCheer();
          archeryAudio.say("bitis", 0.6);
          st.mood = [w === 0 ? 1 : -1, w === 1 ? 1 : -1];
          if (!quiet) confetti({ particleCount: 120, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.4 }, colors: [live.current.teams[w].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor), disableForReducedMotion: true });
        } else archeryAudio.say("berabere", 0.6);
      }
      if (st.finale && !st.finale.called && t - st.finale.at > 2.2) {
        st.finale.called = true;
        h.onFinale();
      }

      // Okçular: atış hakkı kazanan çizgiye geçer, yayı gerer; öbürü geride bekler.
      const shooter = plan && shot ? shot.side : inp.phase === "aim" ? inp.shooter : null;
      const aimFor = inp.phase === "aim" && inp.drawAt !== null ? (Date.now() - inp.drawAt) / DRAW_MS : 0;
      [0, 1].forEach((side) => {
        const el = kids[side];
        if (!el) return;
        const isShooter = shooter === side;
        const x = isShooter ? SPOT.line : shooter === null ? (side === 0 ? SPOT.line - 70 : SPOT.wait) : SPOT.wait;
        let lift = 0;
        const mood = st.mood[side];
        if (mood > 0 && !(isShooter && plan && tau < plan.hitAt)) lift = quiet ? 0 : Math.abs(Math.sin(t * 7 + side)) * 24;
        el.setAttribute("transform", `translate(${x} ${(GROUND - lift).toFixed(1)})`);
        // Yayın gerilmesi: 0 gevşek, 1 tam gerili (çekme eli çenede).
        let draw = 0;
        if (isShooter && inp.phase === "aim" && !plan) draw = Math.min(1, Math.max(0, aimFor));
        if (isShooter && plan && tau < 0) draw = 1;
        const pull = 6 + draw * 34;
        const cheering = mood > 0 && !(isShooter && plan && tau < plan.hitAt);
        arms[side]?.setAttribute(
          "d",
          cheering ? "M0 -92 L18 -140 M0 -92 L-14 -140" : mood < 0 ? "M0 -92 L12 -122 M0 -92 L-8 -124" : `M0 -92 L46 -96 M0 -92 L${(40 - pull).toFixed(1)} -96`,
        );
        strings[side]?.setAttribute("d", `M46 -134 L${(46 - pull).toFixed(1)} -96 L46 -58`);
        nocked[side]?.setAttribute("transform", `translate(${(46 - pull).toFixed(1)} -96)`);
        nocked[side]?.setAttribute("opacity", isShooter && inp.phase === "aim" && !plan ? "1" : "0");
      });
      if (shooter !== null && inp.phase === "aim" && !plan && aimFor > 0.05 && st.drawSound !== inp.drawAt) {
        st.drawSound = inp.drawAt ?? -1;
        archeryAudio.draw();
      }

      // Ok: uçuşta ve saplandıktan sonra.
      if (plan && tau >= 0) {
        arrowAt(plan, tau, pos, dir);
        const ang = (Math.atan2(-dir.y * PXY, -dir.z * PXZ) * 180) / Math.PI + (plan.sticks ? (quiet ? 0 : quiver(plan, tau) * 120) : 0);
        const g = tau >= plan.hitAt ? stuck : arrow;
        const other = tau >= plan.hitAt ? arrow : stuck;
        g?.setAttribute("transform", `translate(${sx(pos).toFixed(1)} ${sy(pos.y).toFixed(1)}) rotate(${(-ang).toFixed(1)})`);
        g?.setAttribute("opacity", "1");
        other?.setAttribute("opacity", "0");
      } else {
        arrow?.setAttribute("opacity", "0");
        stuck?.setAttribute("opacity", "0");
      }

      // Bayraklar rüzgârın şiddetine göre dalgalanır.
      const wind = plan && shot ? shot.wind : inp.wind;
      flags.forEach((f, i) => {
        const len = 30 + Math.abs(wind) * 16;
        const wav = quiet ? 0 : Math.sin(t * (4 + Math.abs(wind) * 2) + i) * (3 + Math.abs(wind) * 2);
        const s = wind < 0 ? -1 : 1;
        f.setAttribute("d", `M0 0 Q ${(s * len * 0.5).toFixed(1)} ${(wav - 2).toFixed(1)} ${(s * len).toFixed(1)} ${(6 + wav * 0.6).toFixed(1)} L0 22 Z`);
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // Döngü bir kez kurulur; girdi ve takımlar `live` üzerinden okunur.
  }, []);

  const faceY = sy(TARGET_Y);
  const fr = FACE_R * PXY;
  const arrowPath = (
    <>
      <line x1={-ARROW_LEN * PXZ * 1.6} y1={0} x2={0} y2={0} stroke="var(--color-ahsap-koyu)" strokeWidth={4} strokeLinecap="round" />
      <path d="M0 -4 L10 0 L0 4 Z" fill="var(--color-ink-400)" />
      <path d={`M${-ARROW_LEN * PXZ * 1.6} 0 l-10 -7 h10 l8 7 l-8 7 h-10 Z`} fill="var(--color-mercan)" />
    </>
  );
  return (
    <svg ref={svgRef} viewBox="60 240 1480 560" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="ok-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-ink-900)" />
          <stop offset="1" stopColor="var(--color-ufuk)" stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={GROUND} fill="url(#ok-sky)" />
      {/* Uzak ağaçlar ve tribün */}
      {Array.from({ length: 14 }, (_, i) => (
        <ellipse key={i} cx={i * 125 + 40} cy={GROUND - 190} rx={90} ry={70 + (i % 3) * 18} fill="var(--color-servi)" />
      ))}
      <rect x={0} y={GROUND - 170} width={W} height={60} fill="var(--color-ink-800)" />
      {Array.from({ length: 34 }, (_, i) => (
        <g key={i} transform={`translate(${i * 48 + 12} ${GROUND - 160})`}>
          <rect x={-9} y={0} width={18} height={20} rx={7} fill={i % 2 ? teams[1].base : teams[0].base} opacity={0.85} />
          <circle cy={-8} r={7} fill={SKIN[i % SKIN.length]} />
        </g>
      ))}
      {/* Çimen ve atış çizgisi */}
      <rect x={0} y={GROUND - 110} width={W} height={220} fill="var(--color-cim)" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={0} y={GROUND - 110 + i * 26} width={W} height={13} fill="var(--color-cim-acik)" opacity={0.35} />
      ))}
      <line x1={LINE_X} y1={GROUND - 110} x2={LINE_X} y2={GROUND + 110} stroke="var(--color-cream)" strokeWidth={6} />
      {/* Rüzgâr bayrakları */}
      {[LINE_X + 250, LINE_X + 650, TX + 120].map((x, i) => (
        <g key={i} transform={`translate(${x} ${GROUND - 250})`}>
          <line x1={0} y1={0} x2={0} y2={250} stroke="var(--color-ink-400)" strokeWidth={5} />
          <path data-part="flag" fill="var(--color-kehribar)" stroke="var(--color-kehribar-deep)" strokeWidth={2} />
        </g>
      ))}
      {/* Hedef: ayaklı sehpa, saman taban, yüz yandan (elips) */}
      <path d={`M${TX - 40} ${GROUND} L${TX + 4} ${faceY - fr * 1.3} L${TX + 50} ${GROUND}`} fill="none" stroke="var(--color-ahsap)" strokeWidth={10} strokeLinejoin="round" />
      <ellipse cx={TX + 10} cy={faceY} rx={20} ry={fr * 1.3} fill="var(--color-ahsap-acik)" stroke="var(--color-ahsap)" strokeWidth={4} />
      {RING_COLORS.map((c, i) => (
        <ellipse key={i} cx={TX - 2} cy={faceY} rx={10 - i * 1.6} ry={fr * (1 - i * 0.2)} fill={c} />
      ))}
      <g data-part="stuck" opacity={0}>
        {arrowPath}
      </g>
      {/* Okçular */}
      {[0, 1].map((side) => (
        <g key={side} data-kid={side}>
          <ellipse cy={4} rx={28} ry={6} fill="rgb(0 0 0 / 0.25)" />
          <path d="M-8 0 L-6 -50 M8 0 L6 -50" stroke={teams[side].deep} strokeWidth={13} strokeLinecap="round" />
          <rect x={-18} y={-108} width={36} height={62} rx={12} fill={teams[side].base} />
          {/* Göğüs koruyucu */}
          <path d="M-14 -100 L14 -70" stroke="var(--color-ink-950)" strokeWidth={5} opacity={0.6} />
          <path data-part="arms" stroke={SKIN[side + 1]} strokeWidth={10} strokeLinecap="round" fill="none" />
          {/* Yay: kabzası ön elde */}
          <path d="M46 -134 Q 70 -96 46 -58" fill="none" stroke="var(--color-ahsap-koyu)" strokeWidth={6} strokeLinecap="round" />
          <path data-part="string" stroke="var(--color-cream)" strokeWidth={1.6} fill="none" />
          <g data-part="nocked" opacity={0}>
            <line x1={0} y1={0} x2={60} y2={0} stroke="var(--color-ahsap-koyu)" strokeWidth={3.5} />
            <path d="M60 -3.5 L69 0 L60 3.5 Z" fill="var(--color-ink-400)" />
            <path d="M0 0 l-8 -6 h8 l6 6 l-6 6 h-8 Z" fill="var(--color-mercan)" />
          </g>
          <g transform="translate(0 -128)">
            <Head look={{ skin: SKIN[side + 1], hair: HAIR[side * 2], style: STYLES[side * 2] }} />
          </g>
          <ellipse cx={-6} cy={2} rx={10} ry={5} fill={DARK} />
          <ellipse cx={8} cy={2} rx={10} ry={5} fill={DARK} />
        </g>
      ))}
      <g data-part="arrow" opacity={0}>
        {arrowPath}
      </g>
    </svg>
  );
}

