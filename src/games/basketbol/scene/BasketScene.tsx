"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";
import { cssColor } from "@/lib/color";
import { DARK, Head, SKIN, HAIR, STYLES } from "../../shared/kid";
import { basketAudio } from "../audio";
import type { ShotResult } from "../logic";
import { ballAt, BALL_R, BOARD_BOTTOM, BOARD_H, BOARD_Z, LAND, NET_DEPTH, planShot, RELEASE, RIM_R, RIM_Y, shooterAt, spotFor, type ShotPlan, type V3 } from "../timeline";
import type { BasketSceneInput, SceneTeam } from "./types";

/**
 * Basketbol sahnesinin çizim (SVG) yedeği: salon yandan görünür, pota sağda, şutçu solda.
 * Tahta üç boyutlu çizemezse ya da öğretmen 3D'yi kapattıysa bu sahne oynar. Topun yolu 3D sahneyle
 * aynı zaman çizelgesinden gelir; olaylar ve sesler aynıdır.
 */

type Props = {
  input: BasketSceneInput;
  teams: [SceneTeam, SceneTeam];
  reducedMotion: boolean;
  onContact: (index: number) => void;
  onShotDone: (index: number) => void;
  onFinale: () => void;
  onBanner?: (result: ShotResult | null, side: 0 | 1, points: number) => void;
};

const W = 1600;
const GROUND = 720;
const PX = 105;
const HOOP_X = 1330;
/** Sahnenin metre koordinatını (potadan uzaklık, yükseklik) çizime çevirir. */
const sx = (p: V3) => HOOP_X - Math.hypot(p.x, p.z) * Math.sign(p.z || 1) * PX;
const sy = (y: number) => GROUND - y * PX;

export function BasketScene({ input, teams, reducedMotion, onContact, onShotDone, onFinale, onBanner }: Props) {
  const live = useRef({ input, teams, reducedMotion, onContact, onShotDone, onFinale, onBanner });
  useEffect(() => {
    live.current = { input, teams, reducedMotion, onContact, onShotDone, onFinale, onBanner };
  });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const q = <T extends Element>(sel: string) => svg.querySelector<T>(sel);
    const ball = q<SVGGElement>('[data-part="ball"]');
    const kids = [0, 1].map((i) => q<SVGGElement>(`[data-kid="${i}"]`));
    const arms = [0, 1].map((i) => q<SVGPathElement>(`[data-kid="${i}"] [data-part="arms"]`));
    const net = q<SVGPathElement>('[data-part="net"]');
    const start = live.current.input;
    const st = {
      t0: performance.now(),
      seen: start.shots.length,
      plan: null as ShotPlan | null,
      index: -1,
      at: 0,
      fired: new Set<number>(),
      contacted: false,
      done: false,
      wobble: 0,
      finale: start.phase === "finished" ? { at: -10, called: false } : (null as null | { at: number; called: boolean }),
      mood: [0, 0] as number[],
    };
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
        st.plan = planShot(inp.shots[st.index], st.index);
        st.at = t;
        st.fired = new Set();
        st.contacted = st.done = false;
      }
      if (inp.phase === "question") {
        st.plan = null;
        st.mood = [0, 0];
      }
      const plan = st.plan;
      const shot = plan ? inp.shots[st.index] : null;
      const tau = plan ? t - st.at : -1;
      if (plan && shot) {
        plan.events.forEach((e, k) => {
          if (st.fired.has(k) || tau < e.t) return;
          st.fired.add(k);
          if (e.kind === "rim") basketAudio.rim(e.strength);
          else if (e.kind === "board") basketAudio.board();
          else if (e.kind === "net") {
            basketAudio.swish();
            st.wobble = 1;
          } else if (e.kind === "floor") basketAudio.bounce(e.strength);
        });
        const decided = plan.made ? plan.madeAt! : (plan.events.find((e) => e.kind !== "release")?.t ?? plan.end) + 0.25;
        if (!st.contacted && tau >= decided) {
          st.contacted = true;
          h.onContact(st.index);
          h.onBanner?.(shot.result, shot.side, shot.points);
          if (plan.made) {
            basketAudio.crowdCheer();
            basketAudio.say(shot.range === 3 ? "uclu" : shot.result === "temiz" ? "temiz" : "basket", 0.15);
            st.mood[shot.side] = 1;
            st.mood[1 - shot.side] = -1;
          } else {
            basketAudio.crowdOoh();
            basketAudio.say(shot.result === "kisa" ? "kisa" : "kacti", 0.1);
            st.mood[shot.side] = -1;
          }
        }
        if (!st.done && tau > Math.max(plan.end, (plan.madeAt ?? 0) + 1.4)) {
          st.done = true;
          h.onShotDone(st.index);
        }
      }
      if (inp.phase === "finished" && !st.finale && (!plan || st.done)) {
        st.finale = { at: t, called: false };
        basketAudio.buzzer();
        const w = inp.winner;
        if (w === 0 || w === 1) {
          basketAudio.crowdCheer();
          basketAudio.say("bitis", 1.2);
          st.mood = [w === 0 ? 1 : -1, w === 1 ? 1 : -1];
          if (!quiet) confetti({ particleCount: 120, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.4 }, colors: [live.current.teams[w].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor), disableForReducedMotion: true });
        } else basketAudio.say("berabere", 1.2);
      }
      if (st.finale && !st.finale.called && t - st.finale.at > 2.2) {
        st.finale.called = true;
        h.onFinale();
      }

      // Oyuncular: atış hakkı kazanan atış noktasında, öbürü potanın altında savunmada.
      const shooter = plan && shot ? shot.side : inp.phase === "aim" ? inp.shooter : null;
      const spot = plan ? plan.spot : inp.range ? spotFor(inp.range, inp.shots.length) : { x: 0, y: 0, z: 3.4 };
      [0, 1].forEach((side) => {
        const el = kids[side];
        if (!el) return;
        const isShooter = shooter === side;
        let x = isShooter ? sx(spot) : shooter === null ? (side === 0 ? 620 : 980) : HOOP_X - 1.4 * PX;
        let lift = 0;
        let up = 0.15;
        if (isShooter && plan && tau >= 0) {
          const p = shooterAt(tau);
          lift = p.lift * PX;
          up = p.arms;
        } else if (isShooter && inp.phase === "aim" && inp.pressAt !== null) {
          // Güç topluyor: dizlerini büker, topu göğsünde tutar.
          lift = -Math.min(1, (Date.now() - inp.pressAt) / 400) * 14;
          up = 0.35;
        }
        if (!isShooter && plan && tau > 0.3 && tau < LAND + 0.3) {
          lift = Math.sin(Math.min(1, (tau - 0.3) / 0.5) * Math.PI) * 0.25 * PX;
          up = 1;
        }
        const mood = st.mood[side];
        if (mood > 0 && !(isShooter && plan && tau < LAND)) {
          lift = quiet ? 0 : Math.abs(Math.sin(t * 7 + side)) * 26;
          up = 1;
        }
        const face = isShooter || shooter === null ? 1 : -1;
        if (shooter === null) x += 0;
        el.setAttribute("transform", `translate(${x.toFixed(1)} ${(GROUND - lift).toFixed(1)}) scale(${face} 1)`);
        // Kollar: aşağıdan (göğüs) yukarıya (baş üstü) doğru.
        const ay = -88 - up * 70;
        arms[side]?.setAttribute("d", mood < 0 && !(isShooter && plan && tau < LAND) ? "M0 -88 L14 -122 M0 -88 L-10 -122" : `M0 -88 L${(14 + up * 4).toFixed(1)} ${ay.toFixed(1)} M0 -88 L${(6 + up * 2).toFixed(1)} ${(ay + 6).toFixed(1)}`);
      });

      // Top
      let bx = HOOP_X - 0.6 * PX;
      let by = sy(BALL_R);
      if (plan && tau >= RELEASE) {
        const p = ballAt(plan, Math.min(tau, plan.end + 5))!;
        bx = sx(p);
        by = sy(p.y);
      } else if (shooter !== null && inp.phase === "aim" && inp.pressAt !== null) {
        bx = sx(spot) + 22;
        by = sy(1.05) + Math.min(1, (Date.now() - inp.pressAt) / 400) * 14;
      } else if (shooter !== null && inp.phase === "aim") {
        bx = sx(spot) + 26;
        by = sy(quiet ? 0.7 : 0.25 + Math.abs(Math.cos(((t % 0.6) / 0.6) * Math.PI)) * 0.55);
      } else if (plan && tau >= 0) {
        const p = shooterAt(tau);
        bx = sx(plan.spot) + 18;
        by = GROUND - p.lift * PX - 96 - p.arms * 70;
      }
      ball?.setAttribute("transform", `translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${((t * 400) % 360).toFixed(0)})`);
      st.wobble *= 0.95;
      const wob = quiet ? 0 : Math.sin(t * 25) * 6 * st.wobble;
      const r = RIM_R * PX;
      net?.setAttribute("d", `M${HOOP_X - r} ${sy(RIM_Y)} L${HOOP_X - r * 0.6 + wob} ${sy(RIM_Y - NET_DEPTH)} L${HOOP_X + r * 0.6 + wob} ${sy(RIM_Y - NET_DEPTH)} L${HOOP_X + r} ${sy(RIM_Y)} M${HOOP_X - r * 0.4} ${sy(RIM_Y)} L${HOOP_X - r * 0.2 + wob} ${sy(RIM_Y - NET_DEPTH)} M${HOOP_X + r * 0.4} ${sy(RIM_Y)} L${HOOP_X + r * 0.2 + wob} ${sy(RIM_Y - NET_DEPTH)}`);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // Döngü bir kez kurulur; girdi ve takımlar `live` üzerinden okunur.
  }, []);

  const r = RIM_R * PX;
  return (
    <svg ref={svgRef} viewBox={`${W - 1180} 290 1150 540`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="bb-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-ink-950)" />
          <stop offset="1" stopColor="var(--color-ink-800)" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={GROUND} fill="url(#bb-wall)" />
      {/* Tribün basamakları ve seyirciler */}
      {Array.from({ length: 4 }, (_, row) => (
        <g key={row}>
          <rect x={0} y={GROUND - 250 + row * 42} width={W} height={42} fill="var(--color-ink-700)" opacity={0.5 + row * 0.1} />
          {Array.from({ length: 26 }, (_, i) => (
            <g key={i} transform={`translate(${i * 62 + (row % 2) * 30 + 10} ${GROUND - 262 + row * 42})`}>
              <rect x={-10} y={-4} width={20} height={22} rx={8} fill={i < 13 ? teams[0].base : teams[1].base} opacity={0.85} />
              <circle cy={-12} r={8} fill={SKIN[(i + row) % SKIN.length]} />
            </g>
          ))}
        </g>
      ))}
      {/* Parke */}
      <rect x={0} y={GROUND} width={W} height={120} fill="var(--color-ahsap-acik)" />
      {Array.from({ length: 16 }, (_, i) => (
        <line key={i} x1={i * 100} y1={GROUND} x2={i * 100 + 40} y2={GROUND + 120} stroke="var(--color-ahsap)" strokeWidth={3} opacity={0.6} />
      ))}
      <line x1={HOOP_X - 6.2 * PX} y1={GROUND + 4} x2={HOOP_X - 6.2 * PX} y2={GROUND + 120} stroke="var(--color-cream)" strokeWidth={6} />
      {/* Pota */}
      <rect x={HOOP_X - BOARD_Z * PX + 60} y={sy(RIM_Y + 0.9)} width={14} height={RIM_Y * PX + 90} fill="var(--color-ink-400)" />
      <rect x={HOOP_X - BOARD_Z * PX - 6} y={sy(BOARD_BOTTOM + BOARD_H)} width={12} height={BOARD_H * PX} fill="var(--color-cream)" stroke="var(--color-mercan)" strokeWidth={4} />
      <line x1={HOOP_X - BOARD_Z * PX} y1={sy(RIM_Y + 0.55)} x2={HOOP_X - BOARD_Z * PX + 66} y2={sy(RIM_Y + 0.55)} stroke="var(--color-ink-400)" strokeWidth={10} />
      <path data-part="net" fill="none" stroke="var(--color-cream)" strokeWidth={3} />
      <line x1={HOOP_X - r} y1={sy(RIM_Y)} x2={HOOP_X + r + 40} y2={sy(RIM_Y)} stroke="var(--color-mercan)" strokeWidth={7} strokeLinecap="round" />
      {/* Oyuncular */}
      {[0, 1].map((side) => (
        <g key={side} data-kid={side}>
          <ellipse cy={4} rx={28} ry={6} fill="rgb(0 0 0 / 0.25)" />
          <path d="M-8 0 L-6 -46 M8 0 L6 -46" stroke={teams[side].deep} strokeWidth={13} strokeLinecap="round" />
          <rect x={-18} y={-104} width={36} height={60} rx={12} fill={teams[side].base} />
          <text y={-66} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--color-cream)">
            {side === 0 ? 7 : 23}
          </text>
          <path data-part="arms" stroke={SKIN[side + 1]} strokeWidth={10} strokeLinecap="round" fill="none" />
          <g transform="translate(0 -124)">
            <Head look={{ skin: SKIN[side + 1], hair: HAIR[side * 2], style: STYLES[side * 2] }} />
          </g>
          <ellipse cx={-6} cy={2} rx={10} ry={5} fill={DARK} />
          <ellipse cx={8} cy={2} rx={10} ry={5} fill={DARK} />
        </g>
      ))}
      {/* Top */}
      <g data-part="ball">
        <circle r={BALL_R * PX * 1.15} fill="var(--color-ates)" stroke="var(--color-ink-950)" strokeWidth={2.5} />
        <path d={`M${-BALL_R * PX} 0 H${BALL_R * PX} M0 ${-BALL_R * PX} V${BALL_R * PX}`} stroke="var(--color-ink-950)" strokeWidth={2} />
      </g>
    </svg>
  );
}
