"use client";

import confetti from "canvas-confetti";
import { useEffect, useMemo, useRef } from "react";
import { cssColor } from "@/lib/color";
import { sfx } from "@/lib/sound";
import { fmt, reach, type Vec } from "../../shared/skeleton";
import { classify, KICK_LOCK_MS, type Kick, type PenaltyState } from "../logic";
import { DUST_COUNT, netGrid, SceneArt, type ArtTeam } from "./art";
import {
  ballAt,
  BALL_FAR,
  BALL_NEAR,
  divePose,
  GOAL_BOTTOM,
  GOAL_CX,
  guessPoint,
  KEEPER_HIP,
  KICKER_HOME,
  KICKER_READY,
  KICKER_STRIKE,
  SPOT,
  toGoal,
  toNetBack,
  toScreen,
  WORLD_LEFT,
  WORLD_RIGHT,
} from "./geometry";

/**
 * Penaltı sahnesi. Oyun mantığından özet bir girdi alır ve bütün hareketi tek bir
 * requestAnimationFrame döngüsünde çizer: şutçunun koşusu ve vuruşu, topun uçuşu, kalecinin
 * uçuşu, ağır çekim kurtarış ya da ağı esneten gol, tribünün coşkusu, kamera.
 *
 * Şutçu sahneye dokunup parmağını kalede istediği yere sürükler ve bırakır; sahne bırakılan noktayı
 * kale koordinatına çevirip `onKick` ile bildirir. Sonucu (gol, kurtarış) oyun mantığı hesaplar.
 */

export type SceneInput = {
  phase: PenaltyState["phase"];
  shooter: 0 | 1 | null;
  /** Şut hakkının kazanıldığı an (Date.now). */
  kickStart: number | null;
  kicks: Kick[];
  locked: [boolean, boolean];
  winner: 0 | 1 | "draw" | null;
};

type Props = {
  input: SceneInput;
  teams: [ArtTeam, ArtTeam];
  reducedMotion: boolean;
  onKick: (x: number, y: number) => void;
  /** Top kaleye, kaleciye ya da direğe ulaştı: skor bu anda güncellenir. */
  onContact: (index: number) => void;
  onKickDone: (index: number) => void;
  onFinale: () => void;
};

type Rect = { x: number; y: number; w: number; h: number };
const QUESTION_VIEW: Rect = { x: 240, y: 300, w: 1120, h: 640 };
const KICK_VIEW: Rect = { x: 200, y: 236, w: 1200, h: 790 };

// Şutun zaman çizelgesi (sahne saniyesi, ağır çekimde yavaşlar).
const STRIKE = 0.36;
const FLIGHT = 0.52;
const CONTACT = STRIKE + FLIGHT;
const DIVE_START = 0.42;
const DONE_AT = 2.5;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const deg = (r: number) => (r * 180) / Math.PI;
const rot = (p: Vec, a: number): Vec => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });

/** Kalecinin "tahmin" yüksekliği: kurtaramadığı şutlarda nereye uçtuğu (görsel, belirli). */
const guessHeight = (index: number) => [0.25, 0.7, 0.45, 0.85, 0.15, 0.6][index % 6];

type KickAnim = {
  index: number;
  kick: Kick;
  start: number;
  target: Vec;
  guess: Vec;
  struck: boolean;
  contacted: boolean;
  landed: boolean;
  bannered: boolean;
  doneCalled: boolean;
  /** Temastan sonra topun serbest hareketi. */
  loose: { p: Vec; v: Vec; r: number; back: boolean; spin: number } | null;
};

type Dust = { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number };

export function PenaltyScene({ input, teams, reducedMotion, onKick, onContact, onKickDone, onFinale }: Props) {
  const inputRef = useRef(input);
  const teamsRef = useRef(teams);
  const motionRef = useRef(reducedMotion);
  const handlers = useRef({ onKick, onContact, onKickDone, onFinale });
  useEffect(() => {
    inputRef.current = input;
    teamsRef.current = teams;
    motionRef.current = reducedMotion;
    handlers.current = { onKick, onContact, onKickDone, onFinale };
  });

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const q = <T extends Element>(sel: string, root: ParentNode = svg) => root.querySelector<T>(sel);
    const qa = <T extends Element>(sel: string, root: ParentNode = svg) => Array.from(root.querySelectorAll<T>(sel));

    const keeper = {
      root: q<SVGGElement>('[data-part="keeper"]'),
      shadow: q<SVGEllipseElement>('[data-part="keeper-shadow"]'),
      head: q<SVGGElement>('[data-part="keeper-head"]'),
      mouth: {
        focus: q<SVGPathElement>('[data-part="keeper-mouth-focus"]'),
        shock: q<SVGEllipseElement>('[data-part="keeper-mouth-shock"]'),
        grin: q<SVGPathElement>('[data-part="keeper-mouth-grin"]'),
      },
      arm: (["left", "right"] as const).map((s) => ({
        upper: q<SVGPathElement>(`[data-part="keeper-upper-${s}"]`),
        fore: q<SVGPathElement>(`[data-part="keeper-fore-${s}"]`),
        glove: q<SVGGElement>(`[data-part="keeper-glove-${s}"]`),
        thigh: q<SVGPathElement>(`[data-part="keeper-thigh-${s}"]`),
        shin: q<SVGPathElement>(`[data-part="keeper-shin-${s}"]`),
        boot: q<SVGEllipseElement>(`[data-part="keeper-boot-${s}"]`),
      })),
    };
    const kickers = ([0, 1] as const).map((s) => {
      const root = q<SVGGElement>(`[data-kicker="${s}"]`)!;
      const p = <T extends Element>(n: string) => q<T>(`[data-part="${n}"]`, root);
      return {
        root,
        supportLeg: p<SVGPathElement>("support-leg"),
        supportSock: p<SVGPathElement>("support-sock"),
        supportBoot: p<SVGEllipseElement>("support-boot"),
        kickLeg: p<SVGPathElement>("kick-leg"),
        kickSock: p<SVGPathElement>("kick-sock"),
        kickBoot: p<SVGEllipseElement>("kick-boot"),
        armL: p<SVGPathElement>("arm-left"),
        armR: p<SVGPathElement>("arm-right"),
        handL: p<SVGCircleElement>("hand-left"),
        handR: p<SVGCircleElement>("hand-right"),
        head: p<SVGGElement>("kicker-head"),
      };
    });
    const ball = q<SVGGElement>('[data-part="ball"]');
    const ballBack = q<SVGGElement>('[data-part="ball-back"]');
    const ballSpins = qa<SVGGElement>('[data-part="ball-spin"]');
    const ballShadow = q<SVGEllipseElement>('[data-part="ball-shadow"]');
    const netRows = qa<SVGPathElement>("[data-net-row]");
    const netCols = qa<SVGPathElement>("[data-net-col]");
    const posts = q<SVGGElement>('[data-part="posts"]');
    const crowd = qa<SVGGElement>("[data-crowd]");
    const ledGlow = q<SVGRectElement>('[data-part="led-glow"]');
    const star = q<SVGGElement>('[data-part="star"]');
    const flash = q<SVGCircleElement>('[data-part="flash"]');
    const aim = q<SVGGElement>('[data-part="aim"]');
    const aimLine = q<SVGPathElement>('[data-part="aim-line"]');
    const aimTarget = q<SVGGElement>('[data-part="aim-target"]');
    const aimRing = q<SVGCircleElement>('[data-part="aim-ring"]');
    const banner = q<SVGGElement>('[data-part="banner"]');
    const bannerText = q<SVGTextElement>('[data-part="banner-text"]');
    const dustEls = qa<SVGCircleElement>("[data-dust]");
    const grid = netGrid();

    const start = inputRef.current;
    const st = {
      aspect: svg.clientWidth / Math.max(1, svg.clientHeight) || 2,
      cam: { ...(start.phase === "kick" || start.phase === "result" || start.phase === "finished" ? KICK_VIEW : QUESTION_VIEW) } as Rect,
      sceneTime: 0,
      lastFrame: performance.now(),
      seenKicks: start.kicks.length,
      anim: null as KickAnim | null,
      shake: 0,
      bulge: null as null | { at: Vec; start: number },
      celebrate: null as null | { side: 0 | 1; start: number },
      banner: null as null | { start: number },
      starAt: null as null | { p: Vec; start: number },
      postHit: null as null | { start: number },
      kicker: [
        { pos: { ...KICKER_HOME[0] } },
        { pos: { ...KICKER_HOME[1] } },
      ],
      keeper: { hip: { ...KEEPER_HIP }, angle: 0, hands: [{ x: -62, y: -30 }, { x: 62, y: -30 }] as Vec[] },
      finale: null as null | { start: number; called: boolean; confetti: boolean },
      lastPhase: start.phase,
      aiming: null as null | { id: number; p: Vec },
      whistled: start.kickStart,
      keeperPose: { hip: { ...KEEPER_HIP }, angle: 0 },
    };
    type Mood = "calm" | "cheer" | "dismay" | "shrug";
    const dust: Dust[] = [];
    const calm = () => motionRef.current;
    const puff = (x: number, y: number, n: number) => {
      if (calm()) return;
      for (let i = 0; i < n; i++) {
        if (dust.length >= DUST_COUNT) dust.shift();
        dust.push({ x: x + (Math.random() - 0.5) * 40, y: y - Math.random() * 8, vx: (Math.random() - 0.5) * 90, vy: -20 - Math.random() * 50, r: 8 + Math.random() * 10, life: 0, max: 0.8 + Math.random() * 0.5 });
      }
    };

    // Bitmiş bir oyun yeniden açıldıysa gösteri atlanır.
    if (start.phase === "finished") st.finale = { start: -10, called: false, confetti: true };

    const ro = new ResizeObserver(() => {
      st.aspect = svg.clientWidth / Math.max(1, svg.clientHeight) || st.aspect;
    });
    ro.observe(svg);

    // ---- nişan: sürükle ve bırak ----
    const toWorld = (e: PointerEvent): Vec | null => {
      const m = svg.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };
    const canAim = () => {
      const inp = inputRef.current;
      return inp.phase === "kick" && inp.kickStart !== null && Date.now() - inp.kickStart >= KICK_LOCK_MS && inp.kicks.length === st.seenKicks;
    };
    const onDown = (e: PointerEvent) => {
      if (!canAim() || st.aiming || (e.pointerType === "mouse" && e.button !== 0)) return;
      const p = toWorld(e);
      if (!p) return;
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      st.aiming = { id: e.pointerId, p };
    };
    const onMove = (e: PointerEvent) => {
      if (!st.aiming || st.aiming.id !== e.pointerId) return;
      const p = toWorld(e);
      if (p) st.aiming.p = p;
    };
    const onUp = (e: PointerEvent) => {
      if (!st.aiming || st.aiming.id !== e.pointerId) return;
      const p = toWorld(e) ?? st.aiming.p;
      st.aiming = null;
      if (!canAim()) return;
      const g = toGoal(p);
      handlers.current.onKick(g.x, g.y);
    };
    const onCancel = () => {
      st.aiming = null;
    };
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onCancel);

    // ---- kalecinin çizimi ----
    function drawKeeper(hip: Vec, angle: number, handsWorld: Vec[] | null, handsLocal: Vec[] | null, mouth: "focus" | "shock" | "grin", grounded: boolean): Vec {
      let gloves = { x: 0, y: 0 };
      keeper.root?.setAttribute("transform", `translate(${fmt(hip)}) rotate(${deg(angle).toFixed(2)})`);
      const shoulders = [{ x: -31, y: -62 }, { x: 31, y: -62 }];
      const targets = handsLocal ?? handsWorld!.map((w) => rot({ x: w.x - hip.x, y: w.y - hip.y }, -angle));
      keeper.arm.forEach((a, i) => {
        const { elbow, hand } = reach(shoulders[i], targets[i], 34, 32);
        a.upper?.setAttribute("d", `M${fmt(shoulders[i])}L${fmt(elbow)}`);
        a.fore?.setAttribute("d", `M${fmt(elbow)}L${fmt(hand)}`);
        a.glove?.setAttribute("transform", `translate(${fmt(hand)})`);
        const w = rot(hand, angle);
        gloves = { x: gloves.x + (hip.x + w.x) / 2, y: gloves.y + (hip.y + w.y) / 2 };
        // Bacaklar: yerdeyken ayaklar zeminde kalır, dizler dışa kırılır; havadayken uzanır.
        const sign = i === 0 ? -1 : 1;
        const footY = grounded ? Math.max(48, Math.min(92, GOAL_BOTTOM + 8 - hip.y)) : 90;
        const footX = sign * (grounded ? 26 + (92 - footY) * 0.3 : 16 + i * 10);
        const kneeX = sign * (20 + (92 - footY) * 0.55);
        const hipP = { x: sign * 14, y: 8 };
        const knee = { x: kneeX, y: (8 + footY) / 2 + (grounded ? 0 : i * 8) };
        a.thigh?.setAttribute("d", `M${fmt(hipP)}L${fmt(knee)}`);
        a.shin?.setAttribute("d", `M${fmt(knee)}L${footX.toFixed(1)} ${footY.toFixed(1)}`);
        a.boot?.setAttribute("cx", (footX + sign * 3).toFixed(1));
        a.boot?.setAttribute("cy", (footY + 4).toFixed(1));
      });
      keeper.mouth.focus?.setAttribute("opacity", mouth === "focus" ? "1" : "0");
      keeper.mouth.shock?.setAttribute("opacity", mouth === "shock" ? "1" : "0");
      keeper.mouth.grin?.setAttribute("opacity", mouth === "grin" ? "1" : "0");
      const lift = Math.max(0, GOAL_BOTTOM - 40 - hip.y);
      keeper.shadow?.setAttribute("cx", hip.x.toFixed(1));
      keeper.shadow?.setAttribute("rx", (48 + Math.abs(Math.sin(angle)) * 60 - lift * 0.1).toFixed(1));
      keeper.shadow?.setAttribute("opacity", clamp01(1 - lift / 300).toFixed(2));
      return gloves;
    }

    // ---- şutçunun çizimi (arkadan) ----
    function drawKicker(side: 0 | 1, pos: Vec, opts: { kickFoot: Vec; supportFoot: Vec; hands: [Vec, Vec]; hop: number; headTilt: number }) {
      const k = kickers[side];
      k.root.setAttribute("transform", `translate(${pos.x.toFixed(1)} ${(pos.y - opts.hop).toFixed(1)})`);
      const leg = (hip: Vec, foot: Vec, outward: number) => {
        const mid = mix(hip, foot, 0.5);
        const len = Math.hypot(foot.x - hip.x, foot.y - hip.y);
        const bend = Math.max(0, 112 - len) * 0.7;
        return { knee: { x: mid.x + outward * (6 + bend), y: mid.y }, foot };
      };
      const s = leg({ x: -13, y: -112 }, opts.supportFoot, -1);
      const kk = leg({ x: 13, y: -112 }, opts.kickFoot, 1);
      const legPath = (hip: Vec, l: { knee: Vec; foot: Vec }) => `M${fmt(hip)}L${fmt(l.knee)}L${fmt(l.foot)}`;
      const sockPath = (l: { knee: Vec; foot: Vec }) => `M${fmt(mix(l.knee, l.foot, 0.35))}L${fmt(l.foot)}`;
      k.supportLeg?.setAttribute("d", legPath({ x: -13, y: -112 }, s));
      k.supportSock?.setAttribute("d", sockPath(s));
      k.supportBoot?.setAttribute("cx", s.foot.x.toFixed(1));
      k.supportBoot?.setAttribute("cy", (s.foot.y + 2).toFixed(1));
      k.kickLeg?.setAttribute("d", legPath({ x: 13, y: -112 }, kk));
      k.kickSock?.setAttribute("d", sockPath(kk));
      k.kickBoot?.setAttribute("cx", kk.foot.x.toFixed(1));
      k.kickBoot?.setAttribute("cy", (kk.foot.y + 2).toFixed(1));
      const shoulders = [{ x: -34, y: -190 }, { x: 34, y: -190 }];
      opts.hands.forEach((h, i) => {
        const { elbow, hand } = reach(shoulders[i], h, 50, 46);
        (i === 0 ? k.armL : k.armR)?.setAttribute("d", `M${fmt(shoulders[i])}L${fmt(elbow)}L${fmt(hand)}`);
        const el = i === 0 ? k.handL : k.handR;
        el?.setAttribute("cx", hand.x.toFixed(1));
        el?.setAttribute("cy", hand.y.toFixed(1));
      });
      k.head?.setAttribute("transform", `translate(0 -236) rotate(${opts.headTilt.toFixed(1)})`);
    }

    const HANDS_REST: [Vec, Vec] = [{ x: -44, y: -108 }, { x: 44, y: -108 }];
    const HANDS_UP: [Vec, Vec] = [{ x: -56, y: -290 }, { x: 56, y: -290 }];
    const HANDS_HEAD: [Vec, Vec] = [{ x: -18, y: -262 }, { x: 18, y: -262 }];

    // ---- kare döngüsü ----
    const frame = (now: number) => {
      const realDt = Math.min(0.05, (now - st.lastFrame) / 1000);
      st.lastFrame = now;
      const inp = inputRef.current;
      const quiet = calm();
      const wall = Date.now();

      // -- şutçu topun başına geldi: hakem düdüğü --
      if (inp.phase === "kick" && inp.kickStart !== null && inp.kickStart !== st.whistled && wall - inp.kickStart >= KICK_LOCK_MS - 150) {
        st.whistled = inp.kickStart;
        if (wall - inp.kickStart < KICK_LOCK_MS + 1500) sfx.whistle();
      }

      // -- yeni şut --
      if (inp.kicks.length > st.seenKicks) {
        const index = inp.kicks.length - 1;
        const kick = inp.kicks[index];
        st.seenKicks = inp.kicks.length;
        const target = toScreen(kick.x, kick.y);
        const save = kick.result === "kurtardi";
        st.anim = { index, kick, start: st.sceneTime, target, guess: save ? target : guessPoint(kick.keeper, guessHeight(index)), struck: false, contacted: false, landed: false, bannered: false, doneCalled: false, loose: null };
        st.aiming = null;
      }

      // -- ağır çekim: kurtarış ve gol anında zaman yavaşlar --
      let scale = 1;
      const a = st.anim;
      if (a && !quiet) {
        const tau = st.sceneTime - a.start;
        if (a.kick.result === "kurtardi" && tau > CONTACT - 0.12 && tau < CONTACT + 0.14) scale = 0.2;
        else if (a.kick.result === "gol" && tau > CONTACT - 0.06 && tau < CONTACT + 0.1) scale = 0.32;
      }
      const dt = realDt * scale;
      st.sceneTime += dt;
      const time = st.sceneTime;

      // -- soru açılınca sahne sıfırlanır --
      if (inp.phase !== st.lastPhase) {
        if (inp.phase === "question") {
          st.anim = null;
          st.bulge = null;
          st.banner = null;
          st.celebrate = null;
        }
        st.lastPhase = inp.phase;
      }

      // -- kaleci --
      const anim = st.anim;
      const tau = anim ? time - anim.start : 0;
      let hip = { ...KEEPER_HIP };
      let angle = 0;
      let handsWorld: Vec[] | null = null;
      let handsLocal: Vec[] | null = [{ x: -62, y: -30 }, { x: 62, y: -30 }];
      let mouth: "focus" | "shock" | "grin" = "focus";
      let grounded = true;
      const live = inp.phase === "kick" && !anim;
      if (live && !quiet) {
        // Hazır bekleyiş: parmak uçlarında yaylanır, iki yana adım atar.
        hip = { x: KEEPER_HIP.x + Math.sin(time * 2.3) * 14, y: KEEPER_HIP.y + 10 + Math.abs(Math.sin(time * 5.2)) * -5 };
        handsLocal = [{ x: -66, y: -44 }, { x: 66, y: -44 }];
      } else if (live) {
        hip = { x: KEEPER_HIP.x, y: KEEPER_HIP.y + 10 };
        handsLocal = [{ x: -66, y: -44 }, { x: 66, y: -44 }];
      }
      if (anim) {
        const k = anim.kick;
        const save = k.result === "kurtardi";
        const dest = divePose(anim.guess);
        const p = clamp01((tau - DIVE_START) / (CONTACT - DIVE_START));
        const e = easeOut(p);
        const crouch = clamp01((tau - (DIVE_START - 0.1)) / 0.1) * (1 - p);
        const fromHip = { x: KEEPER_HIP.x, y: KEEPER_HIP.y + 14 * crouch };
        hip = { x: lerp(fromHip.x, dest.hip.x, e), y: lerp(fromHip.y, dest.hip.y, e) - Math.sin(Math.PI * p) * 18 };
        angle = lerp(0, dest.angle, e);
        handsWorld = [anim.guess, anim.guess].map((g, i) => ({ x: g.x + (i === 0 ? -9 : 9) * Math.cos(angle), y: g.y + (i === 0 ? -9 : 9) * Math.sin(angle) }));
        handsLocal = null;
        grounded = Math.abs(dest.angle) < 0.4 && dest.hip.y > KEEPER_HIP.y - 10;
        // Temastan sonra yere iner.
        const after = tau - CONTACT;
        if (after > 0) {
          const centre = Math.abs(dest.angle) < 0.4;
          const fall = easeInOut(clamp01(after / 0.45));
          if (centre) {
            hip = mix(dest.hip, { x: dest.hip.x, y: KEEPER_HIP.y + 6 }, fall);
            grounded = fall > 0.6 || grounded;
            if (save) handsLocal = [{ x: -16, y: -46 }, { x: 16, y: -46 }];
            if (save) handsWorld = null;
          } else {
            const side = Math.sign(dest.angle);
            const landAngle = side * (100 * Math.PI) / 180;
            angle = lerp(dest.angle, landAngle, fall);
            const landHip = { x: dest.hip.x + side * 10, y: GOAL_BOTTOM - 26 };
            hip = mix(dest.hip, landHip, fall);
            if (after > 0.42 && !anim.landed) {
              anim.landed = true;
              puff(landHip.x, GOAL_BOTTOM + 4, 10);
              sfx.thump();
            }
          }
          mouth = save ? "grin" : "shock";
        }
      }
      // Şuttan sonra yeni soruda kaleci yerden kalkıp kalenin ortasına döner.
      if (!anim) {
        const kk = quiet ? 1 : 1 - Math.exp(-realDt * 5);
        hip = mix(st.keeperPose.hip, hip, kk);
        angle = lerp(st.keeperPose.angle, angle, kk);
        grounded = Math.abs(angle) < 0.4;
      }
      st.keeperPose = { hip, angle };
      const gloves = drawKeeper(hip, angle, handsWorld, handsLocal, mouth, grounded);

      // -- top --
      let ballPos: Vec = { ...SPOT };
      let ballR = BALL_NEAR;
      let ballGround: Vec = { x: SPOT.x, y: SPOT.y + 16 };
      let back = false;
      let ballVisible = inp.phase !== "reveal" || !!anim;
      let spin = 0;
      if (anim) {
        const k = anim.kick;
        const u = (tau - STRIKE) / FLIGHT;
        if (u >= 0 && !anim.struck) {
          anim.struck = true;
          sfx.kick();
          sfx.whoosh(FLIGHT * 1.6);
        }
        if (u < 0) {
          // Vuruştan önce top yerinde.
        } else if (u <= 1) {
          const f = ballAt(anim.target, u);
          ballPos = f.p;
          ballR = f.r;
          ballGround = f.ground;
          spin = u * 900;
        } else {
          // Temas anı: sonuçlar ayrılır.
          if (!anim.contacted) {
            anim.contacted = true;
            handlers.current.onContact(anim.index);
            const d = Math.sign(k.x) || 1;
            if (k.result === "gol") {
              anim.loose = { p: { ...anim.target }, v: { x: (anim.target.x - SPOT.x) * 0.25, y: (anim.target.y - SPOT.y) * 0.1 }, r: BALL_FAR, back: true, spin: 600 };
              st.bulge = { at: toNetBack(anim.target), start: time };
              st.celebrate = { side: k.side, start: time };
              sfx.net();
              sfx.roar();
              if (!quiet) {
                const colors = [teamsRef.current[k.side].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor);
                confetti({ particleCount: 90, spread: 100, startVelocity: 46, origin: { x: 0.5, y: 0.35 }, colors, disableForReducedMotion: true });
              }
            } else if (k.result === "kurtardi") {
              const centre = k.third === "orta";
              anim.loose = centre ? null : { p: { ...anim.target }, v: { x: d * 560, y: -360 }, r: BALL_FAR, back: false, spin: -900 };
              st.starAt = { p: { ...anim.target }, start: performance.now() };
              st.shake = 12;
              sfx.save();
              sfx.ooh();
            } else if (k.result === "direk") {
              const bar = classify(k.x, k.y) === "direk" && Math.abs(k.x) < 1 - 0.045;
              anim.loose = { p: { ...anim.target }, v: { x: bar ? d * 60 : -d * 180, y: bar ? -260 : -120 }, r: BALL_FAR, back: false, spin: 500 };
              st.postHit = { start: performance.now() };
              st.shake = 8;
              sfx.clang();
              sfx.aww();
            } else {
              anim.loose = { p: { ...anim.target }, v: { x: (anim.target.x - SPOT.x) * 1.4, y: (anim.target.y - SPOT.y) * 0.9 }, r: BALL_FAR, back: true, spin: 400 };
              sfx.aww();
            }
          }
          if (anim.loose) {
            const L = anim.loose;
            const after = tau - CONTACT;
            if (k.result === "gol") {
              // Ağa gömülür, sonra ağın dibine düşer ve yuvarlanır.
              const floor = GOAL_BOTTOM - 14;
              if (after < 0.14) {
                L.p = mix(anim.target, toNetBack(anim.target), easeOut(after / 0.14));
                L.r = BALL_FAR - 2 * (after / 0.14);
              } else {
                L.v.y += 1400 * dt;
                L.p = { x: L.p.x + (GOAL_CX - L.p.x) * dt * 0.8, y: Math.min(floor, L.p.y + L.v.y * dt) };
                if (L.p.y >= floor) L.v.y *= -0.3;
              }
            } else if (k.result === "aut") {
              L.p = { x: L.p.x + L.v.x * dt, y: L.p.y + L.v.y * dt };
              L.r = Math.max(6, L.r - 10 * dt);
              if (after > 0.6) ballVisible = false;
            } else {
              L.v.y += 1100 * dt;
              L.p = { x: L.p.x + L.v.x * dt, y: L.p.y + L.v.y * dt };
              if (k.result === "direk") L.r = Math.min(26, L.r + 14 * dt);
              const floor = k.result === "direk" ? GOAL_BOTTOM + 70 : GOAL_BOTTOM + 30;
              if (L.p.y > floor) {
                L.p.y = floor;
                L.v.y *= -0.45;
                L.v.x *= 0.7;
              }
            }
            ballPos = L.p;
            ballR = L.r;
            back = L.back;
            spin = after * L.spin;
            ballGround = { x: L.p.x, y: Math.max(L.p.y + L.r * 0.6, GOAL_BOTTOM + 4) };
          } else {
            // Ortadaki kurtarışta top eldivenlerde kalır.
            ballPos = gloves;
            ballR = BALL_FAR;
            ballGround = { x: ballPos.x, y: GOAL_BOTTOM + 4 };
          }
          if (!anim.bannered && tau > CONTACT + 0.16) {
            anim.bannered = true;
            const color = k.result === "gol" ? teamsRef.current[k.side].base : k.result === "kurtardi" ? "var(--color-kehribar)" : "var(--color-cream)";
            bannerText!.textContent = { gol: "GOL!", kurtardi: "KURTARDI!", direk: "DİREK!", aut: "AUT!" }[k.result];
            bannerText!.setAttribute("fill", color);
            st.banner = { start: performance.now() };
          }
        }
        if (!anim.doneCalled && tau > DONE_AT) {
          anim.doneCalled = true;
          handlers.current.onKickDone(anim.index);
        }
      }
      ball?.setAttribute("opacity", ballVisible && !back ? "1" : "0");
      ballBack?.setAttribute("opacity", ballVisible && back ? "1" : "0");
      const ballTransform = `translate(${fmt(ballPos)}) scale(${ballR.toFixed(2)})`;
      ball?.setAttribute("transform", ballTransform);
      ballBack?.setAttribute("transform", ballTransform);
      ballSpins.forEach((el) => el.setAttribute("transform", `rotate(${spin.toFixed(0)})`));
      ballShadow?.setAttribute("cx", ballGround.x.toFixed(1));
      ballShadow?.setAttribute("cy", ballGround.y.toFixed(1));
      ballShadow?.setAttribute("rx", (ballR * 1.05).toFixed(1));
      ballShadow?.setAttribute("ry", (ballR * 0.28).toFixed(1));
      ballShadow?.setAttribute("opacity", ballVisible ? clamp01(1 - (ballGround.y - ballPos.y) / 260).toFixed(2) : "0");

      // -- ağ esnemesi --
      if (st.bulge) {
        const b = st.bulge;
        const k = time - b.start;
        const env = quiet ? 0 : Math.sin(Math.min(1, k / 0.12) * (Math.PI / 2)) * Math.exp(-2.6 * Math.max(0, k - 0.12));
        const pts = grid.map((row) =>
          row.map((p) => {
            const dx = p.x - b.at.x;
            const dy = p.y - b.at.y;
            const d = Math.hypot(dx, dy);
            const f = Math.exp(-(d * d) / (2 * 70 * 70)) * 30 * env;
            return { x: p.x + (d > 0 ? (dx / d) * f * 0.6 : 0), y: p.y + (d > 0 ? (dy / d) * f * 0.6 : 0) + f * 0.5 };
          }),
        );
        netRows.forEach((el, r) => el.setAttribute("d", `M${pts[r].map((p) => fmt(p)).join(" L ")}`));
        netCols.forEach((el, c) => el.setAttribute("d", `M${pts.map((row) => fmt(row[c])).join(" L ")}`));
        if (k > 1.6) st.bulge = null;
      }

      // -- direk titremesi --
      if (st.postHit) {
        const k = (performance.now() - st.postHit.start) / 1000;
        const j = quiet ? 0 : Math.sin(k * 80) * 3 * Math.exp(-k * 6);
        posts?.setAttribute("transform", `translate(${j.toFixed(2)} 0)`);
        if (k > 1) st.postHit = null;
      }

      // -- şutçular --
      ([0, 1] as const).forEach((side) => {
        const ks = st.kicker[side];
        let pos = { ...KICKER_HOME[side] };
        let kickFoot: Vec = { x: 18, y: 0 };
        let supportFoot: Vec = { x: -18, y: 0 };
        let hands: [Vec, Vec] = HANDS_REST;
        let hop = 0;
        let tilt = 0;
        const shooting = inp.shooter === side && (inp.phase === "kick" || inp.phase === "result" || (inp.phase === "finished" && !!anim));
        if (shooting) {
          const walk = inp.kickStart !== null ? clamp01((wall - inp.kickStart) / 900) : 1;
          pos = mix(KICKER_HOME[side], KICKER_READY, easeInOut(walk));
          if (walk < 1 && !quiet) {
            const ph = walk * Math.PI * 6;
            kickFoot = { x: 18, y: -Math.max(0, Math.sin(ph)) * 22 };
            supportFoot = { x: -18, y: -Math.max(0, -Math.sin(ph)) * 22 };
            hop = Math.abs(Math.sin(ph)) * 6;
          }
          if (anim && anim.kick.side === side) {
            const run = clamp01(tau / STRIKE);
            pos = mix(KICKER_READY, KICKER_STRIKE, easeInOut(run));
            if (tau < STRIKE - 0.1) {
              const ph = run * Math.PI * 3;
              kickFoot = { x: 18, y: -Math.max(0, Math.sin(ph)) * 26 };
              supportFoot = { x: -18, y: -Math.max(0, -Math.sin(ph)) * 26 };
              hands = [{ x: -54, y: -130 + Math.sin(ph) * 20 }, { x: 54, y: -130 - Math.sin(ph) * 20 }];
            } else if (tau < STRIKE) {
              const k = (tau - (STRIKE - 0.1)) / 0.1;
              kickFoot = mix({ x: 18, y: 0 }, { x: 30, y: -74 }, k);
              hands = [{ x: -78, y: -170 }, { x: 40, y: -120 }];
            } else if (tau < STRIKE + 0.5) {
              const k = clamp01((tau - STRIKE) / 0.18);
              const back = clamp01((tau - STRIKE - 0.22) / 0.28);
              kickFoot = back > 0 ? mix({ x: 12, y: -118 }, { x: 18, y: 0 }, easeInOut(back)) : mix({ x: 26, y: -40 }, { x: 12, y: -118 }, easeOut(k));
              hands = [{ x: -80, y: -175 }, { x: 46, y: -128 }];
            }
          }
        }
        // Tepkiler
        const decided = anim && tau > CONTACT + 0.12;
        let mood: Mood = "calm";
        if (inp.phase === "question" && inp.locked[side]) mood = "dismay";
        if (inp.phase === "reveal") mood = "dismay";
        if (decided && anim) {
          const goal = anim.kick.result === "gol";
          mood = anim.kick.side === side ? (goal ? "cheer" : "dismay") : goal ? "dismay" : "cheer";
        }
        if (inp.phase === "finished" && st.finale && (!anim || decided)) {
          mood = inp.winner === "draw" ? "shrug" : inp.winner === side ? "cheer" : "dismay";
        }
        if (mood === "cheer") {
          hands = HANDS_UP;
          if (!quiet) hop = Math.abs(Math.sin(time * 7 + side)) * 34;
          kickFoot = { x: 22, y: -hop * 0.4 };
          supportFoot = { x: -22, y: -hop * 0.4 };
        } else if (mood === "dismay") {
          hands = HANDS_HEAD;
          tilt = side === 0 ? -8 : 8;
        } else if (mood === "shrug") {
          hands = [{ x: -84, y: -170 }, { x: 84, y: -170 }];
        }
        // Şutu çeken oyuncu yeni soruda yürüyerek yerine döner.
        if (!shooting) pos = quiet ? pos : mix(ks.pos, pos, 1 - Math.exp(-realDt * 3.5));
        ks.pos = pos;
        drawKicker(side, pos, { kickFoot, supportFoot, hands, hop, headTilt: tilt });
      });

      // -- tribün ve panolar --
      const cel = st.celebrate;
      const finWinner = inp.phase === "finished" && (inp.winner === 0 || inp.winner === 1) ? inp.winner : null;
      crowd.forEach((g) => {
        const side = Number(g.getAttribute("data-crowd"));
        const row = Number(g.getAttribute("data-row"));
        const active = (cel && cel.side === side && time - cel.start < 3) || finWinner === side;
        const y = active && !quiet ? -Math.abs(Math.sin(time * 8 + row * 0.7 + side)) * (6 + row * 1.2) : 0;
        g.setAttribute("transform", `translate(0 ${y.toFixed(1)})`);
      });
      const glowSide = cel && time - cel.start < 2.2 ? cel.side : finWinner;
      if (glowSide !== null && glowSide !== undefined) {
        ledGlow?.setAttribute("fill", teamsRef.current[glowSide].base);
        ledGlow?.setAttribute("opacity", quiet ? "0.5" : (0.25 + 0.45 * Math.abs(Math.sin(time * 9))).toFixed(2));
      } else ledGlow?.setAttribute("opacity", "0");

      // -- kurtarış yıldızı --
      if (st.starAt) {
        const k = (performance.now() - st.starAt.start) / 1000;
        const s = quiet ? 1 : Math.sin(Math.min(1, k / 0.5) * Math.PI) * 1.3;
        star?.setAttribute("transform", `translate(${fmt(st.starAt.p)}) scale(${Math.max(0.01, s).toFixed(3)}) rotate(${(k * 90).toFixed(0)})`);
        star?.setAttribute("opacity", clamp01(1 - k / 0.9).toFixed(2));
        flash?.setAttribute("cx", st.starAt.p.x.toFixed(1));
        flash?.setAttribute("cy", st.starAt.p.y.toFixed(1));
        flash?.setAttribute("r", (20 + 220 * easeOut(clamp01(k / 0.6))).toFixed(1));
        flash?.setAttribute("opacity", quiet ? "0" : clamp01(1 - k / 0.6).toFixed(2));
        if (k > 1) st.starAt = null;
      } else {
        star?.setAttribute("opacity", "0");
        flash?.setAttribute("opacity", "0");
      }

      // -- büyük yazı --
      if (st.banner) {
        const k = (performance.now() - st.banner.start) / 1000;
        const s = quiet ? 1 : 1 - Math.exp(-10 * k) * Math.cos(14 * k);
        // Yazı sahada, kale ile şutçunun arasında: ne skor tabelasının ne kalenin üstüne biner.
        banner?.setAttribute("transform", `translate(${GOAL_CX} 790) scale(${Math.max(0.01, s).toFixed(3)})`);
        banner?.setAttribute("opacity", clamp01((2.6 - k) / 0.4).toFixed(2));
        if (k > 2.6) st.banner = null;
      } else banner?.setAttribute("opacity", "0");

      // -- nişan --
      if (st.aiming && canAim()) {
        const p = st.aiming.p;
        const g = toGoal(p);
        const place = classify(g.x, g.y);
        aim?.setAttribute("opacity", "1");
        const mid = { x: (SPOT.x + p.x) / 2, y: Math.min(SPOT.y, p.y) - 60 };
        aimLine?.setAttribute("d", `M${fmt(SPOT)}Q${fmt(mid)} ${fmt(p)}`);
        aimTarget?.setAttribute("transform", `translate(${fmt(p)})`);
        aimRing?.setAttribute("stroke", place === "aut" ? "var(--color-ink-400)" : teamsRef.current[inp.shooter ?? 0].base);
      } else aim?.setAttribute("opacity", "0");

      // -- toz --
      for (let j = dust.length - 1; j >= 0; j--) {
        const d = dust[j];
        d.life += dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.r += 20 * dt;
        if (d.life > d.max) dust.splice(j, 1);
      }
      dustEls.forEach((el, i) => {
        const d = dust[i];
        if (!d) return el.setAttribute("opacity", "0");
        el.setAttribute("cx", d.x.toFixed(1));
        el.setAttribute("cy", d.y.toFixed(1));
        el.setAttribute("r", d.r.toFixed(1));
        el.setAttribute("opacity", (0.5 * (1 - d.life / d.max)).toFixed(2));
      });

      // -- bitiş --
      if (inp.phase === "finished" && !st.finale && (!anim || tau > DONE_AT - 0.5)) {
        st.finale = { start: time, called: false, confetti: false };
      }
      const fin = st.finale;
      if (fin) {
        const w = inp.winner;
        if (!fin.confetti && (w === 0 || w === 1)) {
          fin.confetti = true;
          if (!quiet) {
            const colors = [teamsRef.current[w].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor);
            confetti({ particleCount: 140, spread: 120, startVelocity: 52, origin: { x: w === 0 ? 0.25 : 0.75, y: 0.5 }, colors, disableForReducedMotion: true });
          }
          sfx.cheer();
        }
        if (!fin.called && time - fin.start > (w === "draw" ? 1.2 : 1.8)) {
          fin.called = true;
          handlers.current.onFinale();
        }
      }

      // -- kamera --
      let focus: Rect = inp.phase === "kick" || inp.phase === "result" || inp.phase === "finished" ? KICK_VIEW : QUESTION_VIEW;
      let rate = 3;
      // Kurtarış ve golde kamera temas noktasına yaklaşır (azaltılmış harekette yaklaşmaz).
      if (!quiet && anim && tau > CONTACT - 0.2 && tau < CONTACT + 0.55 && (anim.kick.result === "kurtardi" || anim.kick.result === "gol")) {
        const c = anim.target;
        focus = { x: c.x - 420, y: c.y - 250, w: 840, h: 500 };
        rate = 5;
      }
      const kk = quiet ? 1 : 1 - Math.exp(-realDt * rate);
      st.cam = { x: lerp(st.cam.x, focus.x, kk), y: lerp(st.cam.y, focus.y, kk), w: lerp(st.cam.w, focus.w, kk), h: lerp(st.cam.h, focus.h, kk) };
      const A = st.aspect;
      let vw = st.cam.w;
      let vh = st.cam.h;
      if (vw / vh > A) vh = vw / A;
      else vw = vh * A;
      if (vw > WORLD_RIGHT - WORLD_LEFT - 200) {
        vw = WORLD_RIGHT - WORLD_LEFT - 200;
        vh = vw / A;
      }
      let cx = st.cam.x + st.cam.w / 2;
      let cy = st.cam.y + st.cam.h / 2;
      if (cy + vh / 2 > 1080) cy = 1080 - vh / 2;
      cx = Math.max(WORLD_LEFT + 100 + vw / 2, Math.min(WORLD_RIGHT - 100 - vw / 2, cx));
      st.shake *= Math.exp(-realDt * 7);
      const sx = quiet ? 0 : Math.sin(now / 17) * st.shake;
      const sy = quiet ? 0 : Math.cos(now / 23) * st.shake * 0.6;
      svg.setAttribute("viewBox", `${(cx - vw / 2 + sx).toFixed(1)} ${(cy - vh / 2 + sy).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);

      raf = requestAnimationFrame(frame);
    };
    let raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onCancel);
    };
  }, []);

  const [left, right] = teams;
  const art = useMemo(
    () => (
      <SceneArt
        teams={[
          { base: left.base, deep: left.deep, emblem: left.emblem },
          { base: right.base, deep: right.deep, emblem: right.emblem },
        ]}
      />
    ),
    [left.base, left.deep, left.emblem, right.base, right.deep, right.emblem],
  );
  return (
    <svg
      ref={svgRef}
      viewBox={`${QUESTION_VIEW.x} ${QUESTION_VIEW.y} ${QUESTION_VIEW.w} ${QUESTION_VIEW.h}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full font-sans"
      style={{ touchAction: "none" }}
      aria-hidden
    >
      {art}
    </svg>
  );
}
