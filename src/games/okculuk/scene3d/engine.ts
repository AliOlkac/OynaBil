import confetti from "canvas-confetti";
import * as THREE from "three";
import { cssColor } from "@/lib/color";
import { DARK, HAIR, SKIN, STYLES } from "../../shared/kid";
import { FIGURE, KidFigure, type BodyMotion, type Mouth } from "../../shared/stage3d/figure";
import { canvasTexture, clamp01, createRenderer, disposeTree, easeInOut, follow, lerp, seeded, tierSettings, tokenColor, tokenCss } from "../../shared/stage3d/kit";
import { ChipPool } from "../../shared/stage3d/particles";
import { createFrameWatch, type Tier } from "../../shared/stage3d/support";
import { archeryAudio } from "../audio";
import { BOSS_R, DRAW_MS, type Shot, type ShotResult } from "../logic";
import type { ArcherySceneInput, SceneTeam } from "../scene/types";
import { arrowAt, ARROW_LEN, FACE_R, FACE_Z, planArrow, quiver, RING_COLORS, TARGET_D, TARGET_Y, type ArrowPlan, type V3 } from "../timeline";

/**
 * Okçuluk sahnesinin üç boyutlu motoru: açık hava atış alanı, çimen, ağaçlar, yan tribün, rüzgâr
 * bayrakları, ayaklı saman hedef ve iki takımın okçuları. Bütün hareket tek bir requestAnimationFrame
 * döngüsündedir. Okun yolu `timeline.ts` içindeki saf fonksiyonlardan okunur; ağır çekim tekrar aynı
 * yolu yavaş oynatır.
 */

export type EngineHandlers = { onContact: (index: number) => void; onShotDone: (index: number) => void; onFinale: () => void };

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  tier: Tier;
  teams: [SceneTeam, SceneTeam];
  getInput: () => ArcherySceneInput;
  isReducedMotion: () => boolean;
  handlers: () => EngineHandlers;
  ui: { banner: (result: ShotResult | null, side: 0 | 1, points: number) => void; replay: (on: boolean) => void };
  onTier: (tier: Tier) => void;
  onGiveUp: (reason: "slow" | "lost") => boolean;
};

const KID = 0.9;
const STAND = 0.8 * KID;
const ANKLE = FIGURE.ankle * KID;
/** Atış yapan okçunun durduğu yer; bekleyen takım arkada, kendi tarafında durur. */
const LINE_SPOT: V3 = { x: 0, y: 0, z: 0.4 };
const WAIT: [V3, V3] = [
  { x: -1.8, y: 0, z: 2.2 },
  { x: 1.8, y: 0, z: 2.2 },
];
const REPLAY_SPEED = 0.3;
/** Hedefte en fazla bu kadar ok birikir; eskisi çekilir. */
const QUIVER_MAX = 6;

type CamShot = { pos: V3; look: V3; fitW: number; fitH: number };
const QUESTION_SHOT: CamShot = { pos: { x: -3.4, y: 2.3, z: 5.2 }, look: { x: 0.4, y: 1.0, z: -4.5 }, fitW: 9, fitH: 5 };

function skyTexture() {
  return canvasTexture(16, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, tokenCss("var(--color-kobalt-deep)"));
    g.addColorStop(0.42, tokenCss("var(--color-kobalt)"));
    g.addColorStop(0.5, tokenCss("var(--color-ufuk-acik)"));
    g.addColorStop(1, tokenCss("var(--color-ufuk-acik)"));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function grassTexture() {
  const rnd = seeded(31);
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      // Biçilmiş çimen: enine açık-koyu şeritler, üstünde ince benekler.
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = tokenCss(i % 2 ? "var(--color-cim)" : "var(--color-cim-acik)");
        ctx.fillRect(0, (i * h) / 8, w, h / 8);
      }
      for (let i = 0; i < 6000; i++) {
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "255,255,255"},${(0.03 + rnd() * 0.05).toFixed(3)})`;
        ctx.fillRect(rnd() * w, rnd() * h, 2, 3);
      }
    },
    { repeat: [6, 10], anisotropy: 8 },
  );
}

/** Hedef yüzü: on halka, beş renk; ortada artı işareti. */
function faceTexture() {
  return canvasTexture(512, 512, (ctx, w) => {
    const c = w / 2;
    ctx.clearRect(0, 0, w, w);
    for (let i = 0; i < 10; i++) {
      const r = (c - 2) * (1 - i * 0.1);
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fillStyle = tokenCss(RING_COLORS[Math.floor(i / 2)]);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = tokenCss(i === 2 || i === 3 ? "var(--color-cream-dim)" : "var(--color-ink-950)");
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = tokenCss("var(--color-ink-950)");
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c - 8, c);
    ctx.lineTo(c + 8, c);
    ctx.moveTo(c, c - 8);
    ctx.lineTo(c, c + 8);
    ctx.stroke();
  });
}

function strawTexture() {
  const rnd = seeded(44);
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = tokenCss("var(--color-ahsap-acik)");
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.strokeStyle = `rgba(${rnd() < 0.5 ? "90,60,20" : "255,240,200"},${(0.15 + rnd() * 0.2).toFixed(3)})`;
      ctx.lineWidth = 1 + rnd();
      const x = rnd() * w;
      const y = rnd() * h;
      const a = rnd() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
      ctx.stroke();
    }
  });
}

/** Ok: uç (0,0,0) noktasında, gövde +z yönünde uzanır; ok -z yönüne bakar. */
function makeArrow(fletch: string) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, ARROW_LEN, 6), new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ahsap-koyu)"), roughness: 0.6 }));
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = ARROW_LEN / 2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.06, 8), new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ink-400)"), metalness: 0.7, roughness: 0.3 }));
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = 0.02;
  const fMat = new THREE.MeshStandardMaterial({ color: tokenColor(fletch), side: THREE.DoubleSide, roughness: 0.7 });
  const fGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.035, 0.03), new THREE.Vector3(0, 0.035, 0.12), new THREE.Vector3(0, 0, 0.13)]);
  fGeo.setIndex([0, 1, 2, 0, 2, 3]);
  fGeo.computeVertexNormals();
  for (let k = 0; k < 3; k++) {
    const f = new THREE.Mesh(fGeo, fMat);
    f.position.z = ARROW_LEN - 0.16;
    f.rotation.z = (k * Math.PI * 2) / 3;
    g.add(f);
  }
  const nock = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 6), fMat);
  nock.rotation.x = Math.PI / 2;
  nock.position.z = ARROW_LEN;
  g.add(shaft, tip, nock);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

/** Yay: kabzası (0,0,0) noktasında, kolları ±y yönünde, karnı -z yönüne (hedefe) doğru kavisli. */
function makeBow(color: string) {
  const g = new THREE.Group();
  const H = 0.56 * KID;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -H, 0.04), new THREE.Vector3(0, 0, -0.2), new THREE.Vector3(0, H, 0.04));
  const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.014, 6, false), new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ahsap-koyu)"), roughness: 0.5 }));
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8), new THREE.MeshStandardMaterial({ color: tokenColor(color), roughness: 0.6 }));
  grip.position.z = -0.1;
  limb.castShadow = true;
  g.add(limb, grip);
  return { group: g, tipTop: new THREE.Vector3(0, H, 0.04), tipBottom: new THREE.Vector3(0, -H, 0.04) };
}

export function createArcheryEngine(o: EngineOptions): { dispose: () => void } {
  const { canvas, teams } = o;
  let settings = tierSettings(o.tier);
  const renderer = createRenderer(canvas, o.tier);
  const watch = createFrameWatch(o.tier);

  const scene = new THREE.Scene();
  const horizon = tokenColor("var(--color-ufuk-acik)");
  scene.background = horizon;
  scene.fog = new THREE.Fog(horizon, 40, 95);
  const camera = new THREE.PerspectiveCamera(30, 2, 0.05, 200);

  // ---- ışık: öğleden sonra güneşi, gökten yumuşak dolgu ----
  scene.add(new THREE.HemisphereLight(tokenColor("var(--color-cream)"), tokenColor("var(--color-cim)"), 1.6));
  const sun = new THREE.DirectionalLight(tokenColor("var(--color-ufuk-acik)"), 2.8);
  sun.position.set(-8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(settings.shadowSize);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -18, near: 2, far: 50 });
  sun.target.position.set(0, 0, -6);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---- gök, çimen, ağaçlar ----
  const sky = new THREE.Mesh(new THREE.SphereGeometry(110, 24, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(sky);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 80), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -14;
  ground.receiveShadow = true;
  scene.add(ground);
  // Atış çizgisi ve şerit çizgileri
  const lineMat = new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-cream)") });
  const shootLine = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.08), lineMat);
  shootLine.rotation.x = -Math.PI / 2;
  shootLine.position.set(0, 0.005, 0);
  scene.add(shootLine);
  for (const x of [-2.2, 2.2]) {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.05, TARGET_D + 2), new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-cream)"), transparent: true, opacity: 0.55 }));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(x, 0.004, -TARGET_D / 2 - 0.5);
    scene.add(lane);
  }
  // Ağaçlar: hedefin arkasında sık, yanlarda seyrek; gövde + iki katlı tepe.
  const trees = (() => {
    const rnd = seeded(17);
    const spots: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 26; i++) spots.push({ x: -22 + i * 1.8 + (rnd() - 0.5), z: -TARGET_D - 6 - rnd() * 5, s: 0.8 + rnd() * 0.6 });
    for (let i = 0; i < 10; i++) spots.push({ x: 8 + rnd() * 6, z: -2 - i * 2.2, s: 0.7 + rnd() * 0.5 });
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 6), new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-ahsap-koyu)") }), spots.length);
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.2, 3.2, 8), new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-servi)") }), spots.length);
    const mm = new THREE.Matrix4();
    spots.forEach((p, i) => {
      mm.compose(new THREE.Vector3(p.x, 0.8 * p.s, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s));
      trunk.setMatrixAt(i, mm);
      mm.compose(new THREE.Vector3(p.x, (1.6 + 1.5) * p.s, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s));
      crown.setMatrixAt(i, mm);
    });
    crown.castShadow = settings.shadows;
    return [trunk, crown];
  })();
  scene.add(...trees);

  // ---- yan tribün: atış alanının solunda, sahaya bakan basamaklar ve takım renginde çocuklar ----
  const crowd = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ink-700)"), roughness: 0.8 });
  const rows = Math.max(3, Math.min(6, settings.crowdRows[0] - 4));
  for (let r = 0; r < 6; r++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 13), seatMat);
    step.position.set(-6.4 - r * 0.7, 0.21 + r * 0.42, -6.5);
    step.receiveShadow = true;
    crowd.add(step);
  }
  const fans = (() => {
    const base: { x: number; y: number; z: number; ph: number; side: 0 | 1 }[] = [];
    const rnd = seeded(9);
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < 20; i++) {
        if (rnd() < 0.14) continue;
        const z = -0.6 - i * 0.6 + (rnd() - 0.5) * 0.1;
        base.push({ x: -6.4 - r * 0.7, y: 0.42 + r * 0.42 + 0.3, z, ph: rnd() * 6, side: z > -6.5 ? 0 : 1 });
      }
    }
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.16, 0.22, 3, 8), new THREE.MeshLambertMaterial(), base.length);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshLambertMaterial(), base.length);
    const c = new THREE.Color();
    base.forEach((b, i) => {
      body.setColorAt(i, rnd() < 0.8 ? tokenColor(teams[b.side].base) : tokenColor("var(--color-cream)"));
      heads.setColorAt(i, c.set(SKIN[Math.floor(rnd() * SKIN.length)]));
    });
    crowd.add(body, heads);
    return { body, heads, base };
  })();
  scene.add(crowd);
  const fanM = new THREE.Matrix4();
  const setFans = (time: number, joy: [number, number], quiet: boolean) => {
    fans.base.forEach((b, i) => {
      const hop = quiet ? 0 : joy[b.side] * Math.abs(Math.sin(time * 9 + b.ph)) * 0.22;
      fanM.makeTranslation(b.x, b.y + hop, b.z);
      fans.body.setMatrixAt(i, fanM);
      fanM.makeTranslation(b.x, b.y + 0.36 + hop, b.z);
      fans.heads.setMatrixAt(i, fanM);
    });
    fans.body.instanceMatrix.needsUpdate = true;
    fans.heads.instanceMatrix.needsUpdate = true;
  };

  // ---- hedef: üç ayaklı sehpa, saman taban, halkalı yüz ----
  const target = new THREE.Group();
  const bossR = FACE_R * BOSS_R;
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(bossR, bossR, 0.3, 40), new THREE.MeshStandardMaterial({ map: strawTexture(), roughness: 0.95 }));
  boss.rotation.x = Math.PI / 2;
  boss.position.set(0, TARGET_Y, FACE_Z - 0.15);
  boss.castShadow = boss.receiveShadow = true;
  const face = new THREE.Mesh(new THREE.CircleGeometry(FACE_R, 64), new THREE.MeshStandardMaterial({ map: faceTexture(), transparent: true, roughness: 0.85 }));
  face.position.set(0, TARGET_Y, FACE_Z + 0.002);
  face.receiveShadow = true;
  const legMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ahsap)"), roughness: 0.8 });
  const leg = (from: THREE.Vector3, to: THREE.Vector3) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, from.distanceTo(to)), legMat);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.lookAt(to);
    m.castShadow = true;
    target.add(m);
  };
  // Ayaklar tabanın arkasından iner: hedefin yüzünü kapatmaz.
  const top = new THREE.Vector3(0, TARGET_Y + bossR + 0.08, FACE_Z - 0.36);
  leg(top, new THREE.Vector3(-0.62, 0, FACE_Z - 0.34));
  leg(top, new THREE.Vector3(0.62, 0, FACE_Z - 0.34));
  leg(top, new THREE.Vector3(0, 0, FACE_Z - 1.2));
  // Tabanı tutan enine kalas
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.08), legMat);
  rail.position.set(0, TARGET_Y - bossR + 0.02, FACE_Z - 0.34);
  target.add(rail);
  target.add(boss, face);
  scene.add(target);

  // Skor tabelası: hedefin sağında, ahşap direkli.
  const boardCanvas = document.createElement("canvas");
  boardCanvas.width = 512;
  boardCanvas.height = 256;
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  const scoreboard = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: boardTex }));
  scoreboard.position.set(3.3, 2.7, -TARGET_D + 0.5);
  scoreboard.rotation.y = -0.25;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), legMat);
  post.position.set(3.3, 1.05, -TARGET_D + 0.45);
  scene.add(scoreboard, post);
  let boardKey = "";
  const drawBoard = (score: [number, number]) => {
    const k = score.join("-");
    if (k === boardKey) return;
    boardKey = k;
    const ctx = boardCanvas.getContext("2d")!;
    ctx.fillStyle = tokenCss("var(--color-ink-950)");
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = tokenCss("var(--color-ahsap)");
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 498, 242);
    ctx.font = `800 120px "Lexend Variable", Lexend, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    for (const side of [0, 1] as const) {
      ctx.fillStyle = tokenCss(teams[side].base);
      ctx.fillText(String(score[side]), side === 0 ? 140 : 372, 136);
    }
    ctx.fillStyle = tokenCss("var(--color-kehribar)");
    ctx.font = `800 60px "Lexend Variable", Lexend, system-ui, sans-serif`;
    ctx.fillText("—", 256, 132);
    boardTex.needsUpdate = true;
  };

  // ---- rüzgâr bayrakları: atış alanı boyunca üç direk ----
  const FLAG_W = 0.9;
  const flagSpots = [
    { x: -2.7, z: -3 },
    { x: 2.7, z: -7.5 },
    { x: -2.7, z: -12 },
  ];
  const flags = flagSpots.map((p, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6), new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ink-400)"), metalness: 0.5, roughness: 0.4 }));
    pole.position.set(p.x, 1.6, p.z);
    pole.castShadow = true;
    const geo = new THREE.PlaneGeometry(FLAG_W, 0.5, 8, 2);
    const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: tokenColor(i === 1 ? "var(--color-mercan)" : "var(--color-kehribar)"), side: THREE.DoubleSide, roughness: 0.8 }));
    cloth.position.set(p.x, 2.9, p.z);
    cloth.castShadow = true;
    scene.add(pole, cloth);
    return { cloth, base: Float32Array.from(geo.attributes.position.array as Float32Array) };
  });
  const updateFlags = (wind: number, time: number, quiet: boolean) => {
    const s = wind < 0 ? -1 : 1;
    const strength = Math.abs(wind);
    flags.forEach(({ cloth, base }, i) => {
      const pos = cloth.geometry.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) {
        // Kumaş direğin yanından rüzgârın estiği yöne uzanır; rüzgâr yokken direğe sarkar.
        const u = (base[v * 3] + FLAG_W / 2) / FLAG_W;
        const y = base[v * 3 + 1];
        const droop = (1 - strength / 3) * 0.9;
        const wave = quiet ? 0 : Math.sin(time * (3 + strength * 2.2) - u * 5 + i) * (0.05 + strength * 0.03) * u;
        const along = u * FLAG_W * (1 - droop * 0.55);
        pos.setXYZ(v, s * along, y - u * u * droop * 0.7, wave);
      }
      pos.needsUpdate = true;
      cloth.geometry.computeVertexNormals();
    });
  };

  // ---- okçular: her takımdan biri; yayları sol ellerinde ----
  const archers = ([0, 1] as const).map((side) => {
    const fig = new KidFigure({
      skin: SKIN[(side * 2 + 1) % SKIN.length],
      hair: HAIR[(side * 3 + 1) % HAIR.length],
      hairStyle: STYLES[(side * 2 + 1) % STYLES.length],
      shirt: teams[side].base,
      trim: teams[side].deep,
      shorts: teams[side].deep,
      socks: "var(--color-cream)",
      boots: DARK,
      headband: teams[side].deep,
      scale: KID,
    });
    const bow = makeBow(teams[side].deep);
    const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: tokenColor("var(--color-cream)") }));
    string.frustumCulled = false;
    scene.add(fig.root, bow.group, string);
    return { fig, bow, string, walk: { ...WAIT[side] } };
  });

  // ---- oklar: uçan ok ve hedefte biriken oklar ----
  const flying = makeArrow(teams[0].base);
  const flyingFletch = (team: 0 | 1) =>
    flying.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.MeshStandardMaterial).side === THREE.DoubleSide) (mesh.material as THREE.MeshStandardMaterial).color.copy(tokenColor(teams[team].base));
    });
  scene.add(flying);
  const stuck = Array.from({ length: QUIVER_MAX }, (_, i) => {
    const a = makeArrow(teams[i % 2].base);
    a.visible = false;
    scene.add(a);
    return a;
  });
  const sparks = new ChipPool(70, 11);
  scene.add(sparks.mesh);

  // ---- durum ----
  const start = o.getInput();
  const st = {
    time: 0,
    last: performance.now(),
    aspect: 2,
    cut: true,
    cam: { pos: new THREE.Vector3(), look: new THREE.Vector3(), fitW: 9, fitH: 5 },
    seenShots: start.shots.length,
    plan: null as ArrowPlan | null,
    shotIndex: -1,
    shotStart: 0,
    shot: null as Shot | null,
    fired: new Set<number>(),
    contacted: false,
    replay: null as null | { start: number },
    doneCalled: false,
    joy: [0, 0] as [number, number],
    mood: [null, null] as ({ kind: "cheer" | "dismay"; start: number } | null)[],
    finale: start.phase === "finished" ? { start: -10, called: false, confetti: true } : (null as null | { start: number; called: boolean; confetti: boolean }),
    lastPhase: start.phase,
    drawSoundFor: -1,
    windSoundFor: -1,
    /** Hedefte duran oklar: (dünya noktası, takım). */
    quiver: [] as { at: V3; dir: V3; side: 0 | 1 }[],
  };
  // Yeniden açılan oyunda önceki oklar hedefte durur.
  for (const s of start.shots.slice(-QUIVER_MAX)) {
    const p = planArrow(s);
    if (!p.sticks) continue;
    const at: V3 = { x: 0, y: 0, z: 0 };
    const dir: V3 = { x: 0, y: 0, z: -1 };
    arrowAt(p, p.hitAt, at, dir);
    st.quiver.push({ at, dir, side: s.side });
  }
  const scoreOf = (n: number): [number, number] => {
    const s: [number, number] = [0, 0];
    o.getInput().shots.slice(0, n).forEach((x) => (s[x.side] += x.scored));
    return s;
  };
  let shownShots = start.shots.length;

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
    settings = tierSettings(next);
    renderer.setPixelRatio(settings.pixelRatio);
    renderer.shadowMap.enabled = settings.shadows;
    sun.shadow.mapSize.setScalar(settings.shadowSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
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

  // ---- poz yardımcıları ----
  const m: BodyMotion = { x: 0, z: 0, hip: STAND, yaw: 0, footL: { x: 0, y: 0, z: 0 }, footR: { x: 0, y: 0, z: 0 }, handL: { x: 0, y: 0, z: 0 }, handR: { x: 0, y: 0, z: 0 } };
  /** Okçu yan durur: sol omzu hedefe (-z) bakar, yüzü -x yönündedir. */
  const SIDE_YAW = -Math.PI / 2;
  const SHOULDER = STAND + FIGURE.shoulderY * KID;
  const baseStand = (at: V3, yaw: number, mouth: Mouth) => {
    m.x = at.x;
    m.z = at.z;
    m.yaw = yaw;
    m.hip = STAND;
    m.lean = 0.02;
    m.twist = 0;
    m.headYaw = 0;
    m.headPitch = 0;
    m.mouth = mouth;
    m.footL = { x: -0.11 * KID, y: ANKLE, z: 0 };
    m.footR = { x: 0.11 * KID, y: ANKLE, z: 0.04 };
    // Yay sol elde, aşağıda; sağ el yanda.
    m.handL = { x: -0.3 * KID, y: STAND + 0.05, z: 0.12 };
    m.handR = { x: 0.3 * KID, y: STAND + 0.02, z: 0.05 };
  };
  /** Nişan duruşu: ayaklar omuz genişliğinde, yay kolu hedefe uzanır, çekme eli çeneye gelir. */
  const aimPose = (draw: number, follow: number) => {
    m.footL = { x: -0.02, y: ANKLE, z: -0.16 };
    m.footR = { x: 0.02, y: ANKLE, z: 0.16 };
    m.lean = 0;
    m.headYaw = -1.25;
    m.headPitch = 0.02;
    m.mouth = "focus";
    m.handL = { x: -0.6 * KID, y: SHOULDER + 0.02, z: 0.03 };
    // Çekme eli: kabzadan çeneye; bırakınca geriye savrulur.
    m.handR = {
      x: lerp(-0.42 * KID, -0.04, draw) + follow * 0.16,
      y: SHOULDER + 0.02 + draw * 0.06 + follow * 0.02,
      z: lerp(0.06, 0.12, draw),
    };
  };
  const cheer = (t: number, ph: number, quiet: boolean) => {
    const hop = quiet ? 0 : Math.abs(Math.sin(t * 7 + ph)) * 0.28;
    m.hip = STAND + hop;
    m.footL = { x: -0.13 * KID, y: ANKLE + hop * 0.85, z: 0 };
    m.footR = { x: 0.13 * KID, y: ANKLE + hop * 0.85, z: 0 };
    m.handL = { x: -0.34 * KID, y: m.hip + 1.02 * KID, z: 0.08 };
    m.handR = { x: 0.34 * KID, y: m.hip + 1.02 * KID, z: 0.08 };
    m.mouth = "grin";
    m.headPitch = -0.2;
    m.headYaw = 0;
  };
  const dismay = () => {
    m.handL = { x: -0.15 * KID, y: m.hip + 0.84 * KID, z: 0.1 };
    m.handR = { x: 0.15 * KID, y: m.hip + 0.84 * KID, z: 0.1 };
    m.mouth = "shock";
    m.lean = 0.15;
    m.headPitch = 0.3;
    m.headYaw = 0;
  };

  const hand = new THREE.Vector3();
  const grip = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const FWD = new THREE.Vector3(0, 0, -1);
  const dirV = new THREE.Vector3();
  const pos: V3 = { x: 0, y: 0, z: 0 };
  const dir: V3 = { x: 0, y: 0, z: -1 };
  const placeArrow = (obj: THREE.Object3D, at: V3, d: V3, wobble = 0) => {
    obj.position.set(at.x, at.y, at.z);
    dirV.set(d.x, d.y + wobble, d.z).normalize();
    obj.quaternion.copy(tmpQ.setFromUnitVectors(FWD, dirV));
  };

  const frame = (now: number) => {
    if (stopped) return;
    const realMs = now - st.last;
    const dt = Math.min(0.05, realMs / 1000);
    st.last = now;
    st.time += dt;
    const t = st.time;
    const inp = o.getInput();
    const quiet = o.isReducedMotion();

    const verdict = watch.sample(realMs);
    if (verdict === "in") applyTier(watch.tier);
    else if (verdict === "vazgec" && o.onGiveUp("slow")) return;

    // -- yeni atış --
    if (inp.shots.length > st.seenShots) {
      for (let i = st.seenShots; i < inp.shots.length - 1; i++) {
        o.handlers().onContact(i);
        o.handlers().onShotDone(i);
      }
      const index = inp.shots.length - 1;
      st.seenShots = inp.shots.length;
      st.shot = inp.shots[index];
      st.shotIndex = index;
      st.plan = planArrow(st.shot);
      st.shotStart = t;
      st.fired = new Set();
      st.contacted = st.doneCalled = false;
      st.replay = null;
      st.cut = true;
      flyingFletch(st.shot.side);
    }
    if (inp.phase !== st.lastPhase) {
      if (inp.phase === "question") {
        st.plan = null;
        st.shot = null;
        st.mood = [null, null];
        st.joy = [0, 0];
      }
      st.lastPhase = inp.phase;
    }

    // -- okun olayları: ses, skor, tepkiler --
    const plan = st.plan;
    const shot = st.shot;
    let tau = plan ? t - st.shotStart : -1;
    if (plan && shot) {
      for (const [k, e] of plan.events.entries()) {
        if (st.fired.has(k) || tau < e.t) continue;
        st.fired.add(k);
        if (tau - e.t > 0.4) continue;
        if (e.kind === "release") {
          archeryAudio.release();
          archeryAudio.whoosh();
        } else if (e.kind === "target") archeryAudio.thud(1);
        else if (e.kind === "boss") archeryAudio.thud(0.5);
        else archeryAudio.grass();
        if (e.kind === "target" || e.kind === "boss") {
          // Saman tozu ve 9-10'da altın kıvılcım.
          const hp = { x: 0, y: 0, z: 0 };
          arrowAt(plan, plan.hitAt, hp, dir);
          const gold = shot.points >= 9;
          if (!quiet)
            for (let i = 0; i < (gold ? 40 : 12); i++)
              sparks.emit({
                x: hp.x,
                y: hp.y,
                z: hp.z + 0.05,
                vx: (Math.random() - 0.5) * (gold ? 3 : 1.2),
                vy: Math.random() * (gold ? 3 : 1.2),
                vz: Math.random() * (gold ? 2.5 : 1),
                size: gold ? 0.03 + Math.random() * 0.03 : 0.02,
                life: gold ? 1.1 : 0.6,
                color: tokenColor(gold ? (i % 3 ? "var(--color-kehribar)" : teams[shot.side].base) : "var(--color-ahsap-acik)"),
              });
        }
      }
      if (!st.contacted && tau >= plan.hitAt + 0.15) {
        st.contacted = true;
        o.handlers().onContact(st.shotIndex);
        const other = (1 - shot.side) as 0 | 1;
        if (shot.points >= 7) {
          archeryAudio.crowdCheer();
          st.mood[shot.side] = { kind: "cheer", start: t };
          st.mood[other] = { kind: "dismay", start: t };
          st.joy[shot.side] = shot.points >= 9 ? 1 : 0.6;
        } else if (shot.points === 0) {
          archeryAudio.crowdOoh();
          st.mood[shot.side] = { kind: "dismay", start: t };
        }
        archeryAudio.say(shot.result, 0.1);
        o.ui.banner(shot.result, shot.side, shot.scored);
        if (plan.sticks) {
          const at: V3 = { x: 0, y: 0, z: 0 };
          const d: V3 = { x: 0, y: 0, z: -1 };
          arrowAt(plan, plan.hitAt, at, d);
          st.quiver.push({ at, dir: d, side: shot.side });
          if (st.quiver.length > QUIVER_MAX) st.quiver.shift();
        }
      }
      // Tekrar: kırmızı ve sarıya giren oklar ağır çekimde, okun yanından.
      const wantsReplay = !quiet && shot.points >= 7;
      if (!st.replay && wantsReplay && tau > plan.hitAt + 1.6 && !st.doneCalled) {
        st.replay = { start: t };
        st.fired = new Set(plan.events.map((_, k) => k));
        st.cut = true;
        o.ui.replay(true);
      }
      const replayLen = (plan.replay.to - plan.replay.from) / REPLAY_SPEED;
      if (st.replay && t - st.replay.start > replayLen) {
        st.replay = null;
        st.cut = true;
        o.ui.replay(false);
        st.doneCalled = true;
        o.handlers().onShotDone(st.shotIndex);
      }
      if (!wantsReplay && !st.doneCalled && tau > plan.end + 0.6) {
        st.doneCalled = true;
        o.handlers().onShotDone(st.shotIndex);
      }
    }
    if (st.replay && plan) tau = plan.replay.from + (t - st.replay.start) * REPLAY_SPEED;

    // -- skor tabelası: ok saplanınca güncellenir --
    if (st.contacted) shownShots = Math.max(shownShots, st.shotIndex + 1);
    else if (!plan) shownShots = inp.shots.length;
    drawBoard(scoreOf(shownShots));

    // -- bitiş --
    if (inp.phase === "finished" && !st.finale && (!plan || st.doneCalled)) st.finale = { start: t, called: false, confetti: false };
    const fin = st.finale;
    if (fin) {
      if (!fin.confetti && t - fin.start > 0.2) {
        fin.confetti = true;
        const w = inp.winner;
        if (w === 0 || w === 1) {
          archeryAudio.crowdCheer();
          archeryAudio.say("bitis", 0.6);
          st.joy[w] = 1;
          if (!quiet) confetti({ particleCount: 140, spread: 110, startVelocity: 48, origin: { x: 0.5, y: 0.35 }, colors: [teams[w].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor), disableForReducedMotion: true });
        } else archeryAudio.say("berabere", 0.6);
      }
      if (!fin.called && t - fin.start > 2.4) {
        fin.called = true;
        o.handlers().onFinale();
      }
    }

    // -- rüzgâr: sert rüzgârda uğultu --
    const wind = plan && shot ? shot.wind : inp.wind;
    if (inp.phase === "aim" && inp.aimStart !== null && Math.abs(wind) === 3 && st.windSoundFor !== inp.aimStart) {
      st.windSoundFor = inp.aimStart;
      archeryAudio.wind();
    }
    updateFlags(wind, t, quiet);

    // -- okçular --
    const aiming = inp.phase === "aim" && inp.shooter !== null && inp.aimStart !== null;
    const shooterSide = plan && shot ? shot.side : aiming ? inp.shooter! : null;
    const drawK = aiming && !plan && inp.drawAt !== null ? clamp01((Date.now() - inp.drawAt) / DRAW_MS) : 0;
    if (aiming && !plan && drawK > 0.05 && st.drawSoundFor !== inp.drawAt) {
      st.drawSoundFor = inp.drawAt!;
      archeryAudio.draw();
    }
    let nockAt: THREE.Vector3 | null = null;
    let gripAt: THREE.Vector3 | null = null;
    ([0, 1] as const).forEach((side) => {
      const a = archers[side];
      const fig = a.fig;
      const isShooter = shooterSide === side;
      const target = isShooter ? LINE_SPOT : WAIT[side];
      const w = a.walk;
      const kk = quiet ? 1 : follow(3.2, dt);
      const moving = Math.hypot(target.x - w.x, target.z - w.z) > 0.05;
      w.x = lerp(w.x, target.x, kk);
      w.z = lerp(w.z, target.z, kk);
      const arrived = !moving || quiet;
      const yaw = isShooter && arrived ? SIDE_YAW : Math.atan2(0 - w.x, -6 - w.z);
      baseStand(w, yaw, "smile");
      if (moving && !quiet) {
        const ph = t * 9;
        m.footL = { x: -0.1 * KID, y: ANKLE + Math.max(0, Math.sin(ph)) * 0.1, z: Math.cos(ph) * 0.18 };
        m.footR = { x: 0.1 * KID, y: ANKLE + Math.max(0, -Math.sin(ph)) * 0.1, z: -Math.cos(ph) * 0.18 };
      }
      let drawn = false;
      if (isShooter && arrived) {
        if (plan) {
          const rel = Math.max(-1, tau);
          const follow = rel < 0 ? 0 : Math.min(1, rel / 0.12) * Math.exp(-Math.max(0, rel - 0.12) * 2.2);
          aimPose(rel < 0 ? 1 : 0.15, follow);
          // Sonuç belli olunca yayı indirir.
          if (st.contacted && tau > plan.hitAt + 0.8) baseStand(w, SIDE_YAW + 0.9, "smile");
        } else if (aiming) {
          aimPose(drawK, 0);
          drawn = true;
        }
      }
      const mood = st.mood[side];
      if (mood && !(isShooter && plan && tau < plan.hitAt + 0.3)) {
        if (mood.kind === "cheer") cheer(t, side, quiet);
        else dismay();
        m.yaw = Math.atan2(-1.2 - w.x, 6 - w.z);
      }
      if (fin && (inp.winner === 0 || inp.winner === 1)) {
        if (inp.winner === side) cheer(t, side * 2, quiet);
        else dismay();
        m.yaw = Math.atan2(-1.2 - w.x, 6 - w.z);
      }
      fig.poseBody(m, t);

      // Yay sol elde: nişanda dikey, dinlenirken eğik ve aşağıda.
      fig.handWorld(-1, grip);
      a.bow.group.position.copy(grip);
      const aimingBow = isShooter && arrived && (drawn || (plan && tau < plan.hitAt + 0.8));
      a.bow.group.rotation.set(aimingBow ? 0 : -0.5, aimingBow ? 0 : m.yaw + Math.PI / 2, aimingBow ? 0.06 : 0.9);
      a.bow.group.updateMatrixWorld();
      const tipT = a.bow.tipTop.clone().applyMatrix4(a.bow.group.matrixWorld);
      const tipB = a.bow.tipBottom.clone().applyMatrix4(a.bow.group.matrixWorld);
      fig.handWorld(1, hand);
      const pulling = isShooter && drawn;
      const mid = pulling ? hand.clone() : tipT.clone().add(tipB).multiplyScalar(0.5);
      const sp = a.string.geometry.attributes.position as THREE.BufferAttribute;
      sp.setXYZ(0, tipT.x, tipT.y, tipT.z);
      sp.setXYZ(1, mid.x, mid.y, mid.z);
      sp.setXYZ(2, tipB.x, tipB.y, tipB.z);
      sp.needsUpdate = true;
      if (pulling) {
        nockAt = hand.clone();
        gripAt = grip.clone();
      }
    });
    st.joy = st.joy.map((j) => j * Math.exp(-dt * 0.5)) as [number, number];
    setFans(t, st.joy, quiet);

    // -- oklar --
    if (plan && tau >= 0) {
      arrowAt(plan, tau, pos, dir);
      const wob = plan.sticks && !quiet ? quiver(plan, tau) : 0;
      // Ok ucu hedefe saplanır; çizilen nokta okun ucudur.
      placeArrow(flying, pos, dir, wob);
      flying.visible = !(st.contacted && !st.replay && plan.sticks);
    } else if (nockAt && gripAt) {
      // Yayda bekleyen ok: kuyruğu çekme elinde, ucu kabzanın önünde.
      const n = nockAt as THREE.Vector3;
      const g = gripAt as THREE.Vector3;
      dirV.copy(g).sub(n).normalize();
      const tipP = n.clone().addScaledVector(dirV, ARROW_LEN);
      placeArrow(flying, tipP, { x: dirV.x, y: dirV.y, z: dirV.z });
      flying.visible = true;
    } else flying.visible = false;
    stuck.forEach((a, i) => {
      const q = st.quiver[i];
      // Tekrar sırasında son ok yeniden uçar; hedefteki kopyası gizlenir.
      a.visible = !!q && !(st.replay && plan?.sticks && i === st.quiver.length - 1);
      if (!q) return;
      const last = i === st.quiver.length - 1 && plan && st.contacted && plan.sticks && !st.replay;
      placeArrow(a, q.at, q.dir, last && !quiet ? quiver(plan!, tau) : 0);
      a.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && (mesh.material as THREE.MeshStandardMaterial).side === THREE.DoubleSide) (mesh.material as THREE.MeshStandardMaterial).color.copy(tokenColor(teams[q.side].base));
      });
    });
    sparks.update(dt);

    // -- kamera --
    let shotCam: CamShot = QUESTION_SHOT;
    let rate = 2.4;
    if (aiming && !plan) {
      // Omuz üstünden hedefe: hedef büyükçe görünür, okçunun yüzü sağda.
      shotCam = { pos: { x: -2.3, y: 1.6, z: 2.3 }, look: { x: 0.9, y: 1.05, z: -4.2 }, fitW: 6.2, fitH: 3.6 };
    } else if (plan && !st.replay) {
      const hp: V3 = { x: 0, y: 0, z: 0 };
      arrowAt(plan, plan.hitAt, hp, { x: 0, y: 0, z: 0 });
      if (tau < plan.hitAt) {
        // Okun peşinden: arkasından ve biraz yukarıdan.
        arrowAt(plan, Math.max(0, tau), pos, dir);
        shotCam = { pos: { x: pos.x + 0.45, y: pos.y + 0.22, z: pos.z + 1.5 }, look: { x: hp.x, y: hp.y, z: hp.z }, fitW: 2.6, fitH: 1.8 };
        rate = 9;
      } else {
        // Hedefin yakın planı: okun saplandığı yer ortada.
        const look = plan.sticks ? { x: hp.x * 0.5, y: lerp(TARGET_Y, hp.y, 0.5), z: FACE_Z } : { x: hp.x, y: 0.3, z: hp.z };
        shotCam = { pos: { x: look.x + 0.9, y: look.y + 0.35, z: look.z + 2.6 }, look, fitW: plan.sticks ? 1.9 : 3, fitH: plan.sticks ? 1.5 : 2.2 };
        rate = st.cut ? 1 : 5;
        if (tau < plan.hitAt + dt * 1.5) st.cut = true;
      }
    }
    if (st.replay && plan) {
      // Ağır çekim: okun yanından, okla birlikte giden kamera.
      arrowAt(plan, Math.max(0, Math.min(tau, plan.hitAt)), pos, dir);
      const k = clamp01(tau / plan.hitAt);
      shotCam = { pos: { x: pos.x + lerp(0.9, 0.7, easeInOut(k)), y: pos.y + 0.12, z: pos.z + lerp(0.5, 0.9, k) }, look: { x: pos.x, y: pos.y, z: pos.z - 0.2 }, fitW: 1.2, fitH: 0.8 };
      rate = 12;
    } else if (fin && (inp.winner === 0 || inp.winner === 1)) {
      const p = archers[inp.winner].fig.root.position;
      const a = (quiet ? 0 : (t - fin.start) * 0.25) + (inp.winner === 0 ? -0.6 : 0.6);
      shotCam = { pos: { x: p.x + Math.sin(a) * 5, y: 2.1, z: p.z + Math.cos(a) * 5 }, look: { x: p.x, y: 1.2, z: p.z }, fitW: 5, fitH: 3.4 };
      rate = 1.6;
    }
    const kk = quiet || st.cut ? 1 : follow(rate, dt);
    st.cut = false;
    st.cam.pos.lerp(shotCam.pos as THREE.Vector3, kk);
    st.cam.look.lerp(shotCam.look as THREE.Vector3, kk);
    st.cam.fitW = lerp(st.cam.fitW, shotCam.fitW, kk);
    st.cam.fitH = lerp(st.cam.fitH, shotCam.fitH, kk);
    camera.position.copy(st.cam.pos);
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
      canvas.removeEventListener("webglcontextlost", onLost);
      boardTex.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
