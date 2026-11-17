import confetti from "canvas-confetti";
import * as THREE from "three";
import { cssColor } from "@/lib/color";
import { sfx } from "@/lib/sound";
import { DARK, HAIR, PANTS, SKIN } from "../../shared/kid";
import { FIGURE, KidFigure, type FigureLook, type Mouth } from "../../shared/stage3d/figure";
import { canvasTexture, clamp01, createRenderer, disposeTree, easeInOut, easeOut, follow, glowTexture, lerp, tierSettings, tokenColor } from "../../shared/stage3d/kit";
import { createFrameWatch, type Tier } from "../../shared/stage3d/support";
import { penaltyAudio } from "../audio";
import { classify, KICK_LOCK_MS, type KickResult } from "../logic";
import { KICKER_LOOKS, type ArtTeam } from "../scene/art";
import type { SceneInput } from "../scene/PenaltyScene";
import { buildStadium } from "./stadium";
import { ballAt, CONTACT, FLIGHT, flightPoint, KEEPER_READY_HANDS, keeperAt, kickerStrike, kickTarget, LIVE_END, netBulgeAt, planKick, REPLAY_SECONDS, replayTau, STRIKE, type BallState, type KeeperPose, type KickPlan } from "./timeline";
import { BALL_R, GOAL_H, GOAL_HALF, KEEPER_HIP_Y, KEEPER_Z, KICKER_HOME, KICKER_READY, NET_DEPTH_BOTTOM, SPOT, type V3 } from "./world";

/**
 * Penaltı sahnesinin üç boyutlu motoru. Oyun mantığından özet bir girdi alır ve bütün hareketi tek bir
 * requestAnimationFrame döngüsünde çizer: şutçunun koşusu ve vuruşu, topun falsolu uçuşu, kalecinin
 * uçuşu, ağın esnemesi, tribünün coşkusu, kameranın topu izlemesi ve ağır çekim tekrar.
 *
 * Şutçu sahneye dokunup parmağını kalede istediği yere sürükler ve bırakır; motor parmağın altındaki
 * noktayı kale düzlemine ışın izleyerek bulur ve `onKick` ile bildirir. Sonucu oyun mantığı hesaplar.
 */

export type EngineHandlers = {
  onKick: (x: number, y: number) => void;
  /** Top kaleye, kaleciye ya da direğe ulaştı: skor bu anda güncellenir. */
  onContact: (index: number) => void;
  onKickDone: (index: number) => void;
  onFinale: () => void;
};

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  tier: Tier;
  teams: [ArtTeam, ArtTeam];
  getInput: () => SceneInput;
  isReducedMotion: () => boolean;
  handlers: () => EngineHandlers;
  /** Sahnenin üstündeki yazılar React tarafında çizilir. */
  ui: { banner: (result: KickResult | null, side: 0 | 1) => void; replay: (on: boolean) => void };
  onTier: (tier: Tier) => void;
  /**
   * Tahta 3D'yi en düşük kademede de akıcı çizemiyor (`slow`) ya da çizim bağlamı kayboldu (`lost`).
   * `true` dönerse sahne değiştirilecektir ve motor durur; `false` dönerse çizmeye devam eder.
   */
  onGiveUp: (reason: "slow" | "lost") => boolean;
};

type Shot = { pos: V3; look: V3; fitW: number; fitH: number };

const QUESTION_SHOT: Shot = { pos: { x: 0, y: 2.7, z: 25 }, look: { x: 0, y: 1.35, z: 2 }, fitW: 13.5, fitH: 4.9 };
const AIM_SHOT: Shot = { pos: { x: 0, y: 7.4, z: 33 }, look: { x: 0, y: 0.55, z: 4.5 }, fitW: 10.5, fitH: 7.4 };

const KEEPER_SCALE = 1.06;
const KICKER_SCALE = 0.92;
const ANKLE = FIGURE.ankle;

type Mood = "calm" | "cheer" | "dismay" | "shrug";

type BodyMotion = {
  x: number;
  z: number;
  hip: number;
  yaw: number;
  footL: V3;
  footR: V3;
  handL: V3;
  handR: V3;
  lean?: number;
  twist?: number;
  toeL?: number;
  mouth?: Mouth;
  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
};

function ballTexture() {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => {
    const l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l];
  });
  const light = new THREE.Color(cssColor("var(--color-cream)"));
  const dark = new THREE.Color(cssColor("var(--color-ink-950)"));
  const seam = new THREE.Color(cssColor("var(--color-ink-400)"));
  return canvasTexture(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const theta = ((y + 0.5) / h) * Math.PI;
      for (let x = 0; x < w; x++) {
        const phi = ((x + 0.5) / w) * Math.PI * 2;
        const dx = -Math.cos(phi) * Math.sin(theta);
        const dy = Math.cos(theta);
        const dz = Math.sin(phi) * Math.sin(theta);
        let best = -1;
        let second = -1;
        for (const v of verts) {
          const d = dx * v[0] + dy * v[1] + dz * v[2];
          if (d > best) {
            second = best;
            best = d;
          } else if (d > second) second = d;
        }
        // Her beşgenin ortasında koyu bir benek, beşgenlerin arasında ince dikiş.
        const c = best > 0.935 ? dark : best - second < 0.014 ? seam : light;
        const i = (y * w + x) * 4;
        img.data[i] = c.r * 255;
        img.data[i + 1] = c.g * 255;
        img.data[i + 2] = c.b * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

export function createPenaltyEngine(o: EngineOptions): { dispose: () => void } {
  const { canvas, teams } = o;
  let tier = o.tier;
  let settings = tierSettings(tier);
  const renderer = createRenderer(canvas, tier);
  const watch = createFrameWatch(tier);

  const scene = new THREE.Scene();
  scene.background = tokenColor("var(--color-ink-950)");
  scene.fog = new THREE.Fog(tokenColor("var(--color-ink-900)"), 45, 170);
  const camera = new THREE.PerspectiveCamera(20, 2, 0.5, 400);

  // ---- ışıklar: gökten yumuşak dolgu, sahaya bakan ana projektör, arkadan iki kontur ışığı ----
  scene.add(new THREE.HemisphereLight(tokenColor("var(--color-ink-300)"), tokenColor("var(--color-saha)"), 2.4));
  const key = new THREE.DirectionalLight(tokenColor("var(--color-cream)"), 4.6);
  key.position.set(-13, 30, 26);
  key.target.position.set(0, 0, 5);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(settings.shadowSize);
  key.shadow.camera.left = -13;
  key.shadow.camera.right = 13;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -12;
  key.shadow.camera.near = 8;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rimA = new THREE.DirectionalLight(tokenColor("var(--color-ink-300)"), 2.2);
  rimA.position.set(18, 14, -12);
  const rimB = new THREE.DirectionalLight(tokenColor("var(--color-firuze)"), 1.1);
  rimB.position.set(-16, 9, -14);
  scene.add(rimA, rimB);

  const stadium = buildStadium(teams, settings);
  scene.add(stadium.group);

  // ---- karakterler ----
  const teamBases = teams.map((t) => t.base);
  const keeperShirt = ["var(--color-kehribar)", "var(--color-firuze)", "var(--color-zumrut)"].find((c) => !teamBases.includes(c)) ?? "var(--color-kehribar)";
  const keeper = new KidFigure({
    skin: SKIN[0],
    hair: HAIR[1],
    hairStyle: "short",
    shirt: keeperShirt,
    trim: keeperShirt.replace(")", "-deep)"),
    shorts: DARK,
    socks: keeperShirt.replace(")", "-deep)"),
    boots: DARK,
    number: "1",
    numberOn: "front",
    numberColor: "var(--color-ink-950)",
    gloves: "var(--color-cream)",
    headband: "var(--color-mercan)",
    scale: KEEPER_SCALE,
  });
  keeper.root.rotation.order = "ZYX";
  scene.add(keeper.root);
  const kickers = ([0, 1] as const).map((side) => {
    const look: FigureLook = {
      skin: KICKER_LOOKS[side].skin,
      hair: KICKER_LOOKS[side].hair,
      hairStyle: side === 0 ? "short" : "curly",
      shirt: teams[side].base,
      trim: teams[side].deep,
      shorts: PANTS,
      socks: teams[side].deep,
      boots: DARK,
      number: KICKER_LOOKS[side].number,
      numberOn: "back",
      scale: KICKER_SCALE,
    };
    const fig = new KidFigure(look);
    scene.add(fig.root);
    return fig;
  });

  // ---- top ----
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 18), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45, metalness: 0 }));
  ball.castShadow = true;
  scene.add(ball);

  // Uçan topun arkasında kısa bir iz, temas anında bir parlama: hız ve çarpma uzaktan okunur.
  const glow = glowTexture(64);
  const TRAIL = 6;
  const trail = Array.from({ length: TRAIL }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: tokenColor("var(--color-cream)"), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 * (1 - i / TRAIL), fog: false }));
    sprite.scale.setScalar(BALL_R * (3 - i * 0.3));
    sprite.visible = false;
    scene.add(sprite);
    return sprite;
  });
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: tokenColor("var(--color-kehribar)"), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0, fog: false }));
  flash.visible = false;
  scene.add(flash);

  // Gölge haritası kapalıyken (düşük kademe) karakterlerin ve topun altına yuvarlak gölge konur.
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  const blobGeo = new THREE.CircleGeometry(1, 20);
  const blobs = [0.2, 0.42, 0.36, 0.36].map((r) => {
    const m = new THREE.Mesh(blobGeo, blobMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(r);
    m.userData.r = r;
    m.renderOrder = 1;
    scene.add(m);
    return m;
  });
  const setBlob = (i: number, x: number, z: number, height: number) => {
    const b = blobs[i];
    b.visible = !settings.shadows;
    const k = clamp01(1 - height / 3);
    b.position.set(x, 0.02, z);
    b.scale.setScalar(b.userData.r * (0.6 + 0.4 * k));
  };

  // ---- nişan: hedef halkası ve topun izleyeceği yol ----
  const aimGroup = new THREE.Group();
  const aimMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, fog: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.29, 36), aimMat);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), aimMat);
  ring.renderOrder = dot.renderOrder = 5;
  aimGroup.add(ring, dot);
  const DOTS = 14;
  const dotMat = new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-cream)"), transparent: true, opacity: 0.9, fog: false });
  const pathDots = Array.from({ length: DOTS }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), dotMat);
    aimGroup.add(m);
    return m;
  });
  aimGroup.visible = false;
  scene.add(aimGroup);

  // ---- parçacıklar: yere düşen kalecinin ve seken topun kaldırdığı çim ----
  const PARTICLES = 48;
  const pPos = new Float32Array(PARTICLES * 3);
  const pCol = new Float32Array(PARTICLES * 4);
  const pVel = new Float32Array(PARTICLES * 3);
  const pLife = new Float32Array(PARTICLES);
  const pMax = new Float32Array(PARTICLES);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 4).setUsage(THREE.DynamicDrawUsage));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: glow, size: 0.5, vertexColors: true, transparent: true, depthWrite: false }));
  particles.frustumCulled = false;
  scene.add(particles);
  const turf = tokenColor("var(--color-saha-acik)").lerp(tokenColor("var(--color-cream)"), 0.35);
  let pNext = 0;
  const puff = (x: number, z: number, n: number, power: number) => {
    if (o.isReducedMotion()) return;
    for (let k = 0; k < n; k++) {
      const i = pNext++ % PARTICLES;
      pPos.set([x + (Math.random() - 0.5) * 0.5, 0.08, z + (Math.random() - 0.5) * 0.5], i * 3);
      pVel.set([(Math.random() - 0.5) * 2.4 * power, (0.8 + Math.random() * 1.8) * power, (Math.random() - 0.5) * 2.4 * power], i * 3);
      pLife[i] = 0;
      pMax[i] = 0.5 + Math.random() * 0.5;
    }
  };

  // ---- durum ----
  const start = o.getInput();
  const kickView = (p: SceneInput["phase"]) => p === "kick" || p === "result" || p === "finished";
  const st = {
    time: 0,
    clock: 0,
    last: performance.now(),
    seenKicks: start.kicks.length,
    plan: null as KickPlan | null,
    planStart: 0,
    struck: false,
    contacted: false,
    netSound: false,
    landed: false,
    bannered: false,
    doneCalled: false,
    bounce: 0,
    replay: null as null | { start: number },
    replayed: false,
    celebrate: null as null | { side: 0 | 1; start: number },
    postHit: null as null | { start: number },
    shake: 0,
    cut: true,
    cam: { pos: new THREE.Vector3(), look: new THREE.Vector3(), fitW: 12, fitH: 6 },
    kicker: [
      { x: KICKER_HOME[0].x, z: KICKER_HOME[0].z, yaw: Math.PI },
      { x: KICKER_HOME[1].x, z: KICKER_HOME[1].z, yaw: Math.PI },
    ],
    keeper: { x: 0, y: KEEPER_HIP_Y, z: KEEPER_Z, roll: 0 },
    finale: null as null | { start: number; called: boolean; confetti: boolean },
    lastPhase: start.phase,
    aiming: null as null | { id: number; gx: number; gy: number },
    whistled: start.kickStart,
    aspect: 2,
  };
  // Bitmiş bir oyun yeniden açıldıysa gösteri atlanır.
  if (start.phase === "finished") st.finale = { start: -10, called: false, confetti: true };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    st.aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = st.aspect;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const applyTier = (next: Tier) => {
    tier = next;
    settings = tierSettings(next);
    renderer.setPixelRatio(settings.pixelRatio);
    renderer.shadowMap.enabled = settings.shadows;
    // Gölge haritası yeni boyutla yeniden kurulsun.
    key.shadow.mapSize.setScalar(settings.shadowSize);
    key.shadow.map?.dispose();
    key.shadow.map = null;
    stadium.setDetail(settings);
    scene.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) m.needsUpdate = true;
    });
    resize();
    o.onTier(next);
  };

  // ---- nişan: sürükle ve bırak ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const pointToGoal = (e: PointerEvent): { gx: number; gy: number } | null => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(goalPlane, hit)) return null;
    // Kalenin önündeki çime uzanan parmak yerden bir şut demektir; çok uzağa giden nişan sınırlanır.
    return { gx: Math.max(-2.4, Math.min(2.4, hit.x / GOAL_HALF)), gy: Math.max(0.04, Math.min(2.3, hit.y / GOAL_H)) };
  };
  const canAim = () => {
    const inp = o.getInput();
    return inp.phase === "kick" && inp.kickStart !== null && Date.now() - inp.kickStart >= KICK_LOCK_MS && inp.kicks.length === st.seenKicks;
  };
  const setAimAttr = () => {
    if (st.aiming) canvas.dataset.aim = `${st.aiming.gx.toFixed(3)},${st.aiming.gy.toFixed(3)}`;
    else delete canvas.dataset.aim;
  };
  const onDown = (e: PointerEvent) => {
    if (!canAim() || st.aiming || (e.pointerType === "mouse" && e.button !== 0)) return;
    const g = pointToGoal(e);
    if (!g) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    st.aiming = { id: e.pointerId, ...g };
    setAimAttr();
  };
  const onMove = (e: PointerEvent) => {
    if (!st.aiming || st.aiming.id !== e.pointerId) return;
    const g = pointToGoal(e);
    if (g) st.aiming = { id: e.pointerId, ...g };
    setAimAttr();
  };
  const onUp = (e: PointerEvent) => {
    if (!st.aiming || st.aiming.id !== e.pointerId) return;
    const g = pointToGoal(e) ?? st.aiming;
    st.aiming = null;
    setAimAttr();
    if (canAim()) o.handlers().onKick(g.gx, g.gy);
  };
  const onCancel = () => {
    st.aiming = null;
    setAimAttr();
  };
  let stopped = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    stopped = true;
    o.onGiveUp("lost");
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("webglcontextlost", onLost);

  // ---- karakter yerleştirme ----
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const vD = new THREE.Vector3();
  const applyBody = (fig: KidFigure, scale: number, m: BodyMotion) => {
    fig.root.position.set(m.x, m.hip, m.z);
    fig.root.rotation.set(0, m.yaw, 0);
    const local = (v: V3, out: THREE.Vector3) => out.set(v.x / scale, (v.y - m.hip) / scale, v.z / scale);
    fig.pose(
      { footL: local(m.footL, vA), footR: local(m.footR, vB), handL: local(m.handL, vC), handR: local(m.handR, vD), lean: m.lean, twist: m.twist, toeL: m.toeL, mouth: m.mouth, headYaw: m.headYaw, headPitch: m.headPitch, headRoll: m.headRoll },
      st.clock,
    );
  };

  /** Ayakta duran şutçunun temel pozu ve ruh hâline göre kolları, zıplaması. */
  const standing = (side: 0 | 1, x: number, z: number, yaw: number, mood: Mood, quiet: boolean, gait: number): BodyMotion => {
    const s = KICKER_SCALE;
    const stand = 0.8 * s;
    const ground = ANKLE * s;
    const t = st.time;
    const m: BodyMotion = {
      x,
      z,
      yaw,
      hip: stand,
      footL: { x: -0.1 * s, y: ground, z: 0 },
      footR: { x: 0.1 * s, y: ground, z: 0 },
      handL: { x: -0.3 * s, y: stand + 0.02, z: 0.05 },
      handR: { x: 0.3 * s, y: stand + 0.02, z: 0.05 },
      lean: 0.05,
      mouth: "smile",
    };
    if (gait > 0) {
      // Yürüyüş: ayaklar sırayla kalkar, kollar çapraz sallanır.
      const ph = gait;
      const stride = 0.22 * s;
      m.footL = { x: -0.1 * s, y: ground + Math.max(0, Math.sin(ph)) * 0.12 * s, z: Math.cos(ph) * stride };
      m.footR = { x: 0.1 * s, y: ground + Math.max(0, -Math.sin(ph)) * 0.12 * s, z: -Math.cos(ph) * stride };
      m.handL = { x: -0.3 * s, y: stand + 0.04, z: -Math.cos(ph) * 0.2 * s };
      m.handR = { x: 0.3 * s, y: stand + 0.04, z: Math.cos(ph) * 0.2 * s };
      m.hip = stand - 0.02 * s + Math.abs(Math.sin(ph)) * 0.025 * s;
      m.lean = 0.14;
    }
    if (mood === "cheer") {
      const hop = quiet ? 0 : Math.abs(Math.sin(t * 7 + side * 1.3)) * 0.34;
      const pump = quiet ? 0 : Math.sin(t * 14 + side) * 0.07;
      m.hip = stand + hop;
      m.footL = { x: -0.13 * s, y: ground + hop * 0.82, z: 0.02 };
      m.footR = { x: 0.13 * s, y: ground + hop * 0.82, z: 0.02 };
      m.handL = { x: -0.34 * s, y: m.hip + (1.02 + pump) * s, z: 0.08 };
      m.handR = { x: 0.34 * s, y: m.hip + (1.02 - pump) * s, z: 0.08 };
      m.mouth = "grin";
      m.lean = -0.08;
      m.headPitch = -0.2;
    } else if (mood === "dismay") {
      m.handL = { x: -0.15 * s, y: m.hip + 0.83 * s, z: 0.1 * s };
      m.handR = { x: 0.15 * s, y: m.hip + 0.83 * s, z: 0.1 * s };
      m.mouth = "shock";
      m.lean = 0.16;
      m.headPitch = 0.3;
      m.headRoll = side === 0 ? 0.12 : -0.12;
    } else if (mood === "shrug") {
      m.handL = { x: -0.5 * s, y: stand + 0.26 * s, z: 0.12 * s };
      m.handR = { x: 0.5 * s, y: stand + 0.26 * s, z: 0.12 * s };
      m.mouth = "focus";
    }
    return m;
  };

  const kHand = [new THREE.Vector3(), new THREE.Vector3()];
  const kFoot = [new THREE.Vector3(), new THREE.Vector3()];
  const applyKeeper = (p: KeeperPose, lean: number, ballWorld: THREE.Vector3 | null) => {
    const root = keeper.root;
    root.position.set(p.hip.x, p.hip.y, p.hip.z);
    root.rotation.set(0, 0, -p.roll);
    root.updateMatrixWorld(true);
    for (const i of [0, 1] as const) {
      if (p.hands) root.worldToLocal(kHand[i].set(p.hands[i].x, p.hands[i].y, p.hands[i].z));
      else kHand[i].copy(p.handsLocal![i] as THREE.Vector3);
      const sign = i === 0 ? -1 : 1;
      if (p.grounded) {
        // Ayaklar yerde kalır; çöktükçe açılır.
        const spread = 0.17 + Math.max(0, KEEPER_HIP_Y - p.hip.y) * 0.55;
        root.worldToLocal(kFoot[i].set(p.hip.x + sign * spread, ANKLE * KEEPER_SCALE, p.hip.z + 0.03));
      } else {
        // Havada bacaklar geride süzülür: itiş bacağı gergin, öbürü dizden kırık.
        const lead = (p.roll >= 0 ? 1 : -1) === sign;
        const k = p.stretch * (lead ? 1 : 0.5);
        kFoot[i].set(sign * lerp(0.14, 0.1, k), lerp(-0.46, -0.76, k), lerp(0.2, -0.05, k));
      }
    }
    let headYaw = 0;
    let headPitch = 0;
    if (ballWorld && !p.holding && Math.abs(p.roll) < 0.5) {
      // Dik dururken gözü toptadır.
      const dx = ballWorld.x - p.hip.x;
      const dy = ballWorld.y - (p.hip.y + 0.7);
      const dz = Math.max(0.4, ballWorld.z - p.hip.z);
      headYaw = Math.max(-0.7, Math.min(0.7, Math.atan2(dx, dz)));
      headPitch = Math.max(-0.4, Math.min(0.3, -Math.atan2(dy, Math.hypot(dx, dz))));
    }
    keeper.pose({ footL: kFoot[0], footR: kFoot[1], handL: kHand[0], handR: kHand[1], lean, mouth: p.mouth, headYaw, headPitch, toeL: p.grounded ? 0 : 0.6, toeR: p.grounded ? 0 : 0.6 }, st.clock);
  };

  const ballState: BallState = { p: { x: 0, y: 0, z: 0 }, q: [0, 0, 0, 1], visible: true, held: false, phase: "spot" };
  const ballWorld = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const flightTmp: V3 = { x: 0, y: 0, z: 0 };

  // ---- kare döngüsü ----
  const frame = (now: number) => {
    if (stopped) return;
    const realMs = now - st.last;
    const realDt = Math.min(0.05, realMs / 1000);
    st.last = now;
    st.clock += realDt;
    const inp = o.getInput();
    const quiet = o.isReducedMotion();
    const wall = Date.now();

    // -- kalite: sahne akmıyorsa bir kademe iner, en altta da akmıyorsa çizim sahnesine döner --
    const verdict = watch.sample(realMs);
    if (verdict === "in") applyTier(watch.tier);
    else if (verdict === "vazgec" && o.onGiveUp("slow")) return;

    // -- şutçu topun başına geldi: hakem düdüğü --
    if (inp.phase === "kick" && inp.kickStart !== null && inp.kickStart !== st.whistled && wall - inp.kickStart >= KICK_LOCK_MS - 150) {
      st.whistled = inp.kickStart;
      if (wall - inp.kickStart < KICK_LOCK_MS + 1500) penaltyAudio.whistle();
    }

    // -- yeni şut --
    if (inp.kicks.length > st.seenKicks) {
      const index = inp.kicks.length - 1;
      st.seenKicks = inp.kicks.length;
      st.plan = planKick(inp.kicks[index], index);
      st.planStart = st.time;
      st.struck = st.contacted = st.netSound = st.landed = st.bannered = st.doneCalled = st.replayed = false;
      st.bounce = 0;
      st.replay = null;
      st.aiming = null;
      setAimAttr();
    }

    // -- soru açılınca sahne sıfırlanır --
    if (inp.phase !== st.lastPhase) {
      if (inp.phase === "question") {
        st.plan = null;
        st.celebrate = null;
        if (st.replay) o.ui.replay(false);
        st.replay = null;
        o.ui.banner(null, 0);
      }
      if (kickView(inp.phase) !== kickView(st.lastPhase) && quiet) st.cut = true;
      st.lastPhase = inp.phase;
    }

    // -- zaman: temas anında kısa bir ağır çekim --
    const plan = st.plan;
    let scale = 1;
    if (plan && !quiet && !st.replay) {
      const t = st.time - st.planStart;
      if (plan.kick.result === "kurtardi" && t > CONTACT - 0.1 && t < CONTACT + 0.12) scale = 0.3;
      else if (plan.kick.result === "gol" && t > CONTACT - 0.04 && t < CONTACT + 0.14) scale = 0.45;
    }
    const dt = realDt * scale;
    st.time += dt;
    const time = st.time;
    const liveTau = plan ? time - st.planStart : 0;

    // -- tekrar: gol, kurtarış ve direk başka bir kameradan ağır çekimde yeniden oynar --
    if (plan && !quiet && !st.replay && !st.replayed && liveTau > LIVE_END && plan.kick.result !== "aut") {
      st.replay = { start: st.clock };
      st.cut = true;
      o.ui.replay(true);
    }
    if (st.replay && st.clock - st.replay.start > REPLAY_SECONDS + 0.35) {
      st.replay = null;
      st.replayed = true;
      st.cut = true;
      o.ui.replay(false);
    }
    const replaying = st.replay !== null && plan !== null;
    /** Sahnenin gösterdiği şut anı: canlıda geçen süre, tekrarda yavaşlatılmış süre. */
    const tau = replaying ? replayTau(st.clock - st.replay!.start) : liveTau;

    // -- canlı olaylar: ses, skor, yazı (tekrarda yeniden çalmaz) --
    if (plan) {
      const k = plan.kick;
      if (!st.struck && liveTau >= STRIKE) {
        st.struck = true;
        penaltyAudio.kick();
      }
      if (!st.contacted && liveTau >= CONTACT) {
        st.contacted = true;
        o.handlers().onContact(plan.index);
        if (k.result === "gol") {
          st.celebrate = { side: k.side, start: time };
          penaltyAudio.crowdGoal();
          penaltyAudio.say("gol", 0.15);
          if (!quiet) {
            const colors = [teams[k.side].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor);
            confetti({ particleCount: 90, spread: 100, startVelocity: 46, origin: { x: 0.5, y: 0.35 }, colors, disableForReducedMotion: true });
          }
        } else if (k.result === "kurtardi") {
          st.shake = 0.22;
          penaltyAudio.gloves();
          penaltyAudio.crowdApplause();
          penaltyAudio.say("kurtaris", 0.2);
        } else if (k.result === "direk") {
          st.postHit = { start: st.clock };
          st.shake = 0.14;
          penaltyAudio.post();
          penaltyAudio.crowdOoh();
          penaltyAudio.say("direk", 0.2);
        } else {
          penaltyAudio.crowdOoh();
          penaltyAudio.say("aut", 0.25);
        }
      }
      if (!st.netSound && plan.net && liveTau >= plan.net.at - 0.03) {
        st.netSound = true;
        penaltyAudio.net();
      }
      while (st.bounce < plan.bounces.length && liveTau >= plan.bounces[st.bounce].at) {
        const b = plan.bounces[st.bounce++];
        if (b.speed > 2.2) puff(b.x, b.z, 4, Math.min(1, b.speed / 6));
      }
      if (!st.bannered && liveTau > CONTACT + 0.16) {
        st.bannered = true;
        o.ui.banner(k.result, k.side);
      }
      if (!st.doneCalled && liveTau > LIVE_END) {
        st.doneCalled = true;
        o.handlers().onKickDone(plan.index);
      }
    }

    // -- top --
    let ballVisible = true;
    if (plan) {
      ballAt(plan, tau, ballState);
      ballWorld.set(ballState.p.x, ballState.p.y, ballState.p.z);
      ball.quaternion.set(ballState.q[0], ballState.q[1], ballState.q[2], ballState.q[3]);
      ballVisible = ballState.visible;
    } else {
      ballWorld.set(SPOT.x, SPOT.y, SPOT.z);
      ball.quaternion.identity();
    }

    // -- kaleci --
    let kp: KeeperPose;
    let keeperLean = 0.05;
    if (plan) {
      kp = keeperAt(plan, tau);
      if (!st.landed && kp.landed && !replaying) {
        st.landed = true;
        puff(kp.hip.x, kp.hip.z, 12, 1);
        sfx.thump();
      }
      keeperLean = tau < CONTACT ? 0.2 * (1 - clamp01((tau - 0.42) / 0.2)) : 0.05;
      st.keeper = { x: kp.hip.x, y: kp.hip.y, z: kp.hip.z, roll: kp.roll };
    } else {
      // Şut beklerken parmak uçlarında yaylanır; öbür zamanlarda kalenin ortasında bekler.
      const live = inp.phase === "kick";
      const target = live && !quiet ? { x: Math.sin(time * 2.3) * 0.17, y: KEEPER_HIP_Y - 0.13 + Math.abs(Math.sin(time * 5.2)) * 0.05 } : { x: 0, y: KEEPER_HIP_Y - (live ? 0.13 : 0.03) };
      const k = quiet ? 1 : follow(5, realDt);
      st.keeper.x = lerp(st.keeper.x, target.x, k);
      st.keeper.y = lerp(st.keeper.y, target.y, k);
      st.keeper.z = lerp(st.keeper.z, KEEPER_Z, k);
      st.keeper.roll = lerp(st.keeper.roll, 0, k);
      keeperLean = live ? 0.24 : 0.05;
      kp = {
        hip: { x: st.keeper.x, y: st.keeper.y, z: st.keeper.z },
        roll: st.keeper.roll,
        hands: null,
        handsLocal: live ? KEEPER_READY_HANDS : RELAXED_HANDS,
        mouth: "focus",
        grounded: Math.abs(st.keeper.roll) < 0.4,
        landed: false,
        holding: false,
        stretch: 0.7,
      };
    }
    applyKeeper(kp, keeperLean, ballWorld);
    if (plan && ballState.held && tau > CONTACT) {
      // Ortadaki kurtarışta top eldivenlerde kalır.
      keeper.handsCentre(ballWorld);
      ballWorld.z += 0.1;
    }
    ball.position.copy(ballWorld);
    ball.visible = ballVisible;

    // -- topun izi (uçuş boyunca) ve temas parlaması (kurtarış, direk) --
    const flying = plan !== null && !quiet && ballState.phase === "flight";
    trail.forEach((sprite, i) => {
      const u = flying ? (tau - STRIKE) / FLIGHT - (i + 1) * 0.035 : -1;
      sprite.visible = u > 0;
      if (u > 0) {
        flightPoint(plan!.target, u, flightTmp);
        sprite.position.set(flightTmp.x, flightTmp.y, flightTmp.z);
      }
    });
    const sinceContact = plan ? tau - CONTACT : -1;
    const sparks = plan !== null && !quiet && (plan.kick.result === "kurtardi" || plan.kick.result === "direk") && sinceContact > 0 && sinceContact < 0.45;
    flash.visible = sparks;
    if (sparks) {
      const k = sinceContact / 0.45;
      flash.position.set(plan!.target.x, plan!.target.y, 0.3);
      flash.scale.setScalar(0.6 + easeOut(k) * 2.6);
      flash.material.opacity = 0.9 * (1 - k);
      flash.material.color.copy(tokenColor(plan!.kick.result === "kurtardi" ? "var(--color-kehribar)" : "var(--color-cream)"));
    }
    setBlob(0, ballWorld.x, ballWorld.z, ballVisible ? ballWorld.y : 99);
    setBlob(1, kp.hip.x, kp.hip.z, kp.hip.y - KEEPER_HIP_Y + Math.abs(kp.roll));

    // -- şutçular --
    const decided = plan !== null && liveTau > CONTACT + 0.12;
    ([0, 1] as const).forEach((side) => {
      const ks = st.kicker[side];
      const home = KICKER_HOME[side];
      const shooting = inp.shooter === side && (inp.phase === "kick" || inp.phase === "result" || (inp.phase === "finished" && plan !== null));
      let mood: Mood = "calm";
      if (inp.phase === "question" && inp.locked[side]) mood = "dismay";
      if (inp.phase === "reveal") mood = "dismay";
      if (decided && plan && !replaying) {
        const goal = plan.kick.result === "gol";
        mood = plan.kick.side === side ? (goal ? "cheer" : "dismay") : goal ? "dismay" : "cheer";
      }
      if (inp.phase === "finished" && st.finale && (!plan || decided)) mood = inp.winner === "draw" ? "shrug" : inp.winner === side ? "cheer" : "dismay";

      let motion: BodyMotion;
      const striking = plan !== null && plan.kick.side === side && tau < STRIKE + 0.6;
      if (striking && plan) {
        const k = kickerStrike(tau, plan.target, KICKER_SCALE);
        motion = { ...k, mouth: "focus" };
        ks.x = k.x;
        ks.z = k.z;
        ks.yaw = k.yaw;
      } else {
        // Hedef: topun arkası (şut hakkı varken) ya da kendi köşesi.
        let tx = home.x;
        let tz = home.z;
        let facing = Math.PI;
        let walking = 0;
        if (shooting && !plan) {
          const walk = inp.kickStart !== null ? clamp01((wall - inp.kickStart) / 900) : 1;
          const e = easeInOut(walk);
          ks.x = lerp(home.x, KICKER_READY.x, e);
          ks.z = lerp(home.z, KICKER_READY.z, e);
          tx = ks.x;
          tz = ks.z;
          if (walk < 1) {
            facing = Math.atan2(KICKER_READY.x - home.x, KICKER_READY.z - home.z);
            walking = walk * Math.PI * 6;
          } else {
            // Topun başında: nişan alınan köşeye döner.
            const aimX = st.aiming ? st.aiming.gx * GOAL_HALF : 0;
            facing = Math.atan2(aimX * 0.4 - ks.x, -ks.z);
          }
        } else if (shooting && plan) {
          // Vuruştan sonra olduğu yerde tepki verir.
          tx = ks.x;
          tz = ks.z;
          facing = mood === "cheer" ? 0.25 : Math.PI;
        } else {
          // Köşesine yürüyerek döner.
          const dx = home.x - ks.x;
          const dz = home.z - ks.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.06 && !quiet) {
            const step = Math.min(dist, 3.4 * realDt);
            ks.x += (dx / dist) * step;
            ks.z += (dz / dist) * step;
            facing = Math.atan2(dx, dz);
            walking = time * 11;
            mood = "calm";
          } else {
            ks.x = home.x;
            ks.z = home.z;
            // Sevinen oyuncu tribüne ve kameraya döner.
            facing = mood === "cheer" ? (side === 0 ? 0.5 : -0.5) : Math.PI;
          }
          tx = ks.x;
          tz = ks.z;
        }
        ks.yaw = quiet ? facing : turnTo(ks.yaw, facing, follow(9, realDt));
        motion = standing(side, tx, tz, ks.yaw, mood, quiet, quiet ? 0 : walking);
        if (shooting && !plan && walking === 0 && st.aiming) motion.headPitch = -0.12;
      }
      applyBody(kickers[side], KICKER_SCALE, motion);
      setBlob(2 + side, motion.x, motion.z, motion.hip - 0.8 * KICKER_SCALE);
    });

    // -- ağ, direk titremesi, tribün, panolar --
    // Soru sırasında sahne durgundur (öğrenciler soruyu okur); süreklilik yalnızca şut anındadır.
    const lively = !quiet && kickView(inp.phase);
    stadium.setNet(plan ? netBulgeAt(plan, tau) : null, st.clock, lively && settings.extras);
    stadium.setNetOpacity(replaying && plan?.kick.result === "gol" ? 0.5 : 0.9);
    if (st.postHit) {
      const k = st.clock - st.postHit.start;
      stadium.goal.position.x = quiet ? 0 : Math.sin(k * 80) * 0.03 * Math.exp(-k * 6);
      if (k > 1) {
        st.postHit = null;
        stadium.goal.position.x = 0;
      }
    }
    const cel = st.celebrate;
    const finWinner = inp.phase === "finished" && (inp.winner === 0 || inp.winner === 1) && st.finale ? inp.winner : null;
    const cheerSide = cel && time - cel.start < 3.2 ? cel.side : finWinner;
    stadium.setCrowd(time, quiet ? null : cheerSide, cel && cheerSide === cel.side ? clamp01((3.2 - (time - cel.start)) / 0.8) : 1);
    stadium.setBoards(lively ? realDt : 0, cel && time - cel.start < 2.8 ? cel.side : finWinner, st.clock);
    const tense = inp.phase === "kick" && !plan ? 0.9 : plan && liveTau < CONTACT ? 1.6 : 0.12;
    stadium.setFlashes(realDt, quiet ? 0 : tense);
    if (lively) stadium.setFlags(st.clock, cheerSide !== null);

    // -- nişan --
    if (st.aiming && canAim()) {
      const g = st.aiming;
      const target = kickTarget(g.gx, g.gy);
      aimGroup.visible = true;
      ring.position.set(target.x, target.y, 0.04);
      dot.position.copy(ring.position);
      const place = classify(g.gx, g.gy);
      aimMat.color.copy(tokenColor(place === "aut" ? "var(--color-ink-400)" : teams[inp.shooter ?? 0].base));
      const pulse = quiet ? 1 : 1 + Math.sin(st.clock * 9) * 0.08;
      ring.scale.setScalar(pulse);
      const slide = quiet ? 0 : (st.clock * 1.6) % 1;
      pathDots.forEach((d, i) => {
        const u = (i + slide) / DOTS;
        flightPoint(target, 0.06 + u * 0.9, flightTmp);
        d.position.set(flightTmp.x, flightTmp.y, flightTmp.z);
        d.scale.setScalar(0.7 + u * 0.9);
      });
    } else aimGroup.visible = false;

    // -- parçacıklar --
    for (let i = 0; i < PARTICLES; i++) {
      if (pMax[i] === 0) continue;
      pLife[i] += dt;
      const k = pLife[i] / pMax[i];
      if (k >= 1) {
        pMax[i] = 0;
        pCol[i * 4 + 3] = 0;
        continue;
      }
      pVel[i * 3 + 1] -= 6 * dt;
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] = Math.max(0.05, pPos[i * 3 + 1] + pVel[i * 3 + 1] * dt);
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pCol.set([turf.r, turf.g, turf.b, 0.7 * (1 - k)], i * 4);
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    // -- bitiş --
    if (inp.phase === "finished" && !st.finale && (!plan || (liveTau > LIVE_END && !st.replay && (st.replayed || quiet || plan.kick.result === "aut")))) {
      st.finale = { start: time, called: false, confetti: false };
    }
    const fin = st.finale;
    if (fin) {
      const w = inp.winner;
      // Yeniden açılan bitmiş oyunda (start < 0) gösteri ve sesler tekrarlanmaz.
      if (!fin.confetti) {
        fin.confetti = true;
        if (w === 0 || w === 1) {
          if (!quiet) {
            const colors = [teams[w].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor);
            confetti({ particleCount: 150, spread: 120, startVelocity: 52, origin: { x: 0.5, y: 0.5 }, colors, disableForReducedMotion: true });
          }
          penaltyAudio.crowdGoal();
        }
        penaltyAudio.say(w === "draw" ? "berabere" : "bitis", 0.5);
      }
      if (!fin.called && time - fin.start > (w === "draw" ? 1.2 : 2.2)) {
        fin.called = true;
        o.handlers().onFinale();
      }
    }

    // -- kamera --
    let shot: Shot = kickView(inp.phase) ? AIM_SHOT : QUESTION_SHOT;
    let rate = 2.6;
    camPos.set(shot.pos.x, shot.pos.y, shot.pos.z);
    camLook.set(shot.look.x, shot.look.y, shot.look.z);
    let fitW = shot.fitW;
    let fitH = shot.fitH;
    if (!quiet) {
      if (plan && replaying) {
        const el = st.clock - st.replay!.start;
        const t = plan.target;
        const d = Math.sign(t.x) || 1;
        if (plan.kick.result === "gol") {
          // Ağın arkasından: top kameraya doğru gelir, ağ kameraya doğru esner.
          camPos.set(t.x * 0.45 - el * 0.2 * d, 1.5 + t.y * 0.2, -NET_DEPTH_BOTTOM - 3.5 + el * 0.15);
          camLook.set(t.x * 0.75, 0.5 + t.y * 0.6, 0);
          fitW = 7.6;
          fitH = 4;
        } else if (plan.kick.result === "kurtardi") {
          // Kalecinin uçtuğu yandan, alçaktan.
          camPos.set(d * 6.4, 0.55 + el * 0.08, 5.6 - el * 0.25);
          camLook.set(t.x * 0.72, t.y * 0.6 + 0.55, 0.3);
          fitW = 6.6;
          fitH = 3.5;
        } else {
          camPos.set(t.x * 0.55 + d * 1.4, 1.0, 6.8 - el * 0.3);
          camLook.set(t.x, Math.min(GOAL_H, t.y), 0);
          fitW = 5.4;
          fitH = 3.2;
        }
        shot = { pos: camPos, look: camLook, fitW, fitH };
      } else if (plan && liveTau > STRIKE && liveTau < CONTACT + 0.9) {
        // Şutla birlikte kamera topun peşinden kaleye yaklaşır.
        const t = plan.target;
        const push = easeOut(clamp01((liveTau - STRIKE) / 0.6));
        camPos.set(lerp(AIM_SHOT.pos.x, t.x * 0.3, push), lerp(AIM_SHOT.pos.y, 3.4, push), lerp(AIM_SHOT.pos.z, 19, push));
        camLook.set(t.x * 0.6 * push, lerp(AIM_SHOT.look.y, 0.9 + t.y * 0.35, push), lerp(AIM_SHOT.look.z, 0, push));
        fitW = lerp(AIM_SHOT.fitW, 9, push);
        fitH = lerp(AIM_SHOT.fitH, 5, push);
        rate = 5;
      } else if (inp.phase === "finished" && fin && (inp.winner === 0 || inp.winner === 1) && time - fin.start < 6) {
        // Kazananın çevresinde yarım tur. Oyuncu çerçevenin alt yarısında durur: üstte "kazandı" yazısı var.
        const w = st.kicker[inp.winner];
        const a = -0.55 + (time - fin.start) * 0.2;
        camPos.set(w.x + Math.sin(a) * 5.4, 1.5, w.z + Math.cos(a) * 5.4);
        camLook.set(w.x, 2.0, w.z);
        fitW = 5;
        fitH = 4;
        rate = 2.2;
      }
    }
    const kk = quiet || st.cut ? 1 : follow(rate, realDt);
    st.cut = false;
    st.cam.pos.lerp(camPos, kk);
    st.cam.look.lerp(camLook, kk);
    st.cam.fitW = lerp(st.cam.fitW, fitW, kk);
    st.cam.fitH = lerp(st.cam.fitH, fitH, kk);
    st.shake *= Math.exp(-realDt * 7);
    const sx = quiet ? 0 : Math.sin(now / 17) * st.shake;
    const sy = quiet ? 0 : Math.cos(now / 23) * st.shake * 0.6;
    camera.position.set(st.cam.pos.x + sx, st.cam.pos.y + sy, st.cam.pos.z);
    camera.lookAt(st.cam.look);
    const dist = st.cam.pos.distanceTo(st.cam.look);
    camera.fov = (2 * Math.atan(Math.max(st.cam.fitH / 2, st.cam.fitW / 2 / st.aspect) / dist) * 180) / Math.PI;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  let raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("webglcontextlost", onLost);
      delete canvas.dataset.aim;
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

const RELAXED_HANDS: [V3, V3] = [
  { x: -0.3, y: 0.0, z: 0.1 },
  { x: 0.3, y: 0.0, z: 0.1 },
];

/** Açıyı en kısa yoldan hedefe doğru döndürür. */
function turnTo(from: number, to: number, k: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * k;
}

/** Tuval dokularındaki yazılar için yazı tipinin yüklenmesini bekler (yüklenemezse sistem yazı tipiyle sürer). */
export async function fontsReady(): Promise<void> {
  try {
    await Promise.race([document.fonts.load('800 78px "Lexend Variable"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    // yazı tipi yoksa tarayıcının varsayılanı kullanılır
  }
}

