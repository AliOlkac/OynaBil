import confetti from "canvas-confetti";
import * as THREE from "three";
import { cssColor } from "@/lib/color";
import { sfx } from "@/lib/sound";
import { DARK, PANTS } from "../../shared/kid";
import { FIGURE, KidFigure, type BodyMotion, type Mouth } from "../../shared/stage3d/figure";
import { canvasTexture, clamp01, createRenderer, disposeTree, easeInOut, easeOut, follow, glowTexture, lerp, tierSettings, tokenColor, tokenCss } from "../../shared/stage3d/kit";
import { ChipPool, DustPool } from "../../shared/stage3d/particles";
import { createFrameWatch, type Tier } from "../../shared/stage3d/support";
import { AIM_LOCK_MS, sweepAt, ZONE_LABEL, type Shot } from "../logic";
import { CREW, type ArtTeam } from "../scene/art";
import type { RulerSpec, SceneInput } from "../scene/SiegeScene";
import { Catapult, rockGeometry } from "./catapult";
import { COLLAPSE_SECONDS } from "./debris";
import { buildLandscape } from "./landscape";
import { Tower } from "./tower";
import {
  ARM_COCKED,
  ARM_RELEASE,
  ARM_REST,
  CATAPULT_X,
  CRANK_R,
  CRANK_Z,
  CREW_SPOT,
  dirOf,
  DRUM,
  flightAt,
  flightFor,
  H_BODY_TOP,
  heightOf,
  heightOfSvgY,
  PILE,
  R_BASE,
  R_BODY,
  RANGE,
  rollAt,
  STONE_R,
  TOWER_X,
  type Flight,
  type V3,
} from "./world";

/**
 * Kule Yıkmaca'nın üç boyutlu motoru. Çizim sahnesiyle (SiegeScene) aynı girdiyi alır ve bütün hareketi
 * tek bir requestAnimationFrame döngüsünde çizer: mancınığın kurulması, taşın yüklenmesi, fırlatma, uçuş,
 * isabetle taşların dökülmesi, ekibin tepkileri, kamera ve kulenin yıkılışı.
 * Atış anını sahne yönetir; isabet anında `onImpact`, bitiş gösterisi bitince `onFinale` çağrılır.
 */

export type EngineHandlers = { onImpact: (index: number) => void; onFinale: () => void };
export type PopupSpec = { id: number; value: string; label: string; tone: "crit" | "hit" | "miss" };

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  tier: Tier;
  teams: [ArtTeam, ArtTeam];
  getInput: () => SceneInput;
  getRuler: () => RulerSpec;
  isReducedMotion: () => boolean;
  handlers: () => EngineHandlers;
  /** Hasar yazısı React tarafında çizilir; yeri her kare `place` ile (piksel) bildirilir. */
  ui: { popup: (p: PopupSpec | null) => void; place: (x: number, y: number) => void };
  onTier: (tier: Tier) => void;
  /** `true` dönerse sahne değiştirilecektir ve motor durur (bkz. Penaltı motoru). */
  onGiveUp: (reason: "slow" | "lost") => boolean;
};

type CamShot = { pos: V3; look: V3; fitW: number; fitH: number };
/** Soru sırasında iki kule; atışta taşın bütün yolu. */
const OVERVIEW: CamShot = { pos: { x: 0, y: 6.6, z: 44 }, look: { x: 0, y: 6.3, z: 0 }, fitW: 47, fitH: 15 };
const WIDE: CamShot = { pos: { x: 0, y: 8, z: 46 }, look: { x: 0, y: 7.4, z: 0 }, fitW: 47, fitH: 17 };

const KID = 0.9;
const STAND = 0.8 * KID;
const ANKLE = FIGURE.ankle * KID;
/** Fırlatmada kolun kepçeyi bıraktığı an (saniye). */
const RELEASE_DELAY = 0.109;

type CatMode = "rest" | "cock" | "fire" | "misfire";
type Cat = { mode: CatMode; wall: number; start: number; angle: number; crank: number; recoil: number; recoilVel: number; loaded: boolean; fire: boolean; sounds: Set<string> };
type Reaction = { kind: "cheer" | "dismay" | "relief"; start: number; until: number };
type ActiveFlight = {
  index: number;
  shot: Pick<Shot, "side" | "hit" | "zone" | "ammo" | "damage">;
  flight: Flight;
  start: number;
  launched: boolean;
  impacted: boolean;
  impactAt: number;
  honor: boolean;
};

function reticleTexture() {
  return canvasTexture(128, 128, (ctx, w) => {
    const c = w / 2;
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(c, c, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 9;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 28, c + Math.sin(a) * 28);
      ctx.lineTo(c + Math.cos(a) * 60, c + Math.sin(a) * 60);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(c, c, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function createSiegeEngine(o: EngineOptions): { dispose: () => void } {
  const { canvas, teams } = o;
  let settings = tierSettings(o.tier);
  const renderer = createRenderer(canvas, o.tier);
  const watch = createFrameWatch(o.tier);

  const scene = new THREE.Scene();
  const dusk = tokenColor("var(--color-ufuk)").lerp(tokenColor("var(--color-ink-700)"), 0.35);
  scene.background = dusk;
  scene.fog = new THREE.Fog(dusk, 70, 300);
  const camera = new THREE.PerspectiveCamera(30, 2, 0.5, 900);

  // ---- ışıklar: alacakaranlık dolgusu, kameranın yanından sıcak ana ışık, güneşten gelen kontur ----
  scene.add(new THREE.HemisphereLight(tokenColor("var(--color-ink-300)"), tokenColor("var(--color-camur)"), 1.7));
  const key = new THREE.DirectionalLight(tokenColor("var(--color-ufuk-acik)"), 3.6);
  key.position.set(-22, 30, 32);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(settings.shadowSize);
  key.shadow.camera.left = -30;
  key.shadow.camera.right = 30;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -14;
  key.shadow.camera.near = 6;
  key.shadow.camera.far = 100;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.05;
  const rim = new THREE.DirectionalLight(tokenColor("var(--color-ufuk)"), 2.2);
  rim.position.set(-10, 12, -40);
  scene.add(key, key.target, rim);

  const land = buildLandscape(settings);
  scene.add(land.group);

  const glow = glowTexture(64);
  const towers = ([0, 1] as const).map((side) => new Tower(side, teams[side]));
  const cats = ([0, 1] as const).map((side) => new Catapult(side, teams[side], glow));
  for (const t of towers) scene.add(t.group);
  for (const c of cats) scene.add(c.group);

  // ---- ekip ----
  const crew = CREW.map((member) => {
    const team = teams[member.side];
    const fig = new KidFigure({ skin: member.look.skin, hair: member.look.hair, hairStyle: member.look.style, shirt: team.base, trim: team.deep, shorts: PANTS, socks: team.deep, boots: DARK, scale: KID });
    scene.add(fig.root);
    return fig;
  });

  // ---- gülle, tutukluk taşı, kurucunun taşıdığı taş ----
  const stoneMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-tas)"), roughness: 0.9, emissive: tokenColor("var(--color-ates)"), emissiveIntensity: 0 });
  const stone = new THREE.Mesh(rockGeometry(STONE_R, 11), stoneMat);
  stone.castShadow = true;
  stone.visible = false;
  const plainRock = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-tas)"), roughness: 0.9 });
  const dud = new THREE.Mesh(rockGeometry(STONE_R, 12), plainRock);
  const held = new THREE.Mesh(rockGeometry(STONE_R * 0.92, 13), plainRock);
  dud.castShadow = held.castShadow = true;
  dud.visible = held.visible = false;
  const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: tokenColor("var(--color-ates)"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  fireGlow.scale.setScalar(2.4);
  fireGlow.visible = false;
  const TRAIL = 7;
  const trail = Array.from({ length: TRAIL }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.visible = false;
    scene.add(s);
    return s;
  });
  const trailPos: THREE.Vector3[] = [];
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: tokenColor("var(--color-kehribar)"), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: 0 }));
  flash.visible = false;
  scene.add(stone, dud, held, fireGlow, flash);

  // ---- parçacıklar ----
  const dust = new DustPool(70, glow);
  const chips = new ChipPool(110, 15);
  chips.mesh.castShadow = true;
  scene.add(dust.group, chips.mesh);
  const C = {
    toz: tokenColor("var(--color-toz)"),
    duman: tokenColor("var(--color-ink-300)"),
    tas: [tokenColor("var(--color-tas)"), tokenColor("var(--color-tas-koyu)"), tokenColor("var(--color-tas-acik)")],
    ates: [tokenColor("var(--color-ates)"), tokenColor("var(--color-kehribar)")],
    cam: [tokenColor("var(--color-kehribar)"), tokenColor("var(--color-ufuk-acik)")],
    toprak: [tokenColor("var(--color-camur)"), tokenColor("var(--color-toz)")],
    ahsap: tokenColor("var(--color-ahsap)"),
    team: teams.map((t) => [tokenColor(t.deep), tokenColor(t.base)]),
  };
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const calm = () => o.isReducedMotion();
  const dustPuff = (x: number, y: number, z: number, n: number, spread: number, size = 1, color = C.toz) => {
    if (calm()) return;
    for (let i = 0; i < n; i++) {
      dust.emit({ x: x + rnd(-spread, spread), y: y + rnd(0, 0.3), z: z + rnd(-spread, spread), vx: rnd(-1.2, 1.2), vy: rnd(0.3, 1.5), vz: rnd(-0.8, 0.8), size: rnd(0.9, 1.7) * size, grow: rnd(0.7, 1.5) * size, life: rnd(0.8, 1.5), color, alpha: 0.5 });
    }
  };
  /** `away`: kırıntıların savrulduğu x yönü. */
  const chipsBurst = (x: number, y: number, z: number, n: number, away: number, colors: THREE.Color[], size = 0.14) => {
    if (calm()) return;
    for (let i = 0; i < n; i++) {
      chips.emit({ x: x + rnd(-0.15, 0.15), y: y + rnd(-0.15, 0.15), z: z + rnd(-0.3, 0.3), vx: away * rnd(1, 6.5), vy: rnd(1, 8), vz: rnd(-3.2, 3.6), size: size * rnd(0.6, 1.5), life: rnd(1.2, 2), color: colors[i % colors.length] });
    }
  };

  // ---- düşük kademede yuvarlak gölgeler ----
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const blobGeo = new THREE.CircleGeometry(1, 20);
  const blob = (rx: number, rz: number) => {
    const m = new THREE.Mesh(blobGeo, blobMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(rx, rz, 1);
    m.position.y = 0.03;
    m.renderOrder = 2;
    scene.add(m);
    return m;
  };
  const towerBlobs = towers.map((t) => {
    const b = blob(2.9, 2.3);
    b.position.x = t.group.position.x;
    return b;
  });
  const catBlobs = cats.map((c) => {
    const b = blob(2.3, 1.4);
    b.position.x = c.group.position.x;
    return b;
  });
  const crewBlobs = crew.map(() => blob(0.34, 0.3));
  const stoneBlob = blob(0.3, 0.3);

  // ---- nişangâh ve hasar cetveli ----
  const aimGroup = new THREE.Group();
  const reticle = new THREE.Sprite(new THREE.SpriteMaterial({ map: reticleTexture(), depthTest: false, depthWrite: false, fog: false, transparent: true }));
  reticle.scale.setScalar(1.7);
  reticle.renderOrder = 8;
  const aimLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.09), new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-cream)"), transparent: true, opacity: 0.8, depthTest: false, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  aimLine.renderOrder = 7;
  const RULER_W = 2.6;
  const rulerCanvas = document.createElement("canvas");
  rulerCanvas.width = 260;
  rulerCanvas.height = 1200;
  const rulerTex = new THREE.CanvasTexture(rulerCanvas);
  rulerTex.colorSpace = THREE.SRGBColorSpace;
  rulerTex.anisotropy = 4;
  const rulerMesh = new THREE.Mesh(new THREE.PlaneGeometry(RULER_W, RANGE), new THREE.MeshBasicMaterial({ map: rulerTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  rulerMesh.renderOrder = 6;
  aimGroup.add(aimLine, rulerMesh, reticle);
  aimGroup.visible = false;
  scene.add(aimGroup);
  let rulerKey = "";
  /** Cetvel: her bölgenin karşısında vereceği hasar. Kuleye bakan kenarda renkli şerit, yanında sayı. */
  const drawRuler = (spec: RulerSpec, barOnLeft: boolean) => {
    const k = `${barOnLeft}|${spec.values.map((v) => `${v.from},${v.to},${v.damage}`).join(";")}`;
    if (k === rulerKey) return;
    rulerKey = k;
    const ctx = rulerCanvas.getContext("2d")!;
    const W = rulerCanvas.width;
    const H = rulerCanvas.height;
    ctx.clearRect(0, 0, W, H);
    const top = heightOf(1);
    const yPx = (h: number) => ((top - h) / RANGE) * H;
    const ink = tokenCss("var(--color-ink-950)");
    for (const v of spec.values) {
      const a = yPx(heightOfSvgY(v.from));
      const b = yPx(heightOfSvgY(v.to));
      const y0 = Math.min(a, b);
      const hh = Math.abs(b - a);
      const barX = barOnLeft ? 8 : W - 8 - 44;
      ctx.globalAlpha = v.damage === 0 ? 0.55 : 0.95;
      ctx.fillStyle = v.damage === 0 ? tokenCss("var(--color-ink-600)") : v.crit ? tokenCss("var(--color-kehribar)") : tokenCss("var(--color-cream)");
      ctx.strokeStyle = ink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(barX, y0 + 4, 44, hh - 8, 10);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (v.damage > 0) {
        ctx.font = `700 ${v.crit ? 96 : 76}px "Lexend Variable", Lexend, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = 18;
        ctx.strokeStyle = ink;
        ctx.fillStyle = v.crit ? tokenCss("var(--color-kehribar)") : tokenCss("var(--color-cream)");
        const tx = barOnLeft ? 60 + (W - 60) / 2 : (W - 60) / 2;
        ctx.strokeText(String(v.damage), tx, y0 + hh / 2 + 4);
        ctx.fillText(String(v.damage), tx, y0 + hh / 2 + 4);
      }
    }
    rulerTex.needsUpdate = true;
  };

  // ---- durum ----
  const start = o.getInput();
  const st = {
    time: 0,
    last: performance.now(),
    aspect: 2,
    width: 1,
    height: 1,
    cut: true,
    cam: { pos: new THREE.Vector3(), look: new THREE.Vector3(), fitW: 45, fitH: 12 },
    shake: 0,
    punch: null as null | { x: number; y: number; d: number; until: number },
    seenShots: start.shots.length,
    seenAim: start.aimStart,
    seenMisfire: [...start.misfireAt] as (number | null)[],
    flight: null as ActiveFlight | null,
    dud: null as null | { x: number; y: number; vx: number; vy: number; start: number },
    popup: null as null | { start: number; anchor: THREE.Vector3 },
    popupId: 0,
    flash: null as null | { start: number },
    reactions: [null, null] as (Reaction | null)[],
    finale: null as null | { start: number; called: boolean; honor: boolean; confetti: boolean; fired: boolean },
    collapseAt: [null, null] as (number | null)[],
    collapseFx: [0, 0],
    lastThump: -1,
  };
  const cat: Cat[] = [0, 1].map(() => ({ mode: "rest", wall: 0, start: 0, angle: ARM_REST, crank: 0, recoil: 0, recoilVel: 0, loaded: false, fire: false, sounds: new Set() }));

  const applyShot = (s: Pick<Shot, "side" | "hit" | "zone" | "damage">, index: number, animated: boolean) => {
    towers[1 - s.side].hit({ zone: s.zone, damage: s.damage, hitY: heightOf(s.hit), index }, st.time, animated);
  };
  // Açılışta mevcut atışlar animasyonsuz işlenir; bitmiş oyun yeniden açıldıysa gösteri atlanır.
  start.shots.forEach((s, i) => applyShot(s, i, false));
  if (start.phase === "finished") {
    if (start.winner === 0 || start.winner === 1) towers[1 - start.winner].collapse(st.time, true);
    st.finale = { start: -10, called: false, honor: false, confetti: true, fired: true };
  }

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    st.width = w;
    st.height = h;
    st.aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = st.aspect;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const applyTier = (next: Tier) => {
    settings = tierSettings(next);
    renderer.setPixelRatio(settings.pixelRatio);
    renderer.shadowMap.enabled = settings.shadows;
    key.shadow.mapSize.setScalar(settings.shadowSize);
    key.shadow.map?.dispose();
    key.shadow.map = null;
    land.setDetail(settings);
    scene.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) m.needsUpdate = true;
    });
    resize();
    o.onTier(next);
  };

  let stopped = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    stopped = true;
    o.onGiveUp("lost");
  };
  canvas.addEventListener("webglcontextlost", onLost);

  // ---- atış ----
  const launch = (shot: ActiveFlight["shot"], index: number, honor = false) => {
    const c = cat[shot.side];
    c.mode = "fire";
    c.start = st.time;
    c.loaded = true;
    c.fire = shot.ammo === "ates";
    c.sounds = new Set();
    st.flight = { index, shot, flight: flightFor(shot), start: st.time, launched: false, impacted: false, impactAt: 0, honor };
    trailPos.length = 0;
  };

  const startCollapse = (side: 0 | 1, at: number) => {
    if (st.collapseAt[side] !== null || towers[side].collapsing) return;
    st.collapseAt[side] = at;
  };

  const impact = (f: ActiveFlight) => {
    f.impacted = true;
    f.impactAt = st.time;
    const { shot, flight } = f;
    const target = (1 - shot.side) as 0 | 1;
    const p = flight.to;
    const d = dirOf(shot.side);
    const crit = shot.zone === "pencere";
    if (flight.end === "tower") {
      if (f.honor) towers[target].hit({ zone: shot.zone, damage: 30, hitY: p.y, index: -1 }, st.time, !calm());
      else applyShot(shot, f.index, !calm());
      chipsBurst(p.x, p.y, 0, 12 + Math.round(shot.damage / 3), -d, C.tas, 0.17);
      dustPuff(p.x - d * 0.3, p.y, 0, 8, 0.4);
      if (crit) {
        chipsBurst(p.x, p.y, 0, 14, -d, [...C.team[target], C.ahsap], 0.16);
        chipsBurst(p.x, p.y, 0, 8, -d, C.cam, 0.1);
      } else if (shot.zone === "kulah") chipsBurst(p.x, p.y, 0, 16, -d, C.team[target], 0.15);
      if (shot.ammo === "ates") chipsBurst(p.x, p.y, 0, 10, -d, C.ates, 0.1);
      st.shake = crit ? 0.26 : 0.08 + shot.damage * 0.004;
      st.punch = { x: p.x, y: p.y, d, until: st.time + 1.1 };
      if (crit) {
        st.flash = { start: st.time };
        sfx.crit();
      } else sfx.hit(shot.damage);
    } else {
      dustPuff(p.x, 0.1, 0, 12, 0.5);
      chipsBurst(p.x, 0.15, 0, 6, d, C.toprak, 0.12);
      st.shake = 0.05;
      sfx.miss();
    }
    if (!f.honor) {
      const anchor = new THREE.Vector3(p.x - d * 1.2, flight.end === "tower" ? Math.min(p.y + 2, H_BODY_TOP + 1.5) : 3.2, 0.5);
      st.popup = { start: st.time, anchor };
      o.ui.popup({ id: ++st.popupId, value: shot.damage > 0 ? `−${shot.damage}` : "Iska!", label: crit ? "KRİTİK! Pencere" : ZONE_LABEL[shot.zone], tone: crit ? "crit" : shot.damage > 0 ? "hit" : "miss" });
    }
    // Ekipler: atan takım isabette sevinir, ıskada üzülür; hedef takım tersini yapar.
    const hitIt = shot.damage > 0 || f.honor;
    st.reactions[shot.side] = { kind: hitIt ? "cheer" : "dismay", start: st.time, until: st.time + (crit ? 2.2 : 1.6) };
    st.reactions[target] = { kind: hitIt ? "dismay" : "relief", start: st.time, until: st.time + 1.6 };
    if (!f.honor) o.handlers().onImpact(f.index);
    const hpLeft = f.honor ? 0 : o.getInput().hp[target];
    if (hpLeft <= 0) startCollapse(target, st.time + 0.35);
  };

  // ---- ekip pozu ----
  const motion: BodyMotion[] = crew.map((_, i) => restPose(CREW[i].side, CREW[i].role));
  const target: BodyMotion = restPose(0, "kurucu");
  const baseHip = motion.map((m) => m.hip);
  const handsV = new THREE.Vector3();
  const vA = new THREE.Vector3();
  const stonePos: V3 = { x: 0, y: 0, z: 0 };
  const ahead: V3 = { x: 0, y: 0, z: 0 };
  const proj = new THREE.Vector3();

  function restPose(side: 0 | 1, role: "kurucu" | "gozcu"): BodyMotion {
    const d = dirOf(side);
    const spot = CREW_SPOT[role];
    return {
      x: CATAPULT_X[side] + d * spot.x,
      z: spot.z,
      hip: STAND,
      yaw: Math.atan2(d * 0.8, 0.6),
      footL: { x: -0.1 * KID, y: ANKLE, z: 0 },
      footR: { x: 0.1 * KID, y: ANKLE, z: 0 },
      handL: { x: -0.3 * KID, y: STAND + 0.02, z: 0.05 },
      handR: { x: 0.3 * KID, y: STAND + 0.02, z: 0.05 },
      lean: 0.04,
      headPitch: 0,
    };
  }
  /** Dünya koordinatındaki bir noktayı karakterin gövde koordinatına çevirir (el hedefi için). */
  const toBody = (m: BodyMotion, wx: number, wy: number, wz: number, out: V3) => {
    const dx = wx - m.x;
    const dz = wz - m.z;
    const c = Math.cos(m.yaw);
    const s = Math.sin(m.yaw);
    out.x = dx * c - dz * s;
    out.y = wy;
    out.z = dx * s + dz * c;
  };
  /** Duruş parametrelerinden poz: çömelme, zıplama, kolları kaldırma, başını koruma. */
  const stance = (m: BodyMotion, crouch: number, hop: number, armsUp: number, cover: number) => {
    m.hip = STAND * (1 - 0.4 * crouch) + hop;
    const spread = 0.1 + 0.06 * crouch;
    m.footL = { x: -spread * KID, y: ANKLE + hop * 0.85, z: 0.02 };
    m.footR = { x: spread * KID, y: ANKLE + hop * 0.85, z: 0.02 };
    const hang = m.hip + 0.02;
    const up = m.hip + 1.02 * KID;
    const head = m.hip + 0.84 * KID;
    const y = lerp(lerp(hang, up, armsUp), head, cover);
    const x = lerp(lerp(0.3, 0.36, armsUp), 0.15, cover) * KID;
    const z = lerp(0.05, 0.1, Math.max(armsUp, cover));
    m.handL = { x: -x, y, z };
    m.handR = { x, y, z };
  };
  const mix = (a: V3, b: V3, k: number) => {
    a.x = lerp(a.x, b.x, k);
    a.y = lerp(a.y, b.y, k);
    a.z = lerp(a.z, b.z, k);
  };
  const turnTo = (from: number, to: number, k: number) => {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + d * k;
  };

  // ---- kare döngüsü ----
  const frame = (now: number) => {
    if (stopped) return;
    const realMs = now - st.last;
    const dt = Math.min(0.05, realMs / 1000);
    st.last = now;
    st.time += dt;
    const t = st.time;
    const inp = o.getInput();
    const quiet = calm();
    const wall = Date.now();
    // Soru okunurken bayraklar ve bulutlar durur; rüzgârın yönünü yine gösterirler.
    const still = quiet || inp.phase === "question" || inp.phase === "reveal";

    const verdict = watch.sample(realMs);
    if (verdict === "in") applyTier(watch.tier);
    else if (verdict === "vazgec" && o.onGiveUp("slow")) return;

    // -- olaylar --
    if (inp.phase === "aim" && inp.shooter !== null && inp.aimStart !== null && inp.aimStart !== st.seenAim) {
      st.seenAim = inp.aimStart;
      const c = cat[inp.shooter];
      c.mode = "cock";
      c.wall = inp.aimStart;
      c.loaded = false;
      c.fire = inp.ammo === "ates";
      c.sounds = new Set();
    }
    if (inp.shots.length > st.seenShots) {
      for (let i = st.seenShots; i < inp.shots.length - 1; i++) {
        applyShot(inp.shots[i], i, false);
        o.handlers().onImpact(i);
      }
      const i = inp.shots.length - 1;
      st.seenShots = inp.shots.length;
      launch(inp.shots[i], i);
    }
    ([0, 1] as const).forEach((side) => {
      const at = inp.misfireAt[side];
      if (at === null || at === st.seenMisfire[side]) return;
      st.seenMisfire[side] = at;
      const c = cat[side];
      c.mode = "misfire";
      c.start = t;
      c.loaded = true;
      c.fire = false;
      c.sounds = new Set();
      st.reactions[side] = { kind: "dismay", start: t + 0.45, until: t + 2 };
    });
    // Bitiş: tur sonunda kazanan takım şeref atışıyla karşı kuleyi yıkar; berabere ise kuleler ayakta kalır.
    if (inp.phase === "finished" && !st.finale && (!st.flight || st.flight.impacted)) {
      const w = inp.winner;
      if (inp.endReason === "rounds" && (w === 0 || w === 1)) {
        st.finale = { start: t, called: false, honor: true, confetti: false, fired: false };
        const c = cat[w];
        c.mode = "cock";
        c.wall = wall - 300;
        c.loaded = false;
        c.fire = true;
        c.sounds = new Set();
      } else st.finale = { start: t, called: false, honor: false, confetti: false, fired: true };
    }
    const fin = st.finale;
    if (fin?.honor && !fin.fired && !st.flight && (inp.winner === 0 || inp.winner === 1) && t - fin.start > AIM_LOCK_MS / 1000 + 0.3) {
      fin.fired = true;
      launch({ side: inp.winner, hit: 0.43, zone: "pencere", ammo: "ates", damage: 0 }, -1, true);
    }

    // -- mancınıklar --
    ([0, 1] as const).forEach((side) => {
      const c = cat[side];
      if (c.mode === "cock") {
        const e = wall - c.wall;
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
        const sec = t - c.start;
        if (sec < 0.12) c.angle = ARM_COCKED - (ARM_COCKED - ARM_REST) * (sec / 0.12) ** 3;
        else c.angle = ARM_REST + 9 * Math.exp(-7 * (sec - 0.12)) * Math.abs(Math.sin(24 * (sec - 0.12)));
        if (c.angle <= ARM_RELEASE && c.loaded) {
          c.loaded = false;
          c.recoilVel = -5.2;
          dustPuff(CATAPULT_X[side] - dirOf(side) * 1.2, 0.1, 0.4, 5, 0.9);
          sfx.launch();
        }
        if (sec > 1.5) c.mode = "rest";
      } else if (c.mode === "misfire") {
        const sec = t - c.start;
        if (sec < 0.35) c.angle = lerp(ARM_REST, 122, easeOut(sec / 0.35));
        else if (sec < 0.45) c.angle = lerp(122, ARM_REST - 2, ((sec - 0.35) / 0.1) ** 3);
        else c.angle = ARM_REST + 6 * Math.exp(-6 * (sec - 0.45)) * Math.abs(Math.sin(20 * (sec - 0.45)));
        c.crank = clamp01(sec / 0.35) * Math.PI * 1.6;
        if (sec >= 0.4 && c.loaded) {
          c.loaded = false;
          cats[side].bucketWorld(c.angle, vA);
          st.dud = { x: vA.x, y: vA.y, vx: dirOf(side) * 2.4, vy: 4.8, start: t };
          dustPuff(CATAPULT_X[side] + dirOf(side) * DRUM.x, DRUM.y, 0.3, 6, 0.3, 0.7, C.duman);
          sfx.misfire();
        }
        if (sec > 2) c.mode = "rest";
      } else {
        c.angle += (ARM_REST - c.angle) * Math.min(1, dt * 6);
        c.crank *= Math.exp(-dt * 2);
      }
      c.recoilVel += (-140 * c.recoil - 13 * c.recoilVel) * dt;
      c.recoil += c.recoilVel * dt;
      const model = cats[side];
      model.setArm(c.angle);
      model.setCrank(c.crank);
      model.setRecoil(c.recoil);
      model.setLoaded(c.loaded, c.fire, t);
      model.update(t, inp.wind, still);
      catBlobs[side].visible = !settings.shadows;
    });

    // -- uçuş --
    const f = st.flight;
    let flying = false;
    let stoneVisible = false;
    if (f) {
      const sec = t - f.start - RELEASE_DELAY;
      const d = dirOf(f.shot.side);
      if (sec >= 0 && !f.launched) {
        f.launched = true;
        sfx.whoosh(f.flight.duration);
      }
      if (sec >= 0 && !f.impacted) {
        const u = sec / f.flight.duration;
        if (u >= 1) impact(f);
        else {
          flying = true;
          stoneVisible = true;
          flightAt(f.flight, u, stonePos);
          flightAt(f.flight, Math.min(1, u + 0.02), ahead);
          stone.rotation.set(sec * 5, 0, -sec * 9 * d);
          trailPos.unshift(new THREE.Vector3(stonePos.x, stonePos.y, 0));
          if (trailPos.length > TRAIL * 2) trailPos.length = TRAIL * 2;
          if (f.shot.ammo === "ates" && !quiet && Math.random() < 0.6) {
            dust.emit({ x: stonePos.x, y: stonePos.y, z: 0, vx: rnd(-0.4, 0.4), vy: rnd(0, 0.8), vz: rnd(-0.3, 0.3), size: rnd(0.35, 0.7), grow: -0.5, life: 0.45, color: C.ates[Math.random() < 0.5 ? 0 : 1], alpha: 0.9 });
          }
        }
      }
      if (f.impacted && f.flight.end !== "tower") {
        // Kuleye değmeyen taş yerde seker ve yuvarlanır.
        const since = t - f.impactAt;
        rollAt(f.flight, f.shot.side, since, stonePos);
        stone.rotation.z = -((stonePos.x - f.flight.to.x) / STONE_R);
        stoneVisible = since < 2.6;
        stoneMat.opacity = clamp01((2.6 - since) / 0.6);
      } else stoneMat.opacity = 1;
      if (f.impacted && t - f.impactAt > 2.6) st.flight = null;
    }
    const fiery = !!f && f.shot.ammo === "ates" && flying;
    stone.visible = stoneVisible;
    stoneMat.transparent = stoneMat.opacity < 1;
    stoneMat.emissiveIntensity = fiery ? 1.6 : 0;
    stoneMat.color.copy(fiery ? C.ates[0] : C.tas[0]);
    fireGlow.visible = fiery;
    if (stoneVisible) {
      stone.position.set(stonePos.x, stonePos.y, 0);
      fireGlow.position.copy(stone.position);
      fireGlow.material.opacity = 0.8 + 0.2 * Math.sin(t * 40);
    }
    stoneBlob.visible = stoneVisible && !settings.shadows;
    if (stoneBlob.visible) {
      stoneBlob.position.set(stonePos.x, 0.03, 0);
      stoneBlob.scale.setScalar(0.34 * (1 - 0.5 * clamp01(stonePos.y / 14)));
    }
    trail.forEach((s, i) => {
      const p = flying && !quiet ? trailPos[i * 2 + 1] : undefined;
      s.visible = !!p;
      if (!p) return;
      s.position.copy(p);
      s.scale.setScalar((fiery ? 1.5 : 0.9) * (1 - i / (TRAIL + 2)));
      s.material.color.copy(fiery ? C.ates[0] : C.toz);
      s.material.opacity = (fiery ? 0.55 : 0.28) * (1 - i / TRAIL);
    });

    // -- tutukluk taşı --
    if (st.dud) {
      const dd = st.dud;
      dd.vy -= 20 * dt;
      dd.x += dd.vx * dt;
      dd.y += dd.vy * dt;
      if (dd.y < STONE_R) {
        dd.y = STONE_R;
        dd.vy *= -0.3;
        dd.vx *= 0.6;
      }
      const age = t - dd.start;
      dud.visible = age < 3.2;
      dud.position.set(dd.x, dd.y, 0.25);
      dud.rotation.z = -dd.x * 2;
      dud.scale.setScalar(clamp01((3.2 - age) / 0.5));
      if (age > 3.2) st.dud = null;
    } else dud.visible = false;

    // -- nişangâh ve cetvel --
    const aiming = inp.phase === "aim" && inp.shooter !== null && inp.aimStart !== null;
    const aimElapsed = aiming ? wall - inp.aimStart! : 0;
    const live = aiming && aimElapsed >= AIM_LOCK_MS;
    aimGroup.visible = live;
    if (live) {
      const shooter = inp.shooter!;
      const targetSide = (1 - shooter) as 0 | 1;
      const d = dirOf(shooter);
      const y = heightOf(sweepAt(aimElapsed, inp.difficulty));
      const tx = TOWER_X[targetSide];
      const appear = clamp01((aimElapsed - AIM_LOCK_MS) / 250);
      const faceX = tx - d * (R_BODY + 0.35);
      const rulerX = tx + d * (R_BASE + 1.7);
      drawRuler(o.getRuler(), camera.position.x < rulerX === d > 0);
      reticle.position.set(faceX, y, 0.2);
      reticle.scale.setScalar(1.7 * (0.6 + 0.4 * easeOut(appear)));
      reticle.material.rotation = quiet ? 0 : t * 0.7;
      reticle.material.color.copy(tokenColor(teams[shooter].base)).lerp(tokenColor("var(--color-cream)"), 0.35);
      reticle.material.opacity = appear;
      const lineTo = rulerX - d * (RULER_W / 2 - 0.2);
      aimLine.position.set((faceX + lineTo) / 2, y, 0.2);
      aimLine.scale.x = Math.abs(lineTo - faceX);
      aimLine.material.opacity = 0.75 * appear;
      aimLine.quaternion.copy(camera.quaternion);
      rulerMesh.position.set(rulerX, heightOf(0.5), 0.2);
      rulerMesh.rotation.y = Math.atan2(camera.position.x - rulerX, camera.position.z);
      rulerMesh.material.opacity = appear;
    }

    // -- yıkılış --
    ([0, 1] as const).forEach((side) => {
      const tower = towers[side];
      const at = st.collapseAt[side];
      if (at !== null && t >= at && !tower.collapsing) {
        tower.collapse(t, quiet);
        sfx.collapse();
      }
      tower.update(t, inp.wind, still);
      for (const l of tower.landings) {
        dustPuff(l.x, 0.05, l.z, 2, 0.2, 0.6);
        if (t - st.lastThump > 0.09) {
          st.lastThump = t;
          sfx.thump();
        }
      }
      tower.landings.length = 0;
      towerBlobs[side].visible = !settings.shadows && !tower.collapsing;
      if (tower.collapseStart === null || quiet) return;
      const tau = t - tower.collapseStart;
      const tx = TOWER_X[side];
      if (tau > 0.35 && tau < 1.7) {
        for (let k = 0; k < 2; k++) dust.emit({ x: tx + rnd(-3.6, 3.6), y: rnd(0.2, 2.8), z: rnd(-1.5, 2.5), vx: rnd(-1.2, 1.2), vy: rnd(0.4, 1.4), vz: rnd(-0.4, 0.8), size: rnd(2, 3.4), grow: rnd(1.4, 2.6), life: rnd(1.4, 2.2), color: C.toz, alpha: 0.5 });
      }
      const stage = tau > 1.1 ? 2 : tau > 0.6 ? 1 : 0;
      if (stage > st.collapseFx[side]) {
        st.collapseFx[side] = stage;
        chipsBurst(tx, 1.2, 0.5, 14, -dirOf(side), C.tas, 0.2);
        chipsBurst(tx, 1.2, 0.5, 10, dirOf(side), C.tas, 0.2);
        st.shake = Math.max(st.shake, 0.2);
      }
      if (tau < 1.2) st.shake = Math.max(st.shake, 0.24 * (1 - tau / 1.2));
    });

    // -- bitiş gösterisi --
    if (fin) {
      const w = inp.winner;
      const loser = w === 0 || w === 1 ? towers[1 - w] : null;
      const tau = loser?.collapseStart != null ? t - loser.collapseStart : 0;
      if ((w === 0 || w === 1) && loser?.collapsing && !fin.confetti && tau > 1.1) {
        fin.confetti = true;
        sfx.cheer();
        if (!quiet) {
          const colors = [teams[w].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor);
          confetti({ particleCount: 120, spread: 100, startVelocity: 48, origin: { x: w === 0 ? 0.25 : 0.75, y: 0.45 }, colors, disableForReducedMotion: true });
        }
      }
      const ready = w === "draw" || w === null ? t - fin.start > 1.6 : loser ? loser.collapsed(t) && (quiet || tau > COLLAPSE_SECONDS + 0.2 || fin.start < 0) : false;
      if (ready && !fin.called) {
        fin.called = true;
        o.handlers().onFinale();
      }
    }

    // -- ekip --
    let heldBy = -1;
    CREW.forEach((member, i) => {
      const side = member.side;
      const c = cat[side];
      const d = dirOf(side);
      const cx = CATAPULT_X[side];
      const m = target;
      Object.assign(m, restPose(side, member.role));
      let crouch = 0;
      let hop = 0;
      let armsUp = 0;
      let cover = 0;
      let mouth: Mouth = "smile";
      let hands: [V3, V3] | null = null;
      const cockE = c.mode === "cock" ? wall - c.wall : -1;
      const camHand = d > 0 ? 0 : 1;

      if (member.role === "kurucu" && cockE >= 0 && cockE < 1200) {
        mouth = "focus";
        if (cockE < 650) {
          // Vinci çevirir: iki el de kolda.
          const a = c.crank;
          const hx = cx + d * (DRUM.x + Math.cos(a) * CRANK_R);
          const hy = DRUM.y + Math.sin(a) * CRANK_R;
          m.x = cx + d * (DRUM.x - 0.47 + 0.08 * Math.cos(a));
          m.z = CRANK_Z + 0.02;
          m.yaw = (d * Math.PI) / 2;
          m.lean = 0.34;
          crouch = 0.2 - 0.14 * Math.sin(a);
          hands = [{ x: hx, y: hy, z: CRANK_Z - 0.05 }, { x: hx, y: hy, z: CRANK_Z + 0.09 }];
        } else {
          // Arkasındaki yığından taşı alıp kepçeye koyar.
          const k = clamp01((cockE - 650) / 170);
          const k2 = easeInOut(clamp01((cockE - 820) / 230));
          cats[side].bucketWorld(ARM_COCKED, vA);
          const pile = { x: cx + d * (PILE.x + 0.1), y: 0.74, z: PILE.z + 0.2 };
          const hx = lerp(pile.x, vA.x, k2);
          const hy = lerp(pile.y, vA.y + 0.12, k2) + Math.sin(k2 * Math.PI) * 0.25;
          const hz = lerp(pile.z, 0.2, k2);
          m.x = cx + d * lerp(PILE.x + 0.66, -2.32, k2);
          m.z = lerp(PILE.z + 0.8, 0.74, k2);
          m.yaw = Math.atan2(hx - m.x, hz - m.z);
          m.lean = lerp(0.5, 0.25, k2);
          crouch = cockE < 820 ? 0.7 * k : lerp(0.7, 0.05, k2);
          hands = [{ x: hx, y: hy, z: hz }, { x: hx, y: hy, z: hz }];
          if (cockE > 780 && cockE < 1050) heldBy = i;
        }
      } else if (member.role === "gozcu" && c.mode === "cock" && cockE >= AIM_LOCK_MS - 200) {
        // Gözcü karşı kuleyi gösterir.
        m.yaw = (d * Math.PI) / 2 - d * 0.35;
        mouth = "focus";
        hands = [null as unknown as V3, null as unknown as V3];
        hands[camHand] = { x: m.x + d * 0.46, y: STAND + 0.62 * KID, z: m.z + 0.12 };
      }
      // Soru sırasında cevap hakkı süren takımın gözcüsü elini kaldırır.
      if (member.role === "gozcu" && inp.phase === "question" && !inp.locked[side] && c.mode === "rest") {
        m.yaw = Math.atan2(d * 0.4, 1);
        hands = [null as unknown as V3, null as unknown as V3];
        hands[camHand] = { x: m.x + (camHand === 0 ? -0.22 : 0.22) * KID, y: STAND + 1.06 * KID, z: m.z + 0.05 };
        mouth = "grin";
      }
      if (c.mode === "fire" && t - c.start < 0.45) {
        hands = null;
        armsUp = 0.9;
        m.lean = -0.16;
        mouth = "shock";
      }
      // Düşman taşı tepeden geçerken eğilir.
      if (flying && f && f.shot.side !== side && Math.abs(stonePos.x - m.x) < 5.2 && stonePos.y > 2.8) {
        hands = null;
        crouch = 0.8;
        cover = 1;
        armsUp = 0;
        m.lean = 0.35;
        mouth = "shock";
      }
      const r = st.reactions[side];
      if (r && t >= r.start && t < r.until) {
        const k = t - r.start;
        hands = null;
        if (r.kind === "cheer" || r.kind === "relief") {
          armsUp = r.kind === "cheer" ? 1 : 0.7;
          m.lean = -0.06;
          m.headPitch = -0.2;
          mouth = "grin";
          if (!quiet && r.kind === "cheer") hop = Math.abs(Math.sin(k * 8 + i)) * 0.4 * Math.exp(-k * 0.6);
        } else {
          crouch = 0.25;
          cover = 1;
          m.lean = 0.16;
          m.headPitch = 0.3;
          mouth = "shock";
        }
      }
      // Bitiş: kazananlar sevinir, kaybedenler yıkılan kulenin önünde çöker.
      if (fin && (inp.winner === 0 || inp.winner === 1)) {
        const col = towers[1 - inp.winner].collapseStart;
        if (col !== null) {
          const k = t - col;
          hands = null;
          m.yaw = Math.atan2(d * 0.3, 1);
          if (side === inp.winner) {
            armsUp = 1;
            cover = 0;
            crouch = 0;
            m.lean = -0.06;
            m.headPitch = -0.2;
            mouth = "grin";
            hop = !quiet && k < 4.5 ? Math.abs(Math.sin(k * 7 + i * 1.3)) * 0.42 : 0;
          } else {
            crouch = 0.85;
            cover = 1;
            armsUp = 0;
            m.lean = 0.3;
            m.headPitch = 0.35;
            mouth = "shock";
          }
        }
      } else if (fin && inp.winner === "draw") {
        hands = null;
        armsUp = 0.35;
        mouth = "focus";
      }

      stance(m, crouch, hop, armsUp, cover);
      if (hands) {
        if (hands[0]) toBody(m, hands[0].x, hands[0].y, hands[0].z, m.handL);
        if (hands[1]) toBody(m, hands[1].x, hands[1].y, hands[1].z, m.handR);
      }
      // Duruşu yumuşakça hedefe taşı.
      const cur = motion[i];
      const kk = quiet ? 1 : follow(14, dt);
      cur.x = lerp(cur.x, m.x, kk);
      cur.z = lerp(cur.z, m.z, kk);
      // Zıplama anlıktır; yumuşatılırsa sevinç sönük kalır.
      baseHip[i] = lerp(baseHip[i], m.hip - hop, kk);
      cur.hip = baseHip[i] + hop;
      cur.yaw = turnTo(cur.yaw, m.yaw, kk);
      cur.lean = lerp(cur.lean ?? 0, m.lean ?? 0, kk);
      cur.headPitch = lerp(cur.headPitch ?? 0, m.headPitch ?? 0, kk);
      mix(cur.footL, m.footL, 1);
      mix(cur.footR, m.footR, 1);
      mix(cur.handL, m.handL, kk);
      mix(cur.handR, m.handR, kk);
      cur.mouth = mouth;
      crew[i].poseBody(cur, t);
      const b = crewBlobs[i];
      b.visible = !settings.shadows;
      b.position.set(cur.x, 0.03, cur.z);
    });
    held.visible = heldBy >= 0;
    if (heldBy >= 0) held.position.copy(crew[heldBy].handsCentre(handsV));

    // -- parçacıklar, parlama, manzara --
    dust.update(dt);
    chips.update(dt);
    land.update(dt, inp.wind, still);
    if (st.flash && f) {
      const k = (t - st.flash.start) / 0.5;
      flash.visible = !quiet && k < 1;
      flash.position.set(f.flight.to.x, f.flight.to.y, 0.4);
      flash.scale.setScalar(1 + 8 * easeOut(clamp01(k)));
      flash.material.opacity = 0.9 * (1 - clamp01(k));
      if (k > 1) st.flash = null;
    } else flash.visible = false;

    // -- kamera --
    // Kurulurken atan mancınık, nişan alırken hedef kule; atışta taşın bütün yolu görünür.
    let shot: CamShot = OVERVIEW;
    let rate = 3.2;
    const cockShot = (side: 0 | 1): CamShot => {
      const cx = CATAPULT_X[side];
      const d = dirOf(side);
      return { pos: { x: cx + d * 6.5, y: 3.5, z: 12.5 }, look: { x: cx - d * 0.6, y: 1.9, z: 0 }, fitW: 9.5, fitH: 5.6 };
    };
    if (flying) {
      shot = { pos: { x: stonePos.x * 0.3, y: 8, z: 46 }, look: { x: stonePos.x * 0.45, y: 7.4, z: 0 }, fitW: 43, fitH: 17 };
      rate = 4.5;
    } else if (aiming) {
      const side = inp.shooter!;
      if (aimElapsed < 1050) shot = cockShot(side);
      else {
        const tx = TOWER_X[1 - side];
        const d = dirOf(side);
        shot = { pos: { x: tx - d * 15, y: 6, z: 18 }, look: { x: tx + d * 0.7, y: 4.6, z: 0 }, fitW: 10.5, fitH: 13 };
      }
    } else if (fin?.honor && !fin.fired && (inp.winner === 0 || inp.winner === 1)) {
      shot = cockShot(inp.winner);
    } else if (st.flight || inp.phase === "shot" || inp.phase === "finished") {
      shot = WIDE;
    }
    const falling = ([0, 1] as const).find((s) => towers[s].collapseStart !== null && !towers[s].collapsed(t));
    if (falling !== undefined && !quiet) {
      const tau = t - towers[falling].collapseStart!;
      const tx = TOWER_X[falling];
      const toward = dirOf(falling);
      const az = lerp(0.95, 0.3, easeInOut(clamp01(tau / COLLAPSE_SECONDS)));
      shot = { pos: { x: tx + toward * Math.sin(az) * 23, y: 7.5, z: Math.cos(az) * 23 }, look: { x: tx - toward * 0.8, y: lerp(4.6, 2.4, clamp01(tau / 1.6)), z: 0 }, fitW: 15, fitH: 11.5 };
      rate = 2.6;
    } else if (st.punch && t < st.punch.until) {
      const p = st.punch;
      shot = { pos: { x: p.x - p.d * 10, y: p.y * 0.5 + 3.6, z: 15 }, look: { x: p.x + p.d * 0.9, y: Math.max(2.6, Math.min(7, p.y)), z: 0 }, fitW: 10, fitH: 9 };
      rate = 6;
    }
    const kk = quiet || st.cut ? 1 : follow(rate, dt);
    st.cut = false;
    st.cam.pos.x = lerp(st.cam.pos.x, shot.pos.x, kk);
    st.cam.pos.y = lerp(st.cam.pos.y, shot.pos.y, kk);
    st.cam.pos.z = lerp(st.cam.pos.z, shot.pos.z, kk);
    st.cam.look.x = lerp(st.cam.look.x, shot.look.x, kk);
    st.cam.look.y = lerp(st.cam.look.y, shot.look.y, kk);
    st.cam.look.z = lerp(st.cam.look.z, shot.look.z, kk);
    st.cam.fitW = lerp(st.cam.fitW, shot.fitW, kk);
    st.cam.fitH = lerp(st.cam.fitH, shot.fitH, kk);
    st.shake *= Math.exp(-dt * 6);
    const sx = quiet ? 0 : Math.sin(t * 61) * st.shake;
    const sy = quiet ? 0 : Math.cos(t * 47) * st.shake * 0.7;
    camera.position.set(st.cam.pos.x + sx, st.cam.pos.y + sy, st.cam.pos.z);
    camera.lookAt(st.cam.look);
    const dist = st.cam.pos.distanceTo(st.cam.look);
    camera.fov = (2 * Math.atan(Math.max(st.cam.fitH / 2, st.cam.fitW / 2 / st.aspect) / dist) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // -- hasar yazısı: isabet noktasının üstünde, yukarı süzülür --
    if (st.popup) {
      const k = t - st.popup.start;
      proj.copy(st.popup.anchor).project(camera);
      const px = Math.max(0.16, Math.min(0.84, proj.x * 0.5 + 0.5));
      const py = Math.max(0.32, Math.min(0.8, -proj.y * 0.5 + 0.5));
      o.ui.place(px * st.width, py * st.height - k * 16);
      if (k > 2.2) {
        st.popup = null;
        o.ui.popup(null);
      }
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  let raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      rulerTex.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
