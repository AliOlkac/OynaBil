"use client";

import confetti from "canvas-confetti";
import { useEffect, useMemo, useRef } from "react";
import { cssColor } from "@/lib/color";
import { sfx } from "@/lib/sound";
import { fmt, type Vec } from "../../shared/skeleton";
import { AIM_LOCK_MS, sweepAt, ZONE_LABEL, type Ammo, type Shot, type SiegeState, type Zone } from "../logic";
import {
  ARM_COCKED,
  ARM_RELEASE,
  ARM_REST,
  armTip,
  BASE_HALF,
  BODY_HALF,
  CATAPULT_X,
  catapultToWorld,
  CRANK_R,
  dirOf,
  DRUM,
  flightAt,
  flightFor,
  GROUND,
  PILE,
  PIVOT,
  TOWER_X,
  Y_APEX,
  Y_BASE_TOP,
  Y_BODY_TOP,
  Y_PARAPET,
  Y_ROOF_BASE,
  Y_WINDOW_BOTTOM,
  Y_WINDOW_TOP,
  yOf,
  type Flight,
} from "./geometry";
import { BLOCK_COUNT, CHIP_COUNT, CLOUDS, CREW, CREW_SCALE, CREW_X, DamageRuler, DUST_COUNT, SceneArt, TRAIL_COUNT, type ArtTeam } from "./art";
import { solveCrew, type CrewPose } from "./crew";

/**
 * Kule Yıkmaca sahnesi.
 *
 * Oyun mantığından özet bir girdi alır (evre, atışlar, kule canları, rüzgâr) ve bütün hareketi tek bir
 * requestAnimationFrame döngüsünde çizer: mancınığın kurulması, taşın yüklenmesi, fırlatma, uçuş,
 * isabet, ekibin tepkileri, kamera ve kulenin yıkılışı. React her karede yeniden çizmez.
 * Atış anını sahne yönetir; isabet anında `onImpact`, bitiş gösterisi bitince `onFinale` çağrılır.
 */

export type SceneInput = {
  phase: SiegeState["phase"];
  turn: 0 | 1;
  shooter: 0 | 1 | null;
  /** Nişan evresinin başladığı an (Date.now). */
  aimStart: number | null;
  wind: number;
  ammo: Ammo;
  shots: Shot[];
  hp: [number, number];
  misfireAt: number | null;
  misfireSide: 0 | 1;
  winner: 0 | 1 | "draw" | null;
  endReason: "collapse" | "rounds" | null;
};

export type RulerSpec = { target: 0 | 1; values: { from: number; to: number; damage: number; crit: boolean }[] };

type Props = {
  input: SceneInput;
  teams: [ArtTeam, ArtTeam];
  ruler: RulerSpec;
  reducedMotion: boolean;
  onImpact: (index: number) => void;
  onFinale: () => void;
};

// ---- yardımcılar ----
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixV = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

type Rect = { x: number; y: number; w: number; h: number };
const OVERVIEW: Rect = { x: -30, y: 130, w: 1660, h: 690 };
const WIDE: Rect = { x: -30, y: 10, w: 1660, h: 810 };

type Particle = {
  kind: "dust" | "chip";
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  r: number;
  grow: number;
  rot: number;
  vr: number;
  sx: number;
  sy: number;
  color: string;
  alpha: number;
  floor: number | null;
};

type Block = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; settled: boolean; floor: number };

type CatMode = "rest" | "cock" | "fire" | "misfire";
type Cat = { mode: CatMode; start: number; angle: number; crank: number; recoil: number; recoilVel: number; loaded: boolean; fire: boolean; sounds: Set<string> };

type Reaction = { kind: "cheer" | "dismay" | "relief"; start: number; until: number };

type ActiveFlight = {
  index: number;
  shot: Pick<Shot, "side" | "hit" | "zone" | "ammo" | "damage">;
  flight: Flight;
  start: number;
  launched: boolean;
  impacted: boolean;
  /** Kuleye değmeyen taş yerde seker ve yuvarlanır. */
  roll: { x: number; y: number; vx: number; vy: number; until: number } | null;
  trail: Vec[];
  honor: boolean;
};

type TowerVis = {
  taken: number;
  windowBroken: boolean;
  merlons: boolean[];
  roofHits: number;
  baseHits: number;
  collapse: { start: number; landed: boolean[]; done: boolean } | null;
};

export function SiegeScene({ input, teams, ruler, reducedMotion, onImpact, onFinale }: Props) {
  const inputRef = useRef(input);
  const teamsRef = useRef(teams);
  const motionRef = useRef(reducedMotion);
  const handlers = useRef({ onImpact, onFinale });
  useEffect(() => {
    inputRef.current = input;
    teamsRef.current = teams;
    motionRef.current = reducedMotion;
    handlers.current = { onImpact, onFinale };
  });

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const q = <T extends Element>(sel: string, root: ParentNode = svg) => root.querySelector<T>(sel);
    const qa = <T extends Element>(sel: string, root: ParentNode = svg) => Array.from(root.querySelectorAll<T>(sel));

    // ---- öğeler ----
    const clouds = qa<SVGGElement>("[data-cloud]");
    const towers = ([0, 1] as const).map((s) => {
      const root = q<SVGGElement>(`[data-tower="${s}"]`)!;
      return {
        body: q<SVGGElement>('[data-part="tower-body"]', root),
        segs: qa<SVGGElement>("[data-seg]", root),
        merlons: qa<SVGGElement>("[data-merlon]", root),
        cracks: qa<SVGPathElement>("[data-crack]", root),
        shutters: q<SVGGElement>('[data-part="shutters"]', root),
        glow: q<SVGPathElement>('[data-part="glow"]', root),
        mullion: q<SVGPathElement>('[data-part="mullion"]', root),
        broken: q<SVGPathElement>('[data-part="broken"]', root),
        roof: q<SVGGElement>('[data-part="roof"]', root),
        roofHole: q<SVGPathElement>('[data-part="roof-hole"]', root),
        chips: q<SVGPathElement>('[data-part="chips"]', root),
        debris: q<SVGGElement>('[data-part="debris"]', root),
        rubble: q<SVGGElement>('[data-part="rubble"]', root),
        flag: q<SVGPathElement>('[data-part="flag-cloth"]', root),
      };
    });
    const cats = ([0, 1] as const).map((s) => {
      const root = q<SVGGElement>(`[data-catapult="${s}"]`)!;
      return {
        body: q<SVGGElement>('[data-part="cat-body"]', root),
        arm: q<SVGGElement>('[data-part="arm"]', root),
        loaded: q<SVGGElement>('[data-part="loaded"]', root),
        loadedFire: q<SVGGElement>('[data-part="loaded-fire"]', root),
        crank: q<SVGGElement>('[data-part="crank"]', root),
        rope: q<SVGPathElement>('[data-part="winch-rope"]', root),
        wheels: qa<SVGGElement>('[data-part="wheel"]', root),
        pennant: q<SVGPathElement>('[data-part="pennant"]', root),
      };
    });
    const crewEls = CREW.map((_, i) => {
      const root = q<SVGGElement>(`[data-crew="${i}"]`)!;
      const p = <T extends Element>(name: string) => q<T>(`[data-part="${name}"]`, root);
      return {
        root,
        farUpper: p<SVGPathElement>("farUpper"),
        farFore: p<SVGPathElement>("farFore"),
        farHand: p<SVGCircleElement>("farHand"),
        legBack: p<SVGPathElement>("legBack"),
        legFront: p<SVGPathElement>("legFront"),
        shoeBack: p<SVGEllipseElement>("shoeBack"),
        shoeFront: p<SVGEllipseElement>("shoeFront"),
        shorts: p<SVGCircleElement>("shorts"),
        torso: p<SVGPathElement>("torso"),
        stripe: p<SVGPathElement>("stripe"),
        head: p<SVGGElement>("head"),
        nearUpper: p<SVGPathElement>("nearUpper"),
        nearFore: p<SVGPathElement>("nearFore"),
        nearHand: p<SVGCircleElement>("nearHand"),
        held: p<SVGGElement>("held"),
        mouths: {
          grit: p<SVGGElement>("mouthGrit"),
          open: p<SVGEllipseElement>("mouthOpen"),
          smile: p<SVGPathElement>("mouthSmile"),
          calm: p<SVGPathElement>("mouthCalm"),
        },
      };
    });
    const shotEl = q<SVGGElement>('[data-part="shot"]');
    const shotFire = q<SVGGElement>('[data-part="shot-fire"]');
    const shotStone = q<SVGGElement>('[data-part="shot-stone"]');
    const shadow = q<SVGEllipseElement>('[data-part="shot-shadow"]');
    const trailEls = qa<SVGCircleElement>("[data-trail]");
    const dud = q<SVGGElement>('[data-part="dud"]');
    const blockEls = qa<SVGGElement>("[data-block]");
    const dustEls = qa<SVGCircleElement>("[data-dust]");
    const chipEls = qa<SVGPathElement>("[data-chip]");
    const ring = q<SVGCircleElement>('[data-part="ring"]');
    const crosshair = q<SVGGElement>('[data-part="crosshair"]');
    const aimLine = q<SVGLineElement>('[data-part="aim-line"]');
    const reticle = q<SVGGElement>('[data-part="reticle"]');
    const reticleRing = q<SVGCircleElement>('[data-part="reticle-ring"]');
    const popup = q<SVGGElement>('[data-part="popup"]');
    const popupValue = q<SVGTextElement>('[data-part="popup-value"]');
    const popupLabel = q<SVGTextElement>('[data-part="popup-label"]');

    // ---- sahne durumu ----
    const start = inputRef.current;
    const t0 = performance.now();
    const st = {
      aspect: svg.clientWidth / Math.max(1, svg.clientHeight) || 2,
      cam: { ...(start.phase === "aim" || start.phase === "shot" || start.phase === "finished" ? WIDE : OVERVIEW) } as Rect,
      shake: 0,
      punch: null as null | { x: number; y: number; until: number },
      seenShots: start.shots.length,
      seenAim: start.aimStart,
      seenMisfire: start.misfireAt,
      cloudX: CLOUDS.map((c) => c.x),
      flight: null as ActiveFlight | null,
      dud: null as null | { x: number; y: number; vx: number; vy: number; rot: number; start: number },
      popup: null as null | { start: number; x: number; y: number },
      ring: null as null | { start: number; x: number; y: number },
      reactions: [null, null] as (Reaction | null)[],
      finale: null as null | { start: number; called: boolean; honor: boolean; confetti: boolean; fired: boolean },
      lastFrame: t0,
    };
    const cat: Cat[] = [0, 1].map(() => ({ mode: "rest", start: 0, angle: ARM_REST, crank: 0, recoil: 0, recoilVel: 0, loaded: false, fire: false, sounds: new Set() }));
    const vis: TowerVis[] = [0, 1].map(() => ({ taken: 0, windowBroken: false, merlons: [true, true, true, true, true], roofHits: 0, baseHits: 0, collapse: null }));
    const pose: CrewPose[] = CREW.map(() => ({ lean: 0.04, crouch: 0, near: { x: 10, y: -42 }, far: { x: -4, y: -44 }, armsUp: 0, cover: 0 }));
    const particles: Particle[] = [];
    const blocks: (Block | null)[] = Array.from({ length: BLOCK_COUNT }, () => null);

    const calm = () => motionRef.current;
    const emit = (p: Partial<Particle> & Pick<Particle, "kind" | "x" | "y">) => {
      if (calm()) return;
      const pool = particles.filter((x) => x.kind === p.kind).length;
      if (pool >= (p.kind === "dust" ? DUST_COUNT : CHIP_COUNT)) {
        const i = particles.findIndex((x) => x.kind === p.kind);
        if (i >= 0) particles.splice(i, 1);
      }
      particles.push({ vx: 0, vy: 0, g: 0, life: 0, max: 1, r: 8, grow: 0, rot: 0, vr: 0, sx: 1, sy: 1, color: "var(--color-toz)", alpha: 0.7, floor: null, ...p });
    };
    const dustPuff = (x: number, y: number, n: number, spread = 40, color = "var(--color-toz)") => {
      for (let i = 0; i < n; i++) {
        emit({ kind: "dust", x: x + rnd(-spread, spread), y: y + rnd(-10, 6), vx: rnd(-60, 60), vy: rnd(-70, -10), r: rnd(10, 22), grow: rnd(16, 34), max: rnd(0.8, 1.4), alpha: 0.55, color });
      }
    };
    const chipsBurst = (x: number, y: number, n: number, away: number, colors: string[], floor = GROUND + 6, thin = false) => {
      for (let i = 0; i < n; i++) {
        emit({
          kind: "chip",
          x: x + rnd(-8, 8),
          y: y + rnd(-8, 8),
          vx: away * rnd(60, 340),
          vy: rnd(-420, -60),
          g: 1300,
          r: 1,
          rot: rnd(0, 360),
          vr: rnd(-720, 720),
          sx: thin ? rnd(2, 2.8) : rnd(0.9, 2),
          sy: thin ? rnd(0.35, 0.5) : rnd(0.9, 2),
          max: rnd(1.1, 1.8),
          color: colors[i % colors.length],
          alpha: 1,
          floor,
        });
      }
    };
    const dropBlock = (x: number, y: number, vx: number, vy: number, vr: number) => {
      if (calm()) return;
      const i = blocks.findIndex((b) => b === null);
      const slot = i >= 0 ? i : 0;
      blocks[slot] = { x, y, vx, vy, rot: 0, vr, life: 0, settled: false, floor: GROUND - 6 + rnd(-4, 10) };
    };

    /** Hedef kulenin yerel x'ini dünyaya çevirir (sağdaki kule aynalıdır). */
    const towerWorldX = (side: 0 | 1, lx: number) => TOWER_X[side] + (side === 1 ? -lx : lx);

    // ---- hasarın kuleye işlenmesi ----
    const MERLON_X = [-78, -39, 0, 39, 78];
    const LOSS_ORDER = [4, 3, 2, 1, 0];
    function applyHit(target: 0 | 1, zone: Zone, damage: number, animated: boolean, from: 0 | 1) {
      const v = vis[target];
      v.taken = Math.min(100, v.taken + damage);
      const away = dirOf(from);
      if (zone === "pencere") {
        v.windowBroken = true;
        if (animated) {
          const wx = towerWorldX(target, 0);
          const wy = (Y_WINDOW_BOTTOM + Y_WINDOW_TOP) / 2;
          const t = teamsRef.current[target];
          chipsBurst(wx, wy, 14, away, [t.deep, t.base, "var(--color-ahsap)"], GROUND + 6, true);
          chipsBurst(wx, wy, 8, away, ["var(--color-kehribar)", "var(--color-ufuk-acik)"], GROUND + 6);
        }
      } else if (zone === "burc") {
        const lose = LOSS_ORDER.filter((k) => v.merlons[k]).slice(0, 2);
        for (const k of lose) {
          v.merlons[k] = false;
          if (animated) dropBlock(towerWorldX(target, MERLON_X[k]), Y_PARAPET - 22, away * rnd(90, 220), rnd(-260, -120), away * rnd(160, 420));
        }
      } else if (zone === "kulah") {
        v.roofHits++;
        if (animated) {
          const t = teamsRef.current[target];
          chipsBurst(towerWorldX(target, 40), Y_ROOF_BASE - 20, 16, away, [t.deep, t.base], GROUND + 6);
        }
      } else if (zone === "temel") {
        v.baseHits++;
      }
    }

    /** Kulenin hasar görüntüsü: çatlaklar, kırık pencere, düşen mazgallar, eğilen külah, moloz. */
    function paintTower(side: 0 | 1) {
      const v = vis[side];
      const els = towers[side];
      const CRACK_AT = [15, 30, 45, 58, 70, 82];
      // Çatlaklar kule gövdesinin üstünde durur; yıkılışta parçalarla birlikte kaybolur.
      els.cracks.forEach((el, k) => el.setAttribute("opacity", v.taken >= CRACK_AT[k] && !v.collapse ? "0.9" : "0"));
      els.shutters?.setAttribute("opacity", v.windowBroken ? "0" : "1");
      els.glow?.setAttribute("opacity", v.windowBroken ? "0" : "1");
      els.mullion?.setAttribute("opacity", v.windowBroken ? "0" : "1");
      els.broken?.setAttribute("opacity", v.windowBroken ? "1" : "0");
      els.merlons.forEach((el, k) => el.setAttribute("opacity", v.merlons[k] ? "1" : "0"));
      els.roofHole?.setAttribute("opacity", v.roofHits > 0 ? "1" : "0");
      els.roof?.setAttribute("transform", `rotate(${(-Math.min(2, v.roofHits) * 6).toFixed(1)} 0 ${Y_ROOF_BASE})`);
      els.chips?.setAttribute("opacity", v.baseHits > 0 ? "1" : "0");
      els.debris?.setAttribute("opacity", Math.min(1, v.taken / 50).toFixed(2));
    }

    // Açılışta mevcut atışlar animasyonsuz işlenir.
    for (const s of start.shots) applyHit((1 - s.side) as 0 | 1, s.zone, s.damage, false, s.side);
    const winnerSide = start.winner;
    if (start.phase === "finished" && (winnerSide === 0 || winnerSide === 1)) {
      const loser = (1 - winnerSide) as 0 | 1;
      vis[loser].collapse = { start: t0 - 10_000, landed: [true, true, true, true, true, true], done: true };
      st.finale = { start: t0 - 10_000, called: false, honor: false, confetti: true, fired: true };
    } else if (start.phase === "finished") {
      st.finale = { start: t0 - 10_000, called: false, honor: false, confetti: true, fired: true };
    }
    ([0, 1] as const).forEach(paintTower);

    const ro = new ResizeObserver(() => {
      st.aspect = svg.clientWidth / Math.max(1, svg.clientHeight) || st.aspect;
    });
    ro.observe(svg);

    // ---- yıkılış ----
    function startCollapse(side: 0 | 1, at: number) {
      if (vis[side].collapse) return;
      vis[side].collapse = { start: at, landed: [false, false, false, false, false, false], done: false };
      sfx.collapse();
    }

    // ---- atış başlatma ----
    function launch(shot: ActiveFlight["shot"], index: number, now: number, honor = false) {
      const c = cat[shot.side];
      c.mode = "fire";
      c.start = now;
      c.loaded = true;
      c.fire = shot.ammo === "ates";
      c.sounds = new Set();
      st.flight = { index, shot, flight: flightFor(shot), start: now, launched: false, impacted: false, roll: null, trail: [], honor };
    }

    function impact(f: ActiveFlight, now: number) {
      f.impacted = true;
      const { shot, flight } = f;
      const target = (1 - shot.side) as 0 | 1;
      const p = flight.to;
      const away = dirOf(shot.side);
      const crit = shot.zone === "pencere";
      if (flight.end === "tower") {
        applyHit(target, shot.zone, shot.damage, true, shot.side);
        chipsBurst(p.x, p.y, 12 + Math.round(shot.damage / 3), -away, ["var(--color-tas)", "var(--color-tas-koyu)", "var(--color-tas-acik)"]);
        dustPuff(p.x, p.y, 8, 20);
        if (shot.ammo === "ates") chipsBurst(p.x, p.y, 10, -away, ["var(--color-ates)", "var(--color-kehribar)"]);
        st.shake = crit ? 26 : 8 + shot.damage * 0.4;
        st.punch = { x: p.x - away * 120, y: p.y, until: now + 1100 };
        if (crit) {
          st.ring = { start: now, x: p.x, y: p.y };
          sfx.crit();
        } else sfx.hit(shot.damage);
      } else {
        dustPuff(p.x, GROUND + 4, 12, 30);
        chipsBurst(p.x, GROUND, 6, away, ["var(--color-camur)", "var(--color-toz)"]);
        f.roll = { x: p.x, y: GROUND - 6, vx: away * 260, vy: -220, until: now + 2600 };
        st.shake = 4;
        sfx.miss();
      }
      if (!f.honor) {
        const value = shot.damage > 0 ? `−${shot.damage}` : "Iska!";
        popupValue!.textContent = value;
        popupValue!.setAttribute("fill", crit ? "var(--color-kehribar)" : shot.damage > 0 ? "var(--color-cream)" : "var(--color-ink-300)");
        popupLabel!.textContent = crit ? "KRİTİK! Pencere" : ZONE_LABEL[shot.zone];
        const py = flight.end === "tower" ? Math.min(p.y - 90, GROUND - 160) : GROUND - 160;
        st.popup = { start: now, x: p.x - away * 150, y: py };
      }
      // Ekipler: atan takım isabette sevinir, ıskada üzülür; hedef takım tersini yapar.
      const hitIt = shot.damage > 0;
      st.reactions[shot.side] = { kind: hitIt ? "cheer" : "dismay", start: now, until: now + (crit ? 2200 : 1600) };
      st.reactions[target] = { kind: hitIt ? "dismay" : "relief", start: now, until: now + 1600 };
      if (!f.honor) handlers.current.onImpact(f.index);
      const hpLeft = f.honor ? 0 : inputRef.current.hp[target];
      if (hpLeft <= 0) startCollapse(target, now + 350);
    }

    // ---- kare döngüsü ----
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - st.lastFrame) / 1000);
      st.lastFrame = t;
      const time = (t - t0) / 1000;
      const inp = inputRef.current;
      const quiet = calm();
      const wallNow = Date.now();

      // -- olaylar --
      if (inp.phase === "aim" && inp.shooter !== null && inp.aimStart !== null && inp.aimStart !== st.seenAim) {
        st.seenAim = inp.aimStart;
        const c = cat[inp.shooter];
        c.mode = "cock";
        c.start = t - Math.max(0, wallNow - inp.aimStart);
        c.loaded = false;
        c.fire = inp.ammo === "ates";
        c.sounds = new Set();
      }
      if (inp.shots.length > st.seenShots) {
        for (let i = st.seenShots; i < inp.shots.length - 1; i++) {
          const s = inp.shots[i];
          applyHit((1 - s.side) as 0 | 1, s.zone, s.damage, false, s.side);
          handlers.current.onImpact(i);
        }
        const i = inp.shots.length - 1;
        st.seenShots = inp.shots.length;
        launch(inp.shots[i], i, t);
      }
      if (inp.misfireAt !== null && inp.misfireAt !== st.seenMisfire) {
        st.seenMisfire = inp.misfireAt;
        const c = cat[inp.misfireSide];
        c.mode = "misfire";
        c.start = t;
        c.loaded = true;
        c.fire = false;
        c.sounds = new Set();
        st.reactions[inp.misfireSide] = { kind: "dismay", start: t + 450, until: t + 2000 };
        st.reactions[(1 - inp.misfireSide) as 0 | 1] = { kind: "relief", start: t + 450, until: t + 1800 };
      }
      // Bitiş: tur sonunda kazanan takım şeref atışıyla karşı kuleyi yıkar; berabere ise kuleler ayakta kalır.
      if (inp.phase === "finished" && !st.finale && (!st.flight || st.flight.impacted)) {
        const w = inp.winner;
        if (inp.endReason === "rounds" && (w === 0 || w === 1)) {
          st.finale = { start: t, called: false, honor: true, confetti: false, fired: false };
          const c = cat[w];
          c.mode = "cock";
          c.start = t - 300;
          c.fire = true;
          c.sounds = new Set();
        } else {
          st.finale = { start: t, called: false, honor: false, confetti: false, fired: true };
        }
      }

      // -- şeref atışı: kurulduktan sonra ateşlenir --
      const fin = st.finale;
      if (fin?.honor && !fin.fired && !st.flight && (inp.winner === 0 || inp.winner === 1) && t - fin.start > AIM_LOCK_MS + 300) {
        fin.fired = true;
        launch({ side: inp.winner, hit: 0.43, zone: "pencere", ammo: "ates", damage: 0 }, -1, t, true);
      }

      // -- mancınıklar --
      ([0, 1] as const).forEach((side) => {
        const c = cat[side];
        const e = t - c.start;
        if (c.mode === "cock") {
          const k = clamp01(e / 650);
          c.angle = lerp(ARM_REST, ARM_COCKED, easeInOut(k));
          c.crank = k * Math.PI * 4;
          if (!c.sounds.has("crank") && e < 400) {
            c.sounds.add("crank");
            sfx.crank();
          }
          if (e >= 1050 && !c.loaded) {
            c.loaded = true;
            if (!c.sounds.has("load") && e < 1500) {
              c.sounds.add("load");
              sfx.load();
              if (c.fire) sfx.ignite();
            }
          }
        } else if (c.mode === "fire") {
          const sec = e / 1000;
          if (sec < 0.12) c.angle = ARM_COCKED - (ARM_COCKED - ARM_REST) * easeIn(sec / 0.12);
          else c.angle = ARM_REST + 9 * Math.exp(-7 * (sec - 0.12)) * Math.abs(Math.sin(24 * (sec - 0.12)));
          if (c.angle <= ARM_RELEASE && c.loaded) {
            c.loaded = false;
            c.recoilVel = -260;
            if (!quiet) dustPuff(catapultToWorld(side, { x: -60, y: 0 }).x, GROUND, 5, 50);
            sfx.launch();
          }
          if (sec > 1.5) c.mode = "rest";
        } else if (c.mode === "misfire") {
          const sec = e / 1000;
          if (sec < 0.35) c.angle = lerp(ARM_REST, 122, easeOut(sec / 0.35));
          else if (sec < 0.45) c.angle = lerp(122, ARM_REST - 2, easeIn((sec - 0.35) / 0.1));
          else c.angle = ARM_REST + 6 * Math.exp(-6 * (sec - 0.45)) * Math.abs(Math.sin(20 * (sec - 0.45)));
          c.crank = clamp01(sec / 0.35) * Math.PI * 1.6;
          if (sec >= 0.4 && c.loaded) {
            c.loaded = false;
            const tip = catapultToWorld(side, armTip(c.angle));
            st.dud = { x: tip.x, y: tip.y, vx: dirOf(side) * 120, vy: -240, rot: 0, start: t };
            if (!quiet) dustPuff(catapultToWorld(side, DRUM).x, GROUND - 50, 6, 14, "var(--color-ink-300)");
            sfx.misfire();
          }
          if (sec > 2) c.mode = "rest";
        } else {
          c.angle += (ARM_REST - c.angle) * Math.min(1, dt * 6);
          c.crank *= Math.exp(-dt * 2);
        }
        c.recoilVel += (-140 * c.recoil - 13 * c.recoilVel) * dt;
        c.recoil += c.recoilVel * dt;

        const els = cats[side];
        els.body?.setAttribute("transform", `translate(${c.recoil.toFixed(2)} 0)`);
        els.arm?.setAttribute("transform", `translate(${PIVOT.x} ${PIVOT.y}) rotate(${(-c.angle).toFixed(2)})`);
        els.loaded?.setAttribute("opacity", c.loaded ? "1" : "0");
        els.loadedFire?.setAttribute("opacity", c.loaded && c.fire ? String(0.75 + 0.25 * Math.sin(time * 30)) : "0");
        els.crank?.setAttribute("transform", `translate(${DRUM.x} ${DRUM.y}) rotate(${((c.crank * 180) / Math.PI).toFixed(1)})`);
        const attach = armTip(c.angle, 52);
        els.rope?.setAttribute("d", `M${DRUM.x} ${DRUM.y - 8} Q ${((DRUM.x + attach.x) / 2).toFixed(1)} ${((DRUM.y + attach.y) / 2 + 6).toFixed(1)} ${fmt(attach)}`);
        els.wheels.forEach((w, k) => w.setAttribute("transform", `translate(${k === 0 ? -62 : 56} -24) rotate(${((c.recoil / 24) * 57.3).toFixed(1)})`));
      });

      // -- uçuş --
      const f = st.flight;
      let shotPos: Vec | null = null;
      if (f) {
        const sec = (t - f.start) / 1000 - 0.109;
        const dir = dirOf(f.shot.side);
        if (sec >= 0 && !f.launched) {
          f.launched = true;
          sfx.whoosh(f.flight.duration);
        }
        if (sec >= 0 && !f.impacted) {
          const u = sec / f.flight.duration;
          if (u >= 1) impact(f, t);
          else {
            shotPos = flightAt(f.flight, u);
            const ahead = flightAt(f.flight, Math.min(1, u + 0.02));
            const ang = Math.atan2(ahead.y - shotPos.y, ahead.x - shotPos.x);
            shotFire?.setAttribute("transform", `rotate(${((ang * 180) / Math.PI).toFixed(1)})`);
            shotStone?.setAttribute("transform", `rotate(${(sec * 720 * dir).toFixed(1)})`);
            f.trail.unshift(shotPos);
            if (f.trail.length > TRAIL_COUNT * 2) f.trail.length = TRAIL_COUNT * 2;
            if (f.shot.ammo === "ates" && !quiet && Math.random() < 0.6) {
              emit({ kind: "dust", x: shotPos.x, y: shotPos.y, vx: rnd(-20, 20), vy: rnd(-40, 0), r: rnd(4, 8), grow: -4, max: 0.4, alpha: 0.9, color: Math.random() < 0.5 ? "var(--color-ates)" : "var(--color-kehribar)" });
            }
          }
        }
        if (f.roll) {
          const r = f.roll;
          r.vy += 1400 * dt;
          r.x += r.vx * dt;
          r.y += r.vy * dt;
          if (r.y > GROUND - 6) {
            r.y = GROUND - 6;
            r.vy *= -0.32;
            r.vx *= 0.7;
          }
          shotPos = { x: r.x, y: r.y };
          shotStone?.setAttribute("transform", `rotate(${((r.x / 16) * 57.3).toFixed(1)})`);
          if (t > r.until) f.roll = null;
        }
        if (f.impacted && !f.roll && t - f.start > 2600) st.flight = null;
      }
      const showShot = shotPos !== null;
      shotEl?.setAttribute("opacity", showShot ? (f?.roll ? String(clamp01((f.roll.until - t) / 600)) : "1") : "0");
      if (shotPos) {
        shotEl?.setAttribute("transform", `translate(${fmt(shotPos)})`);
        shotFire?.setAttribute("opacity", f?.shot.ammo === "ates" && !f.impacted ? "1" : "0");
        const height = Math.max(0, GROUND - shotPos.y);
        shadow?.setAttribute("cx", shotPos.x.toFixed(1));
        shadow?.setAttribute("cy", String(GROUND + 10));
        shadow?.setAttribute("rx", (20 - Math.min(12, height * 0.02)).toFixed(1));
        shadow?.setAttribute("opacity", clamp01(1 - height / 700).toFixed(2));
      } else shadow?.setAttribute("opacity", "0");
      trailEls.forEach((el, i) => {
        const p = f && !f.impacted ? f.trail[i * 2] : undefined;
        if (!p || quiet) return el.setAttribute("opacity", "0");
        el.setAttribute("cx", p.x.toFixed(1));
        el.setAttribute("cy", p.y.toFixed(1));
        el.setAttribute("r", (13 - i * 1.4).toFixed(1));
        el.setAttribute("fill", f!.shot.ammo === "ates" ? "var(--color-ates)" : "var(--color-cream)");
        el.setAttribute("opacity", ((f!.shot.ammo === "ates" ? 0.5 : 0.22) * (1 - i / TRAIL_COUNT)).toFixed(2));
      });

      // -- tutukluk taşı --
      if (st.dud) {
        const d = st.dud;
        d.vy += 1400 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.rot += d.vx * dt * 3;
        if (d.y > GROUND - 8) {
          d.y = GROUND - 8;
          d.vy *= -0.3;
          d.vx *= 0.6;
        }
        const age = (t - d.start) / 1000;
        dud?.setAttribute("transform", `translate(${fmt(d)}) rotate(${d.rot.toFixed(1)})`);
        dud?.setAttribute("opacity", String(clamp01((3.2 - age) / 0.6)));
        if (age > 3.2) st.dud = null;
      } else dud?.setAttribute("opacity", "0");

      // -- nişangâh ve cetvel --
      const aiming = inp.phase === "aim" && inp.shooter !== null && inp.aimStart !== null;
      const aimElapsed = aiming ? wallNow - inp.aimStart! : 0;
      const live = aiming && aimElapsed >= AIM_LOCK_MS;
      if (live) {
        const shooter = inp.shooter!;
        const target = (1 - shooter) as 0 | 1;
        const d = dirOf(shooter);
        const p = sweepAt(aimElapsed);
        const y = yOf(p);
        const face = TOWER_X[target] - d * BODY_HALF;
        const appear = clamp01((aimElapsed - AIM_LOCK_MS) / 250);
        crosshair?.setAttribute("opacity", appear.toFixed(2));
        aimLine?.setAttribute("x1", (face - d * 30).toFixed(1));
        aimLine?.setAttribute("x2", (TOWER_X[target] + d * (BASE_HALF + 30)).toFixed(1));
        aimLine?.setAttribute("y1", y.toFixed(1));
        aimLine?.setAttribute("y2", y.toFixed(1));
        reticle?.setAttribute("transform", `translate(${face.toFixed(1)} ${y.toFixed(1)}) scale(${(0.6 + 0.4 * easeOut(appear)).toFixed(3)}) rotate(${(time * 40).toFixed(1)})`);
        reticleRing?.setAttribute("stroke", teamsRef.current[shooter].base);
        rulerEl()?.setAttribute("opacity", appear.toFixed(2));
      } else {
        crosshair?.setAttribute("opacity", "0");
        rulerEl()?.setAttribute("opacity", "0");
      }

      // -- yıkılış --
      ([0, 1] as const).forEach((side) => {
        const v = vis[side];
        const els = towers[side];
        const col = v.collapse;
        let lean = v.taken >= 70 && !col ? -((v.taken - 70) / 30) * 1.6 : 0;
        if (!col || t < col.start) {
          els.body?.setAttribute("transform", `rotate(${lean.toFixed(2)} 0 ${GROUND})`);
          els.rubble?.setAttribute("transform", `translate(0 ${GROUND}) scale(1 0)`);
          return;
        }
        const tau = (t - col.start) / 1000;
        const pile = easeOut(clamp01((tau - 0.5) / 0.9));
        els.rubble?.setAttribute("transform", `translate(0 ${GROUND}) scale(1 ${(col.done ? 1 : pile).toFixed(3)})`);
        if (col.done || quiet) {
          const fade = col.done ? 0 : clamp01(1 - tau / 0.6);
          els.segs.forEach((s) => s.setAttribute("opacity", fade.toFixed(2)));
          els.body?.setAttribute("transform", "");
          if (tau > 1.6) col.done = true;
          return;
        }
        const jitter = tau < 0.4 ? Math.sin(tau * 90) * 4 : 0;
        lean = tau < 0.4 ? 0 : -Math.min(14, (tau - 0.4) * 30);
        els.body?.setAttribute("transform", `translate(${jitter.toFixed(1)} 0) rotate(${lean.toFixed(2)} 0 ${GROUND})`);
        const tops = [Y_BASE_TOP, Y_WINDOW_BOTTOM, Y_WINDOW_TOP, Y_BODY_TOP, Y_ROOF_BASE, Y_APEX];
        const bottoms = [GROUND, Y_BASE_TOP, Y_WINDOW_BOTTOM, Y_WINDOW_TOP, Y_BODY_TOP, Y_ROOF_BASE];
        els.segs.forEach((seg, i) => {
          const fall = Math.max(0, tau - 0.35 - i * 0.04);
          if (i === 0) {
            const k = clamp01(fall / 0.6);
            seg.setAttribute("transform", `translate(0 ${GROUND}) scale(1 ${(1 - 0.8 * k).toFixed(3)}) translate(0 ${-GROUND})`);
            seg.setAttribute("opacity", String(clamp01(1 - (fall - 0.5) / 0.4)));
            return;
          }
          const rest = GROUND - 30 - i * 10;
          const drop = Math.min(rest - bottoms[i], 0.5 * 1900 * fall * fall);
          const landed = drop >= rest - bottoms[i] - 0.5;
          const rot = (i % 2 ? 1 : -1) * fall * 18 - fall * 14;
          const cx = 0;
          const cy = (tops[i] + bottoms[i]) / 2;
          seg.setAttribute("transform", `translate(${(-i * 14 * fall).toFixed(1)} ${drop.toFixed(1)}) rotate(${rot.toFixed(1)} ${cx} ${cy.toFixed(1)})`);
          if (landed && !col.landed[i]) {
            col.landed[i] = true;
            const wx = towerWorldX(side, -i * 14 * fall);
            chipsBurst(wx, rest, 8, dirOf((1 - side) as 0 | 1), ["var(--color-tas)", "var(--color-tas-koyu)"]);
            dustPuff(wx, rest, 6, 70);
            st.shake = Math.max(st.shake, 10);
          }
          const since = landed ? tau - 0.35 - i * 0.04 - Math.sqrt((2 * (rest - bottoms[i])) / 1900) : 0;
          seg.setAttribute("opacity", landed ? String(clamp01(1 - since / 0.35)) : "1");
        });
        if (tau > 0.35 && tau < 1.5) {
          for (let k = 0; k < 2; k++) {
            emit({ kind: "dust", x: towerWorldX(side, rnd(-150, 150)), y: GROUND - rnd(0, 140), vx: rnd(-50, 50), vy: rnd(-60, -15), r: rnd(24, 40), grow: rnd(30, 60), max: rnd(1.4, 2.2), alpha: 0.6 });
          }
        }
        if (tau < 1.2) st.shake = Math.max(st.shake, 14 * (1 - tau / 1.2));
        if (tau > 2) {
          col.done = true;
          els.segs.forEach((s) => s.setAttribute("opacity", "0"));
        }
      });

      // -- bitiş gösterisi --
      if (fin) {
        const w = inp.winner;
        const collapsing = w === 0 || w === 1 ? vis[(1 - w) as 0 | 1].collapse : null;
        const collapseTau = collapsing ? (t - collapsing.start) / 1000 : 0;
        if ((w === 0 || w === 1) && collapsing && !fin.confetti && collapseTau > 1.1) {
          fin.confetti = true;
          sfx.cheer();
          if (!quiet) {
            const colors = [teamsRef.current[w].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor);
            confetti({ particleCount: 120, spread: 100, startVelocity: 48, origin: { x: w === 0 ? 0.25 : 0.75, y: 0.45 }, colors, disableForReducedMotion: true });
          }
        }
        const ready = w === "draw" || w === null ? t - fin.start > 1600 : collapsing ? collapsing.done || collapseTau > 2.6 : false;
        if (ready && !fin.called) {
          fin.called = true;
          handlers.current.onFinale();
        }
      }

      // -- ekip --
      CREW.forEach((member, i) => {
        const side = member.side;
        const c = cat[side];
        const d = dirOf(side);
        const kidX = CREW_X[member.role];
        let facing = 1;
        let target: CrewPose = { lean: 0.04, crouch: 0, near: { x: 10, y: -42 }, far: { x: -4, y: -44 }, armsUp: 0, cover: 0 };
        let mouth: "grit" | "open" | "smile" | "calm" = "calm";
        let held = false;
        let hop = 0;
        const toLocal = (p: Vec, face: number): Vec => ({ x: (p.x - kidX) / (CREW_SCALE * face), y: p.y / CREW_SCALE });
        const cockE = c.mode === "cock" ? t - c.start : -1;

        if (member.role === "kurucu" && cockE >= 0 && cockE < 1200) {
          if (cockE < 650) {
            // Vinci çevirir: iki el de kolda.
            const a = c.crank;
            const handle = { x: DRUM.x + Math.cos(a) * CRANK_R, y: DRUM.y + Math.sin(a) * CRANK_R };
            target = { lean: 0.3, crouch: 0.2, near: toLocal(handle, 1), far: toLocal(handle, 1), armsUp: 0, cover: 0 };
            mouth = "grit";
          } else if (cockE < 1050) {
            // Arkasındaki yığından taşı alıp kepçeye koyar.
            facing = -1;
            const k = clamp01((cockE - 650) / 170);
            const k2 = easeInOut(clamp01((cockE - 820) / 230));
            const pileTop = { x: PILE.x, y: -40 };
            const bucket = { x: armTip(ARM_COCKED).x, y: armTip(ARM_COCKED).y - 20 };
            const hand = cockE < 820 ? pileTop : mixV(pileTop, bucket, k2);
            target = { lean: lerp(0.5, 0.2, k2), crouch: cockE < 820 ? 0.75 * k : lerp(0.75, 0.1, k2), near: toLocal(hand, -1), far: toLocal({ x: hand.x + 10, y: hand.y }, -1), armsUp: 0, cover: 0 };
            held = cockE > 780;
            mouth = "grit";
          }
        } else if (member.role === "gozcu" && c.mode === "cock" && cockE >= AIM_LOCK_MS - 200) {
          // Gözcü karşı kuleyi gösterir.
          target = { lean: 0.08, crouch: 0, near: { x: 62, y: -150 }, far: { x: -4, y: -44 }, armsUp: 0, cover: 0 };
          mouth = "grit";
        }
        // Soru sırasında sırası gelen (ya da çalma hakkı olan) takımın gözcüsü elini kaldırır.
        const asking = inp.phase === "question" ? inp.turn : inp.phase === "steal" ? ((1 - inp.turn) as 0 | 1) : null;
        if (member.role === "gozcu" && asking === side && c.mode === "rest") {
          target = { ...target, near: { x: 24, y: -150 } };
          mouth = "smile";
        }
        if (c.mode === "fire" && t - c.start < 450) {
          target = { ...target, lean: -0.18, near: { x: 30, y: -150 }, far: { x: 22, y: -146 } };
          mouth = "open";
        }

        // Düşman taşı tepeden geçerken eğilir.
        const fl = st.flight;
        if (fl && !fl.impacted && fl.shot.side !== side && shotPos) {
          const wx = CATAPULT_X[side] + d * kidX;
          if (Math.abs(shotPos.x - wx) < 260 && shotPos.y < GROUND - 140) {
            target = { lean: 0.35, crouch: 0.8, near: null, far: null, armsUp: 0, cover: 1 };
            mouth = "open";
          }
        }

        const r = st.reactions[side];
        if (r && t >= r.start && t < r.until) {
          const k = (t - r.start) / 1000;
          if (r.kind === "cheer" || r.kind === "relief") {
            target = { lean: -0.05, crouch: 0, near: null, far: null, armsUp: r.kind === "cheer" ? 1 : 0.7, cover: 0 };
            mouth = "smile";
            if (!quiet && r.kind === "cheer") hop = Math.abs(Math.sin(k * 8 + i)) * 22 * Math.exp(-k * 0.6);
          } else {
            target = { lean: 0.15, crouch: 0.25, near: null, far: null, armsUp: 0, cover: 1 };
            mouth = "open";
          }
        }

        // Bitiş: kazananlar sevinir, kaybedenler yıkılan kulenin önünde çöker.
        if (fin && (inp.winner === 0 || inp.winner === 1)) {
          const loser = (1 - inp.winner) as 0 | 1;
          const col = vis[loser].collapse;
          if (col && t > col.start) {
            const k = (t - col.start) / 1000;
            if (side === inp.winner) {
              target = { lean: -0.05, crouch: 0, near: null, far: null, armsUp: 1, cover: 0 };
              mouth = "smile";
              if (!quiet && k < 4.5) hop = Math.abs(Math.sin(k * 7 + i * 1.3)) * 26;
            } else {
              target = { lean: 0.3, crouch: 0.9, near: null, far: null, armsUp: 0, cover: 1 };
              mouth = "open";
            }
          }
        } else if (fin && inp.winner === "draw") {
          target = { lean: 0, crouch: 0, near: null, far: null, armsUp: 0.35, cover: 0 };
          mouth = "open";
        }

        // Duruşu yumuşakça hedefe taşı.
        const p = pose[i];
        const kk = Math.min(1, dt * (quiet ? 30 : 14));
        p.lean = lerp(p.lean, target.lean, kk);
        p.crouch = lerp(p.crouch, target.crouch, kk);
        p.armsUp = lerp(p.armsUp, target.armsUp, kk);
        p.cover = lerp(p.cover, target.cover, kk);
        p.near = mixV(p.near ?? { x: 10, y: -42 }, target.near ?? { x: 10, y: -42 }, kk);
        p.far = mixV(p.far ?? { x: -4, y: -44 }, target.far ?? { x: -4, y: -44 }, kk);
        const sk = solveCrew(p);
        const el = crewEls[i];
        const worldX = CATAPULT_X[side] + d * kidX;
        el.root.setAttribute("transform", `translate(${worldX.toFixed(1)} ${(GROUND - hop).toFixed(1)}) scale(${(d * facing * CREW_SCALE).toFixed(3)} ${CREW_SCALE})`);
        el.legBack?.setAttribute("d", `M${fmt(sk.hip)}Q${fmt(sk.kneeBack)} ${fmt(sk.footBack)}`);
        el.legFront?.setAttribute("d", `M${fmt(sk.hip)}Q${fmt(sk.kneeFront)} ${fmt(sk.footFront)}`);
        el.shoeBack?.setAttribute("cx", (sk.footBack.x + 3).toFixed(1));
        el.shoeFront?.setAttribute("cx", (sk.footFront.x + 3).toFixed(1));
        el.shorts?.setAttribute("cx", sk.hip.x.toFixed(1));
        el.shorts?.setAttribute("cy", sk.hip.y.toFixed(1));
        el.torso?.setAttribute("d", `M${fmt(sk.hip)}L${fmt(sk.shoulder)}`);
        const mid = mixV(sk.hip, sk.shoulder, 0.55);
        el.stripe?.setAttribute("d", `M${fmt({ x: mid.x - 2, y: mid.y + 4 })}L${fmt({ x: mid.x + 13, y: mid.y - 3 })}`);
        el.farUpper?.setAttribute("d", `M${fmt(sk.shoulder)}L${fmt(sk.elbowFar)}`);
        el.farFore?.setAttribute("d", `M${fmt(sk.elbowFar)}L${fmt(sk.handFar)}`);
        el.farHand?.setAttribute("cx", sk.handFar.x.toFixed(1));
        el.farHand?.setAttribute("cy", sk.handFar.y.toFixed(1));
        el.nearUpper?.setAttribute("d", `M${fmt(sk.shoulder)}L${fmt(sk.elbowNear)}`);
        el.nearFore?.setAttribute("d", `M${fmt(sk.elbowNear)}L${fmt(sk.handNear)}`);
        el.nearHand?.setAttribute("cx", sk.handNear.x.toFixed(1));
        el.nearHand?.setAttribute("cy", sk.handNear.y.toFixed(1));
        el.head?.setAttribute("transform", `translate(${fmt(sk.head)}) rotate(${((sk.headAngle * 180) / Math.PI).toFixed(1)})`);
        el.held?.setAttribute("opacity", held ? "1" : "0");
        el.held?.setAttribute("transform", `translate(${fmt(mixV(sk.handNear, sk.handFar, 0.5))}) scale(0.9)`);
        el.mouths.grit?.setAttribute("opacity", mouth === "grit" ? "1" : "0");
        el.mouths.open?.setAttribute("opacity", mouth === "open" ? "1" : "0");
        el.mouths.smile?.setAttribute("opacity", mouth === "smile" ? "1" : "0");
        el.mouths.calm?.setAttribute("opacity", mouth === "calm" ? "1" : "0");
      });

      // -- rüzgâr: bulutlar ve bayraklar --
      const wind = inp.wind;
      const wsign = wind === 0 ? 1 : Math.sign(wind);
      const strength = Math.abs(wind);
      if (!quiet) {
        st.cloudX = st.cloudX.map((x) => {
          let nx = x + (8 + strength * 18) * wsign * dt;
          if (nx > 2400) nx -= 3200;
          if (nx < -800) nx += 3200;
          return nx;
        });
      }
      clouds.forEach((el, i) => el.setAttribute("transform", `translate(${st.cloudX[i].toFixed(1)} ${CLOUDS[i].y}) scale(${CLOUDS[i].s})`));
      const flagPath = (len: number, height: number, sign: number, phase: number) => {
        const droop = 1.25 - strength * 0.36;
        const amp = 2.5 + strength * 2.2;
        const omega = quiet ? 0 : 5 + strength * 3;
        const dx = Math.cos(droop) * sign;
        const dy = Math.sin(droop);
        const nx = -dy * sign;
        const ny = dx * sign;
        const top: string[] = [];
        const bottom: string[] = [];
        for (let j = 0; j <= 6; j++) {
          const s = j / 6;
          const wave = Math.sin(s * 5 - time * omega + phase) * amp * s;
          const px = dx * len * s + nx * wave;
          const py = dy * len * s + ny * wave;
          top.push(`${px.toFixed(1)} ${py.toFixed(1)}`);
          bottom.unshift(`${(px + nx * height * (1 - s * 0.25)).toFixed(1)} ${(py + ny * height * (1 - s * 0.25)).toFixed(1)}`);
        }
        return `M${top.join("L")}L${bottom.join("L")}Z`;
      };
      ([0, 1] as const).forEach((side) => {
        const mirror = side === 1 ? -1 : 1;
        towers[side].flag?.setAttribute("d", flagPath(64, 34, wsign * mirror, side * 1.3));
        cats[side].pennant?.setAttribute("d", flagPath(46, 26, wsign * dirOf(side), side * 2.1 + 1));
      });

      // -- parçacıklar --
      for (let j = particles.length - 1; j >= 0; j--) {
        const p = particles[j];
        p.life += dt;
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.r = Math.max(0.5, p.r + p.grow * dt);
        if (p.kind === "dust") {
          p.vx *= Math.exp(-dt * 1.5);
          p.vy *= Math.exp(-dt * 1.5);
        }
        if (p.floor !== null && p.y > p.floor) {
          p.y = p.floor;
          p.vy *= -0.3;
          p.vx *= 0.55;
          p.vr *= 0.5;
        }
        if (p.life >= p.max) particles.splice(j, 1);
      }
      let di = 0;
      let ci = 0;
      for (const p of particles) {
        const fade = 1 - p.life / p.max;
        if (p.kind === "dust" && di < dustEls.length) {
          const el = dustEls[di++];
          el.setAttribute("cx", p.x.toFixed(1));
          el.setAttribute("cy", p.y.toFixed(1));
          el.setAttribute("r", p.r.toFixed(1));
          el.setAttribute("fill", p.color);
          el.setAttribute("opacity", (p.alpha * fade).toFixed(2));
        } else if (p.kind === "chip" && ci < chipEls.length) {
          const el = chipEls[ci++];
          el.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)}) scale(${p.sx.toFixed(2)} ${p.sy.toFixed(2)})`);
          el.setAttribute("fill", p.color);
          el.setAttribute("opacity", Math.min(1, fade * 2).toFixed(2));
        }
      }
      for (; di < dustEls.length; di++) dustEls[di].setAttribute("opacity", "0");
      for (; ci < chipEls.length; ci++) chipEls[ci].setAttribute("opacity", "0");

      blocks.forEach((b, i) => {
        const el = blockEls[i];
        if (!b) return el.setAttribute("opacity", "0");
        b.life += dt;
        if (!b.settled) {
          b.vy += 1700 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.rot += b.vr * dt;
          if (b.y > b.floor) {
            b.y = b.floor;
            if (Math.abs(b.vy) < 160) {
              b.settled = true;
              b.rot = Math.round(b.rot / 90) * 90 + rnd(-12, 12);
            } else {
              b.vy *= -0.3;
              b.vx *= 0.5;
              b.vr *= 0.4;
              dustPuff(b.x, b.floor, 3, 12);
              sfx.thump();
            }
          }
        }
        el.setAttribute("transform", `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${b.rot.toFixed(1)})`);
        el.setAttribute("opacity", String(clamp01((6 - b.life) / 1)));
        if (b.life > 6) blocks[i] = null;
      });

      // -- isabet halkası ve hasar yazısı --
      if (st.ring) {
        const k = (t - st.ring.start) / 500;
        ring?.setAttribute("cx", st.ring.x.toFixed(1));
        ring?.setAttribute("cy", st.ring.y.toFixed(1));
        ring?.setAttribute("r", (20 + 170 * easeOut(clamp01(k))).toFixed(1));
        ring?.setAttribute("stroke-width", (12 - 9 * clamp01(k)).toFixed(1));
        ring?.setAttribute("opacity", quiet ? "0" : clamp01(1 - k).toFixed(2));
        if (k > 1) st.ring = null;
      } else ring?.setAttribute("opacity", "0");
      if (st.popup) {
        const k = (t - st.popup.start) / 1000;
        const s = quiet ? 1 : 1 - Math.exp(-11 * k) * Math.cos(15 * k);
        popup?.setAttribute("transform", `translate(${st.popup.x.toFixed(1)} ${(st.popup.y - 36 * k).toFixed(1)}) scale(${Math.max(0.01, s).toFixed(3)})`);
        popup?.setAttribute("opacity", clamp01((2.2 - k) / 0.4).toFixed(2));
        if (k > 2.2) st.popup = null;
      } else popup?.setAttribute("opacity", "0");

      ([0, 1] as const).forEach(paintTower);

      // -- kamera --
      let focus: Rect = inp.phase === "aim" || inp.phase === "shot" || inp.phase === "finished" || st.flight ? WIDE : OVERVIEW;
      let rate = 3.2;
      const collapsing = ([0, 1] as const).find((s) => vis[s].collapse && !vis[s].collapse!.done && t >= vis[s].collapse!.start);
      if (collapsing !== undefined) {
        focus = { x: TOWER_X[collapsing] - 520, y: 160, w: 1040, h: 660 };
        rate = 2.4;
      } else if (st.punch && t < st.punch.until) {
        focus = { x: st.punch.x - 560, y: st.punch.y - 330, w: 1120, h: 660 };
        rate = 6;
      }
      const k = quiet ? 1 : 1 - Math.exp(-dt * rate);
      st.cam = { x: lerp(st.cam.x, focus.x, k), y: lerp(st.cam.y, focus.y, k), w: lerp(st.cam.w, focus.w, k), h: lerp(st.cam.h, focus.h, k) };
      const A = st.aspect;
      let vw = st.cam.w;
      let vh = st.cam.h;
      if (vw / vh > A) vh = vw / A;
      else vw = vh * A;
      // Sahne kısalırken (soru paneline dönüş) görünüm çizilen dünyanın dışına taşmasın.
      if (vw > 3400) {
        vw = 3400;
        vh = vw / A;
      }
      let cx = st.cam.x + st.cam.w / 2;
      let cy = st.cam.y + st.cam.h / 2;
      if (cy + vh / 2 > 900) cy = 900 - vh / 2;
      if (cy - vh / 2 < -700) cy = -700 + vh / 2;
      cx = Math.max(-1400 + vw / 2, Math.min(3000 - vw / 2, cx));
      st.shake *= Math.exp(-dt * 6);
      const sx = quiet ? 0 : Math.sin(time * 61) * st.shake;
      const sy = quiet ? 0 : Math.cos(time * 47) * st.shake * 0.7;
      svg.setAttribute("viewBox", `${(cx - vw / 2 + sx).toFixed(1)} ${(cy - vh / 2 + sy).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);

      raf = requestAnimationFrame(frame);
    };
    const rulerEl = () => svg.querySelector<SVGGElement>('[data-part="ruler"]');
    let raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
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
    <svg ref={svgRef} viewBox="-30 130 1660 690" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full font-sans" aria-hidden>
      {art}
      <DamageRuler target={ruler.target} values={ruler.values} />
    </svg>
  );
}

