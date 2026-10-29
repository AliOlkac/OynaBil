"use client";

import confetti from "canvas-confetti";
import { useEffect, useMemo, useRef } from "react";
import { cssColor } from "@/lib/color";
import { sfx } from "@/lib/sound";
import { fmt, solve, type Pose, type Vec } from "./rig";

/**
 * Halat çekme sahnesi.
 *
 * Oyun mantığından yalnızca özet bir girdi alır (ipin konumu, son doğru/yanlış anları, donma, kazanan)
 * ve bunu tek bir requestAnimationFrame döngüsünde çizer. Sahne kendi içinde fizik ve zamanlama
 * tutar; React her karede yeniden çizmez, SVG öznitelikleri doğrudan güncellenir.
 */

export type SceneTeam = { base: string; deep: string };

export type SceneInput = {
  rope: number;
  target: number;
  /** "ready": ip gevşek, "go": çekişme, "finished": bitiş gösterisi. */
  phase: "ready" | "go" | "finished";
  winner: 0 | 1 | "draw" | null;
  /** Her takımın son doğru ve son yanlış cevap anı (ms). */
  pullAt: [number, number];
  missAt: [number, number];
  frozen: [boolean, boolean];
};

const W = 1600;
const H = 400;
const CENTER = W / 2;
const VIEW_Y = 40;
const GROUND = 340;
const HORIZON = 238;
/** Çocuklar sahneye göre biraz büyük çizilir ki arka sıradan seçilsin. */
const KID_SCALE = 1.18;
const PULLERS = 4;
const SPACING = 100;
const FRONT = 236;
const ROPE_Y = -80;
/** İp merkezinin bir takımın çizgisine kadar gidebileceği yol. */
const TRAVEL = 150;
const PIT_RX = 86;
const PARTICLES = 80;

const SKIN = ["#f1c7a1", "#d6a27a", "#b07650", "#8a5636"];
const HAIR = ["#2a1b12", "#5a3720", "#16161d", "#7a4520", "#3b2416"];
const STYLES = ["short", "ponytail", "curly", "bun"] as const;
const PANTS = "#22304f";
const SHOE = "#f3ead8";
const DARK = "#1a1420";

type Style = (typeof STYLES)[number];

type Kid = {
  side: 0 | 1;
  k: number;
  skin: string;
  hair: string;
  style: Style;
};

const KIDS: Kid[] = ([0, 1] as const).flatMap((side) =>
  Array.from({ length: PULLERS }, (_, k) => ({
    side,
    k,
    skin: SKIN[(k * 3 + side) % SKIN.length],
    hair: HAIR[(k * 2 + side * 3) % HAIR.length],
    style: STYLES[(k + side * 2) % STYLES.length],
  })),
);

// ---- yardımcılar ----
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeIn = (t: number) => t * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const deg = (r: number) => (r * 180) / Math.PI;

function toWorld(p: Vec, x: number, y: number, facing: number, rot: number): Vec {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const rx = p.x * c - p.y * s;
  const ry = p.x * s + p.y * c;
  return { x: x + rx * facing * KID_SCALE, y: y + ry * KID_SCALE };
}

type KidRefs = {
  back: SVGGElement | null;
  front: SVGGElement | null;
  ice: SVGGElement | null;
  legBack: SVGPathElement | null;
  legFront: SVGPathElement | null;
  shoeBack: SVGEllipseElement | null;
  shoeFront: SVGEllipseElement | null;
  shorts: SVGCircleElement | null;
  torso: SVGPathElement | null;
  stripe: SVGPathElement | null;
  upperFar: SVGPathElement | null;
  foreFar: SVGPathElement | null;
  handFar: SVGCircleElement | null;
  upperNear: SVGPathElement | null;
  foreNear: SVGPathElement | null;
  handNear: SVGCircleElement | null;
  head: SVGGElement | null;
  mouthGrit: SVGGElement | null;
  mouthOpen: SVGEllipseElement | null;
  mouthSmile: SVGPathElement | null;
  mouthCalm: SVGPathElement | null;
  cheek: SVGCircleElement | null;
};


type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; g: number; color: string };

export function TugScene({ input, teams, reducedMotion }: { input: SceneInput; teams: [SceneTeam, SceneTeam]; reducedMotion: boolean }) {
  const inputRef = useRef(input);
  const teamsRef = useRef(teams);
  const motionRef = useRef(reducedMotion);
  useEffect(() => {
    inputRef.current = input;
    teamsRef.current = teams;
    motionRef.current = reducedMotion;
  });

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const one = <T extends Element>(selector: string) => svg.querySelector<T>(selector);
    const kids: KidRefs[] = KIDS.map((_, i) => {
      const part = <T extends Element>(name: string) => one<T>(`[data-kid="${i}"] [data-part="${name}"]`);
      return {
        back: one(`[data-kid="${i}"][data-part="back"]`),
        front: one(`[data-kid="${i}"][data-part="front"]`),
        ice: one(`[data-kid="${i}"][data-part="ice"]`),
        legBack: part("legBack"),
        legFront: part("legFront"),
        shoeBack: part("shoeBack"),
        shoeFront: part("shoeFront"),
        shorts: part("shorts"),
        torso: part("torso"),
        stripe: part("stripe"),
        upperFar: part("upperFar"),
        foreFar: part("foreFar"),
        handFar: part("handFar"),
        upperNear: part("upperNear"),
        foreNear: part("foreNear"),
        handNear: part("handNear"),
        head: part("head"),
        mouthGrit: part("mouthGrit"),
        mouthOpen: part("mouthOpen"),
        mouthSmile: part("mouthSmile"),
        mouthCalm: part("mouthCalm"),
        cheek: part("cheek"),
      };
    });
    const ropeLeft = one<SVGPathElement>('[data-part="rope-left"]');
    const ropeRight = one<SVGPathElement>('[data-part="rope-right"]');
    const braidLeft = one<SVGPathElement>('[data-part="braid-left"]');
    const braidRight = one<SVGPathElement>('[data-part="braid-right"]');
    const ribbon = one<SVGGElement>('[data-part="ribbon"]');
    const world = one<SVGGElement>('[data-part="world"]');
    const far = one<SVGGElement>('[data-part="far"]');
    const particleEls = Array.from(svg.querySelectorAll<SVGCircleElement>("[data-particle]"));

    const st = {
      offset: 0,
      vel: 0,
      impulse: [0, 0],
      yank: [0, 0],
      lastPull: [...inputRef.current.pullAt] as number[],
      lastMiss: [...inputRef.current.missAt] as number[],
      leans: KIDS.map(() => 0.06),
      endStart: null as number | null,
      endOffset: null as number | null,
      cam: 0,
      // Oyun bitmiş hâlde açıldıysa gösteri atlanır, son kare çizilir.
      skipEnding: inputRef.current.phase === "finished",
      splashed: false,
      cheered: false,
      snapped: false,
      lastFrame: performance.now(),
      started: performance.now(),
    };
    const particles: Particle[] = [];

    const emit = (p: Omit<Particle, "life">) => {
      if (motionRef.current) return;
      if (particles.length >= PARTICLES) particles.shift();
      particles.push({ ...p, life: 0 });
    };

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - st.lastFrame) / 1000);
      st.lastFrame = t;
      const time = (t - st.started) / 1000;
      const inp = inputRef.current;
      const calm = motionRef.current;

      // ---- olaylar: doğru cevap çeker, yanlış cevap dondurur ----
      for (const s of [0, 1] as const) {
        if (inp.pullAt[s] !== st.lastPull[s]) {
          st.lastPull[s] = inp.pullAt[s];
          st.impulse[s] = 1;
          st.yank[1 - s] = 1;
          st.vel += (s === 0 ? -1 : 1) * 260;
          sfx.heave();
          for (const kid of KIDS.filter((x) => x.side === s)) {
            const fx = CENTER + (s === 0 ? -1 : 1) * (FRONT + kid.k * SPACING) + st.offset;
            for (let i = 0; i < 3; i++) {
              emit({ x: fx + (Math.random() - 0.5) * 30, y: GROUND - 2, vx: (s === 0 ? -1 : 1) * (20 + Math.random() * 50), vy: -20 - Math.random() * 40, max: 0.7, r: 4 + Math.random() * 5, g: 60, color: "rgba(196,160,112,0.75)" });
            }
            emit({ x: fx - (s === 0 ? 1 : -1) * 40, y: GROUND - 150, vx: (s === 0 ? -1 : 1) * (30 + Math.random() * 30), vy: -60, max: 0.8, r: 3.2, g: 300, color: "rgba(150,215,255,0.9)" });
          }
        }
        if (inp.missAt[s] !== st.lastMiss[s]) {
          st.lastMiss[s] = inp.missAt[s];
          sfx.freeze();
        }
      }

      // ---- ipin konumu: yaylı takip, çekişte sarsıntı ----
      const ending = inp.phase === "finished" && inp.winner !== null;
      if (ending && st.endStart === null) st.endStart = st.skipEnding ? t - 10_000 : t;
      const te = st.endStart === null ? 0 : (t - st.endStart) / 1000;
      const winDir = inp.winner === 0 ? -1 : inp.winner === 1 ? 1 : 0;

      const target = (inp.rope / Math.max(1, inp.target)) * TRAVEL;
      if (ending && st.endOffset === null) st.endOffset = st.skipEnding ? winDir * TRAVEL : st.offset;
      if (!ending) {
        st.vel += (70 * (target - st.offset) - 9 * st.vel) * dt;
        st.offset += st.vel * dt;
      }
      // Bitişte kazananlar yerinde kalıp geriye devrilir; kaybedenler merkeze, çamura sürüklenir.
      const endT0 = st.skipEnding ? 10 : te;
      const sideOffset = (side: 0 | 1) => {
        if (!ending || st.endOffset === null || inp.winner === "draw") return st.offset;
        if (side === inp.winner) return st.endOffset + winDir * 18 * easeOut(clamp01(endT0 / 0.4));
        // En öndeki çocuğun ayakları havuzun kenarında kalır, gövdesi havuza kapaklanır.
        return st.endOffset + (winDir * (FRONT - 92) - st.endOffset) * easeIn(clamp01(endT0 / 0.5));
      };
      if (Math.abs(st.vel) > 90 && !calm && Math.random() < 0.4) {
        const s = Math.random() < 0.5 ? 0 : 1;
        const kx = CENTER + (s === 0 ? -1 : 1) * (FRONT + Math.floor(Math.random() * PULLERS) * SPACING) + st.offset;
        emit({ x: kx, y: GROUND - 2, vx: -st.vel * 0.2, vy: -15 - Math.random() * 25, max: 0.6, r: 3 + Math.random() * 4, g: 40, color: "rgba(196,160,112,0.6)" });
      }

      // Kamera aksiyonu izler: oyunda ipin peşinden hafifçe, bitişte bütün sahneyi ortalar.
      const camTarget = ending && st.endOffset !== null && inp.winner !== "draw" ? -st.endOffset * 1.2 : -st.offset * 0.4;
      st.cam += (camTarget - st.cam) * Math.min(1, dt * (ending ? 2.5 : 1.5));
      world?.setAttribute("transform", `translate(${st.cam.toFixed(1)} 0)`);
      far?.setAttribute("transform", `translate(${(st.cam * 0.3).toFixed(1)} 0)`);

      const live = inp.phase === "go";
      const struggle = live && !calm ? Math.sin(time * 2.3) * 1.4 + Math.sin(time * 5.7) * 0.6 : 0;

      // ---- bitiş anları: sıçrama, sevinç, kopma ----
      if (ending && !st.skipEnding) {
        if (inp.winner !== "draw" && !st.splashed && te > 0.48) {
          st.splashed = true;
          sfx.splash();
          for (let i = 0; i < 34; i++) {
            const a = Math.PI * (0.1 + Math.random() * 0.8);
            const v = 120 + Math.random() * 220;
            emit({ x: CENTER + (Math.random() - 0.5) * 60, y: GROUND + 4, vx: Math.cos(a) * v * (Math.random() < 0.5 ? -1 : 1), vy: -Math.sin(a) * v, max: 1.1, r: 4 + Math.random() * 7, g: 520, color: Math.random() < 0.5 ? "#5a3a20" : "#7a5230" });
          }
        }
        if (inp.winner === "draw" && !st.snapped && te > 0.2) {
          st.snapped = true;
          sfx.snap();
        }
        if (inp.winner !== "draw" && !st.cheered && te > 1.75) {
          st.cheered = true;
          sfx.cheer();
          if (!calm) {
            const colors = [teamsRef.current[inp.winner as 0 | 1].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor);
            confetti({ particleCount: 110, spread: 90, startVelocity: 45, origin: { x: inp.winner === 0 ? 0.25 : 0.75, y: 0.35 }, colors, disableForReducedMotion: true });
          }
        }
      }
      const endT = st.skipEnding ? 10 : te;

      // ---- çocuklar ----
      const ropePoints: [Vec[], Vec[]] = [[], []];
      KIDS.forEach((kid, i) => {
        const r = kids[i];
        const dir = kid.side === 0 ? -1 : 1;
        const facing = -dir;
        const frozen = inp.frozen[kid.side] && !ending;
        const isWinner = ending && inp.winner === kid.side;
        const isLoser = ending && inp.winner !== "draw" && inp.winner !== kid.side;
        const isDraw = ending && inp.winner === "draw";

        let leanTarget = live || ending ? 0.5 + kid.k * 0.025 : 0.06;
        leanTarget += 0.2 * st.impulse[kid.side] - 0.24 * st.yank[kid.side];
        if (frozen) leanTarget = 0.32;
        if (live) leanTarget += Math.sin(time * 3.1 + i * 1.7) * 0.025 * (calm ? 0 : 1);
        st.leans[i] += (leanTarget - st.leans[i]) * Math.min(1, dt * (frozen ? 4 : 9));

        const pose: Pose = { lean: st.leans[i], ropeY: ROPE_Y, armsUp: 0, step: st.impulse[kid.side] };
        let rot = 0;
        let dy = 0;
        let dx = 0;
        let mouth: "grit" | "open" | "smile" | "calm" = live ? "grit" : "calm";

        if (isLoser) {
          // Öne kapaklanır; en öndeki çamur havuzuna düşer.
          const p = easeIn(clamp01((endT - kid.k * 0.07) / 0.5));
          rot = 1.5 * p;
          pose.lean = 0.5 * (1 - p) - 0.1 * p;
          pose.step = 0;
          dy = kid.k === 0 ? 12 * p : -4 * p;
          mouth = "open";
        } else if (isWinner || isDraw) {
          // İp boşalınca geriye devrilir, sonra kalkıp sevinir.
          const fall = easeIn(clamp01((endT - 0.15 - kid.k * 0.05) / 0.4));
          const rise = easeInOut(clamp01((endT - 1.25 - kid.k * 0.05) / 0.45));
          rot = -1.05 * fall * (1 - rise);
          pose.lean = 0.5 * (1 - rise);
          pose.step = 0;
          mouth = fall > 0.5 ? "open" : "grit";
          if (rise > 0) mouth = isDraw ? "open" : "smile";
          if (isWinner && rise >= 1) {
            pose.armsUp = 1;
            pose.ropeY = null;
            const hop = endT - 1.75 - kid.k * 0.09;
            if (hop > 0 && hop < 2.2 && !calm) dy = -Math.abs(Math.sin(hop * 6)) * 20;
          } else if (isDraw && rise >= 1) {
            pose.ropeY = null;
          }
        } else if (frozen) {
          mouth = "calm";
          if (!calm) dx = Math.sin(time * 70 + i) * 1.6;
        } else if (live && st.impulse[kid.side] < 0.3 && st.yank[kid.side] > 0.5) {
          mouth = "open";
        }

        const baseX = CENTER + dir * (FRONT + kid.k * SPACING) + sideOffset(kid.side) + dx + (live ? struggle * 0.6 : 0);
        const baseY = GROUND + dy;
        const sk = solve(pose);
        const transform = `translate(${baseX.toFixed(1)} ${baseY.toFixed(1)}) scale(${facing * KID_SCALE} ${KID_SCALE}) rotate(${deg(rot).toFixed(2)})`;
        r.back?.setAttribute("transform", transform);
        r.front?.setAttribute("transform", transform);
        r.ice?.setAttribute("transform", transform);
        r.ice?.setAttribute("opacity", frozen ? "1" : "0");

        r.legBack?.setAttribute("d", `M${fmt(sk.hip)}Q${fmt(sk.kneeBack)} ${fmt(sk.footBack)}`);
        r.legFront?.setAttribute("d", `M${fmt(sk.hip)}Q${fmt(sk.kneeFront)} ${fmt(sk.footFront)}`);
        r.shoeBack?.setAttribute("cx", (sk.footBack.x + 3).toFixed(1));
        r.shoeFront?.setAttribute("cx", (sk.footFront.x + 3).toFixed(1));
        r.shorts?.setAttribute("cx", sk.hip.x.toFixed(1));
        r.shorts?.setAttribute("cy", sk.hip.y.toFixed(1));
        r.torso?.setAttribute("d", `M${fmt(sk.hip)}L${fmt(sk.shoulder)}`);
        const mid = { x: (sk.hip.x * 0.45 + sk.shoulder.x * 0.55), y: (sk.hip.y * 0.45 + sk.shoulder.y * 0.55) };
        r.stripe?.setAttribute("d", `M${fmt({ x: mid.x - 2, y: mid.y + 4 })}L${fmt({ x: mid.x + 13, y: mid.y - 3 })}`);
        r.upperFar?.setAttribute("d", `M${fmt(sk.shoulder)}L${fmt(sk.elbowFar)}`);
        r.foreFar?.setAttribute("d", `M${fmt(sk.elbowFar)}L${fmt(sk.handFar)}`);
        r.handFar?.setAttribute("cx", sk.handFar.x.toFixed(1));
        r.handFar?.setAttribute("cy", sk.handFar.y.toFixed(1));
        r.upperNear?.setAttribute("d", `M${fmt(sk.shoulder)}L${fmt(sk.elbowNear)}`);
        r.foreNear?.setAttribute("d", `M${fmt(sk.elbowNear)}L${fmt(sk.handNear)}`);
        r.handNear?.setAttribute("cx", sk.handNear.x.toFixed(1));
        r.handNear?.setAttribute("cy", sk.handNear.y.toFixed(1));
        r.head?.setAttribute("transform", `translate(${fmt(sk.head)}) rotate(${deg(-sk.headAngle).toFixed(2)})`);
        r.mouthGrit?.setAttribute("opacity", mouth === "grit" ? "1" : "0");
        r.mouthOpen?.setAttribute("opacity", mouth === "open" ? "1" : "0");
        r.mouthSmile?.setAttribute("opacity", mouth === "smile" ? "1" : "0");
        r.mouthCalm?.setAttribute("opacity", mouth === "calm" ? "1" : "0");
        r.cheek?.setAttribute("opacity", mouth === "grit" ? String(0.35 + st.impulse[kid.side] * 0.4) : "0.15");

        if (pose.ropeY !== null) {
          ropePoints[kid.side].push(toWorld(sk.handFar, baseX, baseY, facing, rot), toWorld(sk.handNear, baseX, baseY, facing, rot));
        } else {
          // El ipi bıraktı: ip o noktada yere düşer.
          ropePoints[kid.side].push({ x: baseX + dir * 6, y: GROUND - 3 }, { x: baseX - dir * 6, y: GROUND - 3 });
        }
      });

      st.impulse = st.impulse.map((v) => v * Math.exp(-dt * 3.2));
      st.yank = st.yank.map((v) => v * Math.exp(-dt * 4));

      // ---- ip ----
      // Her takım için: kuyruk (yerde) -> arka çocuk -> ... -> ön çocuk -> merkez.
      const left = [...ropePoints[0]].sort((a, b) => a.x - b.x);
      const right = [...ropePoints[1]].sort((a, b) => a.x - b.x);
      const frontL = left[left.length - 1];
      const frontR = right[0];
      const slack = ending ? 26 : live ? 4 + Math.abs(struggle) : 22;
      const midPoint = { x: (frontL.x + frontR.x) / 2, y: (frontL.y + frontR.y) / 2 + slack };
      const tailL = { x: left[0].x - 70, y: GROUND - 4 };
      const tailR = { x: right[right.length - 1].x + 70, y: GROUND - 4 };
      const snapped = inp.winner === "draw" && ending && (st.snapped || st.skipEnding);
      let leftEnd = midPoint;
      let rightEnd = midPoint;
      if (snapped) {
        const p = easeOut(clamp01((endT - 0.2) / 0.5));
        leftEnd = { x: midPoint.x - 30 - 40 * p, y: midPoint.y + (GROUND - 4 - midPoint.y) * p };
        rightEnd = { x: midPoint.x + 30 + 40 * p, y: midPoint.y + (GROUND - 4 - midPoint.y) * p };
      }
      const pathThrough = (pts: Vec[], end: Vec, reverse: boolean) => {
        const all = reverse ? [end, ...pts] : [...pts, end];
        let d = `M${fmt(all[0])}`;
        for (let j = 1; j < all.length; j++) {
          const a = all[j - 1];
          const b = all[j];
          const sag = Math.min(14, Math.abs(b.x - a.x) * 0.04) * (ending ? 2 : 1);
          d += `Q${fmt({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag })} ${fmt(b)}`;
        }
        return d;
      };
      const dLeft = pathThrough([tailL, ...left], leftEnd, false);
      const dRight = pathThrough([...right, tailR], rightEnd, true);
      ropeLeft?.setAttribute("d", dLeft);
      braidLeft?.setAttribute("d", dLeft);
      ropeRight?.setAttribute("d", dRight);
      braidRight?.setAttribute("d", dRight);
      const braidOffset = (-st.offset * 1).toFixed(1);
      braidLeft?.setAttribute("stroke-dashoffset", braidOffset);
      braidRight?.setAttribute("stroke-dashoffset", braidOffset);
      const ribbonPos = snapped ? { x: midPoint.x, y: GROUND - 6 } : midPoint;
      ribbon?.setAttribute("transform", `translate(${fmt(ribbonPos)}) rotate(${(st.vel * -0.04).toFixed(1)})`);

      // ---- parçacıklar ----
      for (let j = particles.length - 1; j >= 0; j--) {
        const p = particles[j];
        p.life += dt;
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life >= p.max) particles.splice(j, 1);
      }
      particleEls.forEach((el, j) => {
        const p = particles[j];
        if (!p) {
          el.setAttribute("opacity", "0");
          return;
        }
        el.setAttribute("cx", p.x.toFixed(1));
        el.setAttribute("cy", p.y.toFixed(1));
        el.setAttribute("r", (p.r * (1 - 0.4 * (p.life / p.max))).toFixed(1));
        el.setAttribute("fill", p.color);
        el.setAttribute("opacity", (1 - p.life / p.max).toFixed(2));
      });

      raf = requestAnimationFrame(frame);
    };
    let raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Çizim sabittir; yalnızca takım renkleri değişirse yeniden kurulur. Hareketi döngü yönetir.
  const [left, right] = teams;
  const art = useMemo(
    () => <SceneArt teams={[{ base: left.base, deep: left.deep }, { base: right.base, deep: right.deep }]} />,
    [left.base, left.deep, right.base, right.deep],
  );
  return (
    <svg ref={svgRef} viewBox={`0 ${VIEW_Y} ${W} ${H - VIEW_Y}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      {art}
    </svg>
  );
}

function SceneArt({ teams }: { teams: [SceneTeam, SceneTeam] }) {
  const [left, right] = teams;
  return (
    <>
      <defs>
        <linearGradient id="tug-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-ink-950)" />
          <stop offset="1" stopColor="var(--color-ink-700)" />
        </linearGradient>
        <linearGradient id="tug-pit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-camur-koyu)" />
          <stop offset="1" stopColor="var(--color-camur)" />
        </linearGradient>
      </defs>

      {/* Gökyüzü, yıldızlar, tepeler */}
      <rect width={W} height={HORIZON + 10} fill="url(#tug-sky)" />
      {STARS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="var(--color-cream)" opacity={0.35} />
      ))}
      <g data-part="far">
      <path d={`M-300 ${HORIZON - 40} L0 ${HORIZON - 30} C 220 ${HORIZON - 80} 420 ${HORIZON - 20} 640 ${HORIZON - 55} S 1040 ${HORIZON - 10} 1260 ${HORIZON - 60} S 1520 ${HORIZON - 40} ${W} ${HORIZON - 50} L ${W + 300} ${HORIZON - 30} V ${HORIZON + 10} H -300 Z`} fill="var(--color-ink-800)" />
      <path d={`M-300 ${HORIZON - 20} L0 ${HORIZON - 8} C 300 ${HORIZON - 40} 520 ${HORIZON + 2} 800 ${HORIZON - 22} S 1300 ${HORIZON + 4} ${W} ${HORIZON - 26} L ${W + 300} ${HORIZON - 14} V ${HORIZON + 10} H -300 Z`} fill="var(--color-ink-850)" />
      </g>

      {/* Takım renklerinde bayraklar */}
      <Bunting left={left.base} right={right.base} />

      {/* Kamerayla kayan dünya: saha, havuz, çocuklar, ip, parçacıklar */}
      <g data-part="world">
      {/* Saha: çim şeritleri, kireç çizgileri */}
      <rect x={-500} y={HORIZON} width={W + 1000} height={H - HORIZON} fill="var(--color-saha)" />
      {[0, 2, 4].map((i) => (
        <rect key={i} x={-500} y={HORIZON + 12 + i * 26} width={W + 1000} height={26} fill="var(--color-saha-acik)" opacity={0.6} />
      ))}
      <rect x={-500} y={HORIZON} width={W + 1000} height={10} fill="rgb(0 0 0 / 0.18)" />
      <line x1={CENTER} y1={HORIZON + 12} x2={CENTER} y2={H} stroke="var(--color-cream)" strokeWidth={4} opacity={0.5} />
      <GoalFlag x={CENTER - TRAVEL} color={left.base} />
      <GoalFlag x={CENTER + TRAVEL} color={right.base} />

      {/* Çamur havuzu: arka yarısı çocukların arkasında */}
      <ellipse cx={CENTER} cy={GROUND + 10} rx={PIT_RX + 10} ry={24} fill="var(--color-camur-koyu)" />
      <ellipse cx={CENTER} cy={GROUND + 12} rx={PIT_RX} ry={19} fill="url(#tug-pit)" />

      {/* Çocukların gövdeleri */}
      {KIDS.map((kid, i) => (
        <KidBack key={`b${i}`} index={i} kid={kid} team={teams[kid.side]} />
      ))}

      {/* İp */}
      <path data-part="rope-left" fill="none" stroke="var(--color-ip)" strokeWidth={9} strokeLinecap="round" />
      <path data-part="rope-right" fill="none" stroke="var(--color-ip)" strokeWidth={9} strokeLinecap="round" />
      <path data-part="braid-left" fill="none" stroke="var(--color-ip-koyu)" strokeWidth={9} strokeDasharray="4 7" />
      <path data-part="braid-right" fill="none" stroke="var(--color-ip-koyu)" strokeWidth={9} strokeDasharray="4 7" />
      <g data-part="ribbon">
        <path d="M0 0 L-9 30 L-3 27 L-1 34 Z" fill="var(--color-mercan)" />
        <path d="M0 0 L9 28 L3 26 L2 33 Z" fill="var(--color-mercan-deep)" />
        <circle r={7} fill="var(--color-mercan)" stroke="var(--color-mercan-deep)" strokeWidth={2} />
      </g>

      {/* Ön kollar ipin üstünde */}
      {KIDS.map((kid, i) => (
        <KidFront key={`f${i}`} index={i} kid={kid} team={teams[kid.side]} />
      ))}

      {/* Havuzun ön kenarı: düşen çocuğun yarısı çamura gömülü görünür */}
      <path
        d={`M${CENTER - PIT_RX - 10} ${GROUND + 10} A ${PIT_RX + 10} 24 0 0 0 ${CENTER + PIT_RX + 10} ${GROUND + 10} L ${CENTER + PIT_RX} ${GROUND + 13} A ${PIT_RX} 15 0 0 1 ${CENTER - PIT_RX} ${GROUND + 13} Z`}
        fill="var(--color-camur-koyu)"
      />
      <path d={`M${CENTER - PIT_RX + 6} ${GROUND + 19} A ${PIT_RX - 6} 13 0 0 0 ${CENTER + PIT_RX - 6} ${GROUND + 19}`} fill="none" stroke="var(--color-camur)" strokeWidth={6} />
      <ellipse cx={CENTER - 30} cy={GROUND + 22} rx={14} ry={3} fill="var(--color-camur-parlak)" opacity={0.7} />

      {/* Donma: buz kalıpları */}
      {KIDS.map((kid, i) => (
        <g key={`i${i}`} data-kid={i} data-part="ice" opacity={0}>
          <rect x={-64} y={-176} width={108} height={180} rx={14} fill="rgb(190 235 255 / 0.32)" stroke="rgb(225 248 255 / 0.85)" strokeWidth={3} />
          <path d="M-48 -158 L-32 -158 M-52 -144 L-42 -144 M24 -20 L34 -36" stroke="rgb(255 255 255 / 0.8)" strokeWidth={3} strokeLinecap="round" />
        </g>
      ))}

      {/* Parçacıklar */}
      <g>
        {Array.from({ length: PARTICLES }, (_, i) => (
          <circle key={i} data-particle r={0} opacity={0} />
        ))}
      </g>
      </g>
    </>
  );
}

const STARS: [number, number, number][] = [
  [80, 40, 1.6], [190, 120, 1.2], [320, 60, 2], [470, 30, 1.3], [560, 140, 1.1], [700, 50, 1.7], [880, 90, 1.2],
  [990, 30, 2], [1120, 130, 1.3], [1230, 55, 1.6], [1380, 110, 1.1], [1500, 45, 1.8], [40, 160, 1.1], [1560, 170, 1.3],
];

function Bunting({ left, right }: { left: string; right: string }) {
  const flags: { x: number; y: number; a: number; c: string }[] = [];
  const at = (x: number) => 70 + 34 * Math.sin((x / W) * Math.PI);
  for (let x = 30; x < W; x += 52) {
    const y = at(x);
    const slope = (at(x + 1) - y) * 1;
    const c = Math.abs(x - CENTER) < 40 ? "var(--color-cream)" : x < CENTER ? left : right;
    flags.push({ x, y, a: Math.atan(slope), c });
  }
  return (
    <g>
      <path d={`M0 ${at(0)} Q ${CENTER} ${at(CENTER) * 2 - 70} ${W} ${at(W)}`} stroke="var(--color-ink-300)" strokeWidth={2} fill="none" opacity={0.5} />
      {flags.map((f, i) => (
        <path key={i} d="M-14 0 L14 0 L0 26 Z" transform={`translate(${f.x} ${f.y}) rotate(${deg(f.a)})`} fill={f.c} opacity={i % 2 ? 0.95 : 0.8} />
      ))}
    </g>
  );
}

function GoalFlag({ x, color }: { x: number; color: string }) {
  return (
    <g>
      <line x1={x} y1={HORIZON + 14} x2={x} y2={H} stroke={color} strokeWidth={5} opacity={0.75} strokeDasharray="14 10" />
      <line x1={x} y1={GROUND - 4} x2={x} y2={GROUND - 110} stroke="var(--color-cream)" strokeWidth={4} strokeLinecap="round" />
      <path d={`M${x} ${GROUND - 110} L${x + 46} ${GROUND - 96} L${x} ${GROUND - 82} Z`} fill={color} />
    </g>
  );
}

function KidBack({ index, kid, team }: { index: number; kid: Kid; team: SceneTeam }) {
  return (
    <g data-kid={index} data-part="back">
      {/* Uzak kol gövdenin arkasında */}
      <path data-part="upperFar" stroke={team.deep} strokeWidth={12} strokeLinecap="round" fill="none" />
      <path data-part="foreFar" stroke={kid.skin} strokeWidth={10} strokeLinecap="round" fill="none" />
      <circle data-part="handFar" r={6.5} fill={kid.skin} />
      <path data-part="legBack" stroke={PANTS} strokeWidth={14} strokeLinecap="round" fill="none" />
      <ellipse data-part="shoeBack" cy={-3} rx={12} ry={6.5} fill={SHOE} />
      <path data-part="legFront" stroke={PANTS} strokeWidth={14} strokeLinecap="round" fill="none" />
      <ellipse data-part="shoeFront" cy={-3} rx={12} ry={6.5} fill={SHOE} />
      <circle data-part="shorts" r={15} fill={PANTS} />
      <path data-part="torso" stroke={team.base} strokeWidth={32} strokeLinecap="round" fill="none" />
      <path data-part="stripe" stroke={team.deep} strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.8} />
      <g data-part="head">
        <Head kid={kid} />
      </g>
    </g>
  );
}

function KidFront({ index, kid, team }: { index: number; kid: Kid; team: SceneTeam }) {
  return (
    <g data-kid={index} data-part="front">
      <path data-part="upperNear" stroke={team.base} strokeWidth={13} strokeLinecap="round" fill="none" />
      <path data-part="foreNear" stroke={kid.skin} strokeWidth={10.5} strokeLinecap="round" fill="none" />
      <circle data-part="handNear" r={7} fill={kid.skin} stroke="rgb(0 0 0 / 0.15)" strokeWidth={1.5} />
    </g>
  );
}

/** Baş: yerel koordinatta merkez (0,0), yüz +x yönüne bakar. */
function Head({ kid }: { kid: Kid }) {
  const hairBack =
    kid.style === "ponytail" ? (
      <g fill={kid.hair}>
        <ellipse cx={-23} cy={-1} rx={10} ry={6} transform="rotate(-25 -23 -1)" />
        <circle cx={-15} cy={-5} r={4} fill="var(--color-mercan)" />
      </g>
    ) : kid.style === "bun" ? (
      <circle cx={-9} cy={-19} r={8.5} fill={kid.hair} />
    ) : null;
  const hairTop =
    kid.style === "curly" ? (
      <g fill={kid.hair}>
        <circle cx={-11} cy={-10} r={9} />
        <circle cx={-2} cy={-15} r={9} />
        <circle cx={8} cy={-14} r={7.5} />
        <circle cx={-16} cy={0} r={7} />
        <circle cx={14} cy={-8} r={5} />
      </g>
    ) : (
      <path d="M-17 4 C-19 -12 -7 -20 3 -19 C11 -18 17 -12 17.5 -5 C10 -8 4 -9 -2 -7 C-7 -4 -10 1 -12 7 Z" fill={kid.hair} />
    );
  return (
    <>
      {hairBack}
      <circle r={17} fill={kid.skin} />
      {hairTop}
      <circle cx={-4} cy={2} r={4} fill={kid.skin} stroke="rgb(0 0 0 / 0.12)" strokeWidth={1.5} />
      <ellipse cx={9} cy={-3} rx={2.3} ry={3.1} fill={DARK} />
      <path d="M4.5 -9.5 L13 -7.5" stroke={DARK} strokeWidth={2.6} strokeLinecap="round" />
      <circle data-part="cheek" cx={6} cy={5} r={3.8} fill="var(--color-mercan)" opacity={0.3} />
      <g data-part="mouthGrit">
        <rect x={7} y={6} width={9} height={5} rx={1.5} fill="#fff" stroke={DARK} strokeWidth={1.6} />
        <line x1={7.5} y1={8.5} x2={15.5} y2={8.5} stroke={DARK} strokeWidth={1} />
      </g>
      <ellipse data-part="mouthOpen" cx={11.5} cy={9} rx={3.6} ry={4.4} fill={DARK} opacity={0} />
      <path data-part="mouthSmile" d="M5.5 6 Q 11 14 16 5.5 Z" fill={DARK} opacity={0} />
      <path data-part="mouthCalm" d="M7 8.5 L14 8" stroke={DARK} strokeWidth={2.2} strokeLinecap="round" opacity={0} />
    </>
  );
}
