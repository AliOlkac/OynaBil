import confetti from "canvas-confetti";
import * as THREE from "three";
import { cssColor } from "@/lib/color";
import { DARK, HAIR, PANTS, SKIN, STYLES } from "../../shared/kid";
import { FIGURE, KidFigure, type BodyMotion, type Mouth } from "../../shared/stage3d/figure";
import { canvasTexture, clamp01, createRenderer, disposeTree, easeInOut, follow, glowTexture, lerp, seeded, tierSettings, tokenColor, tokenCss } from "../../shared/stage3d/kit";
import { ChipPool } from "../../shared/stage3d/particles";
import { createFrameWatch, type Tier } from "../../shared/stage3d/support";
import { basketAudio } from "../audio";
import { RESULT_MADE, type Shot, type ShotResult } from "../logic";
import type { BasketSceneInput, SceneTeam } from "../scene/types";
import { ballAt, ballSpin, BALL_R, BOARD_BOTTOM, BOARD_H, BOARD_W, BOARD_Z, GATHER, LAND, NET_DEPTH, planShot, RELEASE, RIM_R, RIM_Y, shooterAt, spotFor, THREE_POINT, type ShotPlan, type V3 } from "../timeline";

/**
 * Basketbol sahnesinin üç boyutlu motoru: okul spor salonu, parke saha, pota ve file, tribündeki
 * çocuklar, takım sıraları. Bütün hareket tek bir requestAnimationFrame döngüsündedir. Topun yolu
 * `timeline.ts` içindeki saf fonksiyonlardan okunur; ağır çekim tekrar aynı yolu yavaş oynatır.
 */

export type EngineHandlers = { onContact: (index: number) => void; onShotDone: (index: number) => void; onFinale: () => void };

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  tier: Tier;
  teams: [SceneTeam, SceneTeam];
  getInput: () => BasketSceneInput;
  isReducedMotion: () => boolean;
  handlers: () => EngineHandlers;
  ui: { banner: (result: ShotResult | null, side: 0 | 1, points: number) => void; replay: (on: boolean) => void };
  onTier: (tier: Tier) => void;
  onGiveUp: (reason: "slow" | "lost") => boolean;
};

const KID = 0.9;
const STAND = 0.8 * KID;
const ANKLE = FIGURE.ankle * KID;
const NUMBERS = ["7", "23"];
/** Oyuncuların soru sırasında durduğu yer. */
const HOME: [V3, V3] = [
  { x: -1.9, y: 0, z: 2.9 },
  { x: 1.9, y: 0, z: 2.9 },
];
const BENCH_X = 6.4;
const REPLAY_SPEED = 0.38;

type CamShot = { pos: V3; look: V3; fitW: number; fitH: number };
const QUESTION_SHOT: CamShot = { pos: { x: 0, y: 3.1, z: 13 }, look: { x: 0, y: 1.9, z: 0.6 }, fitW: 13.5, fitH: 6.2 };

function ballTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = tokenCss("var(--color-ates)");
    ctx.fillRect(0, 0, w, h);
    const rnd = seeded(5);
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = `rgba(0,0,0,${(0.05 + rnd() * 0.08).toFixed(3)})`;
      ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    ctx.strokeStyle = tokenCss("var(--color-ink-950)");
    ctx.lineWidth = 7;
    // Ekvator ve iki boylam, ayrıca iki kavisli dikiş.
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    for (const u of [0, 0.5]) {
      ctx.moveTo(u * w + 2, 0);
      ctx.lineTo(u * w + 2, h);
    }
    ctx.stroke();
    for (const u of [0.25, 0.75]) {
      ctx.beginPath();
      for (let y = 0; y <= h; y += 4) {
        const k = y / h;
        const x = u * w + Math.sin(k * Math.PI) * w * 0.11 * (u < 0.5 ? 1 : -1);
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function parquetTexture() {
  const rnd = seeded(12);
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      const base = [tokenCss("var(--color-ahsap-acik)"), tokenCss("var(--color-ahsap)")];
      const rows = 16;
      const rowH = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -rnd() * 200;
        while (x < w) {
          const len = 120 + rnd() * 160;
          ctx.fillStyle = base[0];
          ctx.fillRect(x, r * rowH, len, rowH);
          ctx.fillStyle = `rgba(0,0,0,${(rnd() * 0.12).toFixed(3)})`;
          ctx.fillRect(x, r * rowH, len, rowH);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x, r * rowH, len, rowH * 0.25);
          ctx.strokeStyle = "rgba(0,0,0,0.25)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, r * rowH, len, rowH);
          x += len;
        }
      }
      ctx.fillStyle = base[1];
      ctx.globalAlpha = 0.12;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    },
    { repeat: [5, 5], anisotropy: 8 },
  );
}

/** Saha çizgileri ve boya alanı: tek bir tuvale çizilip parkenin üstüne serilir. */
function courtMarkings(teams: [SceneTeam, SceneTeam]) {
  const S = 1024;
  const half = 10;
  const px = (m: number) => ((m + half) / (half * 2)) * S;
  return canvasTexture(S, S, (ctx) => {
    ctx.clearRect(0, 0, S, S);
    const cream = tokenCss("var(--color-cream)");
    // Boya alanı: iki takımın renginin yarı yarıya karışımı yerine koyu lacivert.
    ctx.fillStyle = tokenCss("var(--color-ink-700)");
    ctx.globalAlpha = 0.85;
    ctx.fillRect(px(-1.8), px(-0.38 - 1.2 + 1.2), px(1.8) - px(-1.8), px(4.6) - px(0));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = cream;
    ctx.lineWidth = 7;
    ctx.strokeRect(px(-1.8), px(0), px(1.8) - px(-1.8), px(4.6) - px(0));
    // Serbest atış dairesi
    ctx.beginPath();
    ctx.arc(px(0), px(4.6), (1.8 / (half * 2)) * S, 0, Math.PI * 2);
    ctx.stroke();
    // Üç sayı çizgisi
    ctx.beginPath();
    ctx.arc(px(0), px(0), (THREE_POINT / (half * 2)) * S, 0.02, Math.PI - 0.02);
    ctx.stroke();
    // Orta çizgi ve orta daire (sahanın kamera tarafı)
    ctx.beginPath();
    ctx.moveTo(px(-half), px(9.6));
    ctx.lineTo(px(half), px(9.6));
    ctx.stroke();
    // Takım renginde kenar şeritleri
    ctx.fillStyle = tokenCss(teams[0].base);
    ctx.fillRect(px(-half), px(-1.2), px(-8.4) - px(-half), px(11) - px(-1.2));
    ctx.fillStyle = tokenCss(teams[1].base);
    ctx.fillRect(px(8.4), px(-1.2), px(half) - px(8.4), px(11) - px(-1.2));
  });
}

export function createBasketEngine(o: EngineOptions): { dispose: () => void } {
  const { canvas, teams } = o;
  let settings = tierSettings(o.tier);
  const renderer = createRenderer(canvas, o.tier);
  const watch = createFrameWatch(o.tier);

  const scene = new THREE.Scene();
  scene.background = tokenColor("var(--color-ink-900)");
  scene.fog = new THREE.Fog(tokenColor("var(--color-ink-900)"), 30, 70);
  const camera = new THREE.PerspectiveCamera(30, 2, 0.2, 200);

  // ---- ışıklar: tavan lambalarından yumuşak dolgu, sahaya yukarıdan ana ışık ----
  scene.add(new THREE.HemisphereLight(tokenColor("var(--color-cream)"), tokenColor("var(--color-ahsap)"), 1.9));
  const key = new THREE.DirectionalLight(tokenColor("var(--color-cream)"), 2.6);
  key.position.set(-4, 14, 9);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(settings.shadowSize);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 8, bottom: -6, near: 2, far: 40 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rimLight = new THREE.DirectionalLight(tokenColor("var(--color-firuze)"), 0.7);
  rimLight.position.set(6, 5, -8);
  scene.add(rimLight);

  // ---- salon ----
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ map: parquetTexture(), roughness: 0.42, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 8.8);
  floor.receiveShadow = true;
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ map: courtMarkings(teams), transparent: true, roughness: 0.5, depthWrite: false }));
  lines.rotation.x = -Math.PI / 2;
  lines.position.set(0, 0.004, 8.8);
  lines.receiveShadow = true;
  scene.add(floor, lines);
  const wallMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ink-800)"), roughness: 0.9 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), wallMat);
  wall.position.set(0, 7, -4.4);
  scene.add(wall);
  // Duvarda takım renginde şeritler ve iki pankart
  for (const [i, x] of [[0, -7.5], [1, 7.5]] as const) {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshStandardMaterial({ color: tokenColor(teams[i].base), roughness: 0.8 }));
    banner.position.set(x, 6.2, -4.35);
    scene.add(banner);
  }

  // Skor tabelası: duvarda, potanın üstünde.
  const boardCanvas = document.createElement("canvas");
  boardCanvas.width = 1024;
  boardCanvas.height = 256;
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  const scoreboard = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: boardTex }));
  scoreboard.position.set(0, 6.4, -4.3);
  scene.add(scoreboard);
  let boardKey = "";
  const drawBoard = (score: [number, number]) => {
    const k = score.join("-");
    if (k === boardKey) return;
    boardKey = k;
    const ctx = boardCanvas.getContext("2d")!;
    ctx.fillStyle = tokenCss("var(--color-ink-950)");
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = tokenCss("var(--color-ink-600)");
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 1014, 246);
    ctx.font = `800 150px "Lexend Variable", Lexend, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    for (const side of [0, 1] as const) {
      ctx.fillStyle = tokenCss(teams[side].base);
      ctx.fillRect(side === 0 ? 40 : 1024 - 40 - 60, 60, 60, 136);
      ctx.fillText(String(score[side]).padStart(2, "0"), side === 0 ? 300 : 724, 135);
    }
    ctx.fillStyle = tokenCss("var(--color-kehribar)");
    ctx.font = `800 70px "Lexend Variable", Lexend, system-ui, sans-serif`;
    ctx.fillText("—", 512, 132);
    boardTex.needsUpdate = true;
  };

  // ---- tribün: potanın arkasında iki blok, takım renginde çocuklar ----
  const crowd = new THREE.Group();
  const rows = Math.max(3, Math.min(7, settings.crowdRows[0] - 6));
  const perRow = 13;
  const seatMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ink-700)"), roughness: 0.8 });
  for (const side of [-1, 1]) {
    for (let r = 0; r < 7; r++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.45, 0.8), seatMat);
      step.position.set(side * 6.2, 0.22 + r * 0.45, -2.2 - r * 0.32);
      crowd.add(step);
    }
  }
  const bodyGeo = new THREE.CapsuleGeometry(0.16, 0.22, 3, 8);
  const headGeo = new THREE.SphereGeometry(0.13, 10, 8);
  const fans: { mesh: THREE.InstancedMesh; heads: THREE.InstancedMesh; base: { x: number; y: number; z: number; ph: number; side: 0 | 1 }[] } = (() => {
    const base: { x: number; y: number; z: number; ph: number; side: 0 | 1 }[] = [];
    const rnd = seeded(8);
    for (const s of [0, 1] as const) {
      const sx = s === 0 ? -1 : 1;
      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < perRow; i++) {
          if (rnd() < 0.12) continue;
          base.push({ x: sx * 6.2 + (i - (perRow - 1) / 2) * 0.56 + (rnd() - 0.5) * 0.1, y: 0.45 + r * 0.45 + 0.3, z: -2.2 - r * 0.32, ph: rnd() * 6, side: s });
        }
      }
    }
    const mesh = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial(), base.length);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial(), base.length);
    const c = new THREE.Color();
    base.forEach((b, i) => {
      mesh.setColorAt(i, rnd() < 0.8 ? tokenColor(teams[b.side].base) : tokenColor("var(--color-cream)"));
      heads.setColorAt(i, c.set(SKIN[Math.floor(rnd() * SKIN.length)]));
    });
    crowd.add(mesh, heads);
    return { mesh, heads, base };
  })();
  scene.add(crowd);
  const fanM = new THREE.Matrix4();
  const setFans = (time: number, joy: [number, number], quiet: boolean) => {
    fans.base.forEach((b, i) => {
      const hop = quiet ? 0 : joy[b.side] * Math.abs(Math.sin(time * 9 + b.ph)) * 0.22;
      fanM.makeTranslation(b.x, b.y + hop, b.z);
      fans.mesh.setMatrixAt(i, fanM);
      fanM.makeTranslation(b.x, b.y + 0.36 + hop, b.z);
      fans.heads.setMatrixAt(i, fanM);
    });
    fans.mesh.instanceMatrix.needsUpdate = true;
    fans.heads.instanceMatrix.needsUpdate = true;
  };

  // ---- pota: direk, kol, panya, çember, file ----
  const hoop = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ink-400)"), roughness: 0.4, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, RIM_Y + 0.9, 12), steel);
  pole.position.set(0, (RIM_Y + 0.9) / 2, BOARD_Z - 1.1);
  pole.castShadow = true;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.1), steel);
  arm.position.set(0, RIM_Y + 0.55, BOARD_Z - 0.55);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.6, 14), new THREE.MeshStandardMaterial({ color: tokenColor(teams[0].deep), roughness: 0.8 }));
  pad.position.set(0, 0.8, BOARD_Z - 1.1);
  const boardTexture = canvasTexture(512, 300, (ctx, w, h) => {
    ctx.fillStyle = "rgba(240,248,255,0.85)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = tokenCss("var(--color-mercan)");
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    const sq = { w: w * 0.33, h: h * 0.42 };
    ctx.lineWidth = 10;
    ctx.strokeRect((w - sq.w) / 2, h - sq.h - h * 0.08, sq.w, sq.h);
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, BOARD_H, 0.04), [steel, steel, steel, steel, new THREE.MeshStandardMaterial({ map: boardTexture, transparent: true, roughness: 0.15, metalness: 0.1 }), steel]);
  board.position.set(0, BOARD_BOTTOM + BOARD_H / 2, BOARD_Z - 0.02);
  board.castShadow = true;
  const rimMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-mercan)"), roughness: 0.35, metalness: 0.4 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.017, 8, 32), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, RIM_Y, 0);
  rim.castShadow = true;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.17), rimMat);
  neck.position.set(0, RIM_Y, -RIM_R - 0.07);
  hoop.add(pole, arm, pad, board, rim, neck);
  scene.add(hoop);

  // File: halkalar ve iplikler; top geçerken esner, sonra sallanır.
  const STRANDS = 14;
  const RINGS = 5;
  const netPos = new Float32Array(STRANDS * RINGS * 3);
  const netIdx: number[] = [];
  const vi = (i: number, j: number) => ((i + STRANDS) % STRANDS) + j * STRANDS;
  for (let j = 0; j < RINGS - 1; j++) for (let i = 0; i < STRANDS; i++) netIdx.push(vi(i, j), vi(i + (j % 2 ? 1 : 0), j + 1), vi(i, j), vi(i - (j % 2 ? 0 : 1), j + 1));
  const netGeo = new THREE.BufferGeometry();
  netGeo.setAttribute("position", new THREE.BufferAttribute(netPos, 3).setUsage(THREE.DynamicDrawUsage));
  netGeo.setIndex(netIdx);
  const net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: tokenColor("var(--color-cream)") }));
  net.frustumCulled = false;
  scene.add(net);
  const netState = { push: 0, wobble: 0 };
  const updateNet = (ball: V3 | null, time: number, quiet: boolean) => {
    for (let j = 0; j < RINGS; j++) {
      const k = j / (RINGS - 1);
      const baseY = RIM_Y - k * NET_DEPTH;
      let r = RIM_R * (1 - 0.38 * k);
      let y = baseY;
      if (ball && Math.hypot(ball.x, ball.z) < RIM_R && ball.y < RIM_Y + 0.1 && ball.y > RIM_Y - NET_DEPTH - 0.25) {
        // Top filenin içindeyken o hizadaki halka topu sarar ve aşağı çekilir.
        const near = 1 - Math.min(1, Math.abs(ball.y - baseY) / 0.22);
        r = Math.max(r, (BALL_R + 0.015) * near + r * (1 - near));
        y -= near * 0.05;
      }
      const wob = quiet ? 0 : netState.wobble * Math.sin(time * 26 + j) * 0.03 * k;
      for (let i = 0; i < STRANDS; i++) {
        const a = ((i + (j % 2) * 0.5) / STRANDS) * Math.PI * 2;
        netPos.set([Math.cos(a) * (r + wob), y - (netState.push * 0.06 * k), Math.sin(a) * (r + wob)], vi(i, j) * 3);
      }
    }
    netGeo.attributes.position.needsUpdate = true;
  };

  // ---- top ----
  const ballMat = new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.65 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), ballMat);
  ball.castShadow = true;
  scene.add(ball);
  const glow = glowTexture(64);
  const TRAIL = 7;
  const trail = Array.from({ length: TRAIL }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.5 * (1 - i / TRAIL) }));
    s.visible = false;
    scene.add(s);
    return s;
  });
  const trailPos: THREE.Vector3[] = [];
  const sparks = new ChipPool(60, 7);
  scene.add(sparks.mesh);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
  const ballBlob = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 1.2, 16), blobMat);
  ballBlob.rotation.x = -Math.PI / 2;
  ballBlob.renderOrder = 1;
  scene.add(ballBlob);

  // ---- çocuklar: her takımın oyuncusu (forma numaralı) ve sırada oturan iki takım arkadaşı ----
  const mkKid = (side: 0 | 1, k: number, number?: string) => {
    const fig = new KidFigure({
      skin: SKIN[(k * 3 + side * 2) % SKIN.length],
      hair: HAIR[(k * 2 + side * 3) % HAIR.length],
      hairStyle: STYLES[(k + side * 2) % STYLES.length],
      shirt: teams[side].base,
      trim: teams[side].deep,
      shorts: teams[side].deep,
      socks: "var(--color-cream)",
      boots: DARK,
      number,
      numberOn: "back",
      numberColor: "var(--color-cream)",
      scale: KID,
    });
    scene.add(fig.root);
    return fig;
  };
  const players = ([0, 1] as const).map((side) => mkKid(side, 0, NUMBERS[side]));
  const bench = ([0, 1] as const).flatMap((side) => [1, 2].map((k) => ({ side, k, fig: mkKid(side, k) })));
  const benchMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ahsap)"), roughness: 0.7 });
  for (const s of [-1, 1]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 2.6), benchMat);
    seat.position.set(s * (BENCH_X + 0.4), 0.21, 4.2);
    seat.castShadow = seat.receiveShadow = true;
    scene.add(seat);
  }
  void PANTS;

  // ---- durum ----
  const start = o.getInput();
  const st = {
    time: 0,
    last: performance.now(),
    aspect: 2,
    cut: true,
    cam: { pos: new THREE.Vector3(), look: new THREE.Vector3(), fitW: 12, fitH: 6 },
    seenShots: start.shots.length,
    plan: null as ShotPlan | null,
    shotIndex: -1,
    shotStart: 0,
    shot: null as Shot | null,
    fired: new Set<number>(),
    contacted: false,
    resolved: false,
    replay: null as null | { start: number },
    doneCalled: false,
    joy: [0, 0] as [number, number],
    mood: [null, null] as ({ kind: "cheer" | "dismay"; start: number } | null)[],
    // Atış hakkı kazanan oyuncu atış noktasına yürür; mesafe seçilene kadar topu sektirir.
    walk: [{ ...HOME[0] }, { ...HOME[1] }] as V3[],
    finale: start.phase === "finished" ? { start: -10, called: false, confetti: true } : (null as null | { start: number; called: boolean; confetti: boolean }),
    lastPhase: start.phase,
    lastDribble: 0,
  };
  // Yeniden açılan oyunda skor tabelası son hâliyle gelir.
  const scoreOf = (n: number): [number, number] => {
    const s: [number, number] = [0, 0];
    o.getInput().shots.slice(0, n).forEach((x) => (s[x.side] += x.points));
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
    key.shadow.mapSize.setScalar(settings.shadowSize);
    key.shadow.map?.dispose();
    key.shadow.map = null;
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
  const handsV = new THREE.Vector3();
  const faceTo = (from: V3, to: V3) => Math.atan2(to.x - from.x, to.z - from.z);
  const baseStand = (at: V3, yaw: number, mouth: Mouth) => {
    m.x = at.x;
    m.z = at.z;
    m.yaw = yaw;
    m.hip = STAND;
    m.lean = 0.04;
    m.headPitch = 0;
    m.mouth = mouth;
    m.footL = { x: -0.11 * KID, y: ANKLE, z: 0 };
    m.footR = { x: 0.11 * KID, y: ANKLE, z: 0.04 };
    m.handL = { x: -0.3 * KID, y: STAND + 0.02, z: 0.05 };
    m.handR = { x: 0.3 * KID, y: STAND + 0.02, z: 0.05 };
  };
  const cheer = (t: number, ph: number, quiet: boolean) => {
    const hop = quiet ? 0 : Math.abs(Math.sin(t * 7 + ph)) * 0.3;
    m.hip = STAND + hop;
    m.footL = { x: -0.13 * KID, y: ANKLE + hop * 0.85, z: 0 };
    m.footR = { x: 0.13 * KID, y: ANKLE + hop * 0.85, z: 0 };
    m.handL = { x: -0.34 * KID, y: m.hip + 1.02 * KID, z: 0.08 };
    m.handR = { x: 0.34 * KID, y: m.hip + 1.02 * KID, z: 0.08 };
    m.mouth = "grin";
    m.headPitch = -0.2;
  };
  const dismay = () => {
    m.handL = { x: -0.15 * KID, y: m.hip + 0.84 * KID, z: 0.1 };
    m.handR = { x: 0.15 * KID, y: m.hip + 0.84 * KID, z: 0.1 };
    m.mouth = "shock";
    m.lean = 0.15;
    m.headPitch = 0.3;
  };

  const ballPos = new THREE.Vector3();
  const tmpV: V3 = { x: 0, y: 0, z: 0 };
  const hoopLook = new THREE.Vector3(0, RIM_Y - 0.4, 0);

  const frame = (now: number) => {
    if (stopped) return;
    const realMs = now - st.last;
    const dt = Math.min(0.05, realMs / 1000);
    st.last = now;
    st.time += dt;
    const t = st.time;
    const inp = o.getInput();
    const quiet = o.isReducedMotion();
    const wall = Date.now();

    const verdict = watch.sample(realMs);
    if (verdict === "in") applyTier(watch.tier);
    else if (verdict === "vazgec" && o.onGiveUp("slow")) return;

    // -- yeni atış --
    if (inp.shots.length > st.seenShots) {
      // Kaçırılmış atışlar (sahne sonradan açıldıysa) gösterilmeden sayılır.
      for (let i = st.seenShots; i < inp.shots.length - 1; i++) {
        o.handlers().onContact(i);
        o.handlers().onShotDone(i);
      }
      const index = inp.shots.length - 1;
      st.seenShots = inp.shots.length;
      st.shot = inp.shots[index];
      st.shotIndex = index;
      st.plan = planShot(st.shot, index, KID);
      st.shotStart = t;
      st.fired = new Set();
      st.contacted = st.resolved = st.doneCalled = false;
      st.replay = null;
      trailPos.length = 0;
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

    // -- atışın olayları: ses, skor, tepkiler --
    const plan = st.plan;
    const shot = st.shot;
    let tau = plan ? t - st.shotStart : -1;
    if (plan && shot) {
      for (const [k, e] of plan.events.entries()) {
        if (st.fired.has(k) || tau < e.t) continue;
        st.fired.add(k);
        if (tau - e.t > 0.4) continue;
        if (e.kind === "release") basketAudio.bounce(0);
        else if (e.kind === "rim") {
          basketAudio.rim(e.strength);
          netState.wobble = Math.max(netState.wobble, 0.6 * e.strength);
        } else if (e.kind === "board") basketAudio.board();
        else if (e.kind === "net") {
          basketAudio.swish();
          netState.wobble = 1;
          netState.push = 1;
        } else if (e.kind === "floor") basketAudio.bounce(e.strength);
      }
      // Basket ya da kaçış belli olunca: skor, spiker, tribün.
      const decided = plan.made ? plan.madeAt! : (plan.events.find((e) => e.kind === "floor" || e.kind === "board" || e.kind === "rim")?.t ?? plan.end) + 0.25;
      if (!st.contacted && tau >= decided) {
        st.contacted = true;
        o.handlers().onContact(st.shotIndex);
        const other = (1 - shot.side) as 0 | 1;
        if (plan.made) {
          basketAudio.crowdCheer();
          basketAudio.say(shot.result === "temiz" && shot.range === 2 ? "temiz" : shot.range === 3 ? "uclu" : shot.result === "cember" ? "cember" : "basket", 0.15);
          st.mood[shot.side] = { kind: "cheer", start: t };
          st.mood[other] = { kind: "dismay", start: t };
          st.joy[shot.side] = 1;
          if (!quiet) for (let i = 0; i < 28; i++) sparks.emit({ x: (Math.random() - 0.5) * 0.4, y: RIM_Y - 0.2, z: (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 4, vy: 1.5 + Math.random() * 3, vz: Math.random() * 3, size: 0.05 + Math.random() * 0.05, life: 1.2, color: tokenColor(i % 3 === 0 ? "var(--color-kehribar)" : teams[shot.side].base) });
        } else {
          basketAudio.crowdOoh();
          basketAudio.say(shot.result === "kisa" ? "kisa" : "kacti", 0.1);
          st.mood[shot.side] = { kind: "dismay", start: t };
        }
        o.ui.banner(shot.result, shot.side, shot.points);
      }
      // Tekrar: basketler ve çemberden dönen toplar ağır çekimde, potanın yanından.
      const wantsReplay = !quiet && shot.result !== "kisa";
      if (!st.replay && wantsReplay && tau > plan.replay.to + 0.6 && !st.doneCalled) {
        st.replay = { start: t };
        st.fired = new Set(plan.events.map((_, k) => k));
        o.ui.replay(true);
      }
      const replayLen = (plan.replay.to - plan.replay.from) / REPLAY_SPEED;
      if (st.replay && t - st.replay.start > replayLen) {
        st.replay = null;
        o.ui.replay(false);
        st.doneCalled = true;
        o.handlers().onShotDone(st.shotIndex);
      }
      if (!wantsReplay && !st.doneCalled && tau > Math.max(plan.end, (plan.madeAt ?? 0) + 1.4)) {
        st.doneCalled = true;
        o.handlers().onShotDone(st.shotIndex);
      }
    }
    if (st.replay && plan) tau = plan.replay.from + (t - st.replay.start) * REPLAY_SPEED;

    // -- skor tabelası: top fileden geçince güncellenir --
    if (st.contacted) shownShots = Math.max(shownShots, st.shotIndex + 1);
    else if (!plan) shownShots = inp.shots.length;
    drawBoard(scoreOf(shownShots));

    // -- bitiş --
    if (inp.phase === "finished" && !st.finale && (!plan || st.doneCalled)) st.finale = { start: t, called: false, confetti: false };
    const fin = st.finale;
    if (fin) {
      if (!fin.confetti && t - fin.start > 0.2) {
        fin.confetti = true;
        basketAudio.buzzer();
        const w = inp.winner;
        if (w === 0 || w === 1) {
          basketAudio.crowdCheer();
          basketAudio.say("bitis", 1.2);
          st.joy[w] = 1;
          if (!quiet) confetti({ particleCount: 140, spread: 110, startVelocity: 48, origin: { x: 0.5, y: 0.35 }, colors: [teams[w].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor), disableForReducedMotion: true });
        } else basketAudio.say("berabere", 1.2);
      }
      if (!fin.called && t - fin.start > 2.4) {
        fin.called = true;
        o.handlers().onFinale();
      }
    }

    // -- çocuklar --
    const aiming = inp.phase === "aim" && inp.shooter !== null;
    const shooterSide = plan && shot ? shot.side : aiming ? inp.shooter! : null;
    const spotNow: V3 | null = plan ? plan.spot : aiming && inp.range ? spotFor(inp.range, inp.shots.length) : null;
    ([0, 1] as const).forEach((side) => {
      const fig = players[side];
      const isShooter = shooterSide === side;
      const target = isShooter && spotNow ? spotNow : isShooter ? { x: HOME[side].x * 0.5, y: 0, z: 3.6 } : HOME[side];
      const w = st.walk[side];
      const kk = quiet ? 1 : follow(3.2, dt);
      const moving = Math.hypot(target.x - w.x, target.z - w.z) > 0.05;
      w.x = lerp(w.x, target.x, kk);
      w.z = lerp(w.z, target.z, kk);
      baseStand(w, faceTo(w, { x: 0, y: 0, z: 0 }), "smile");
      if (moving && !quiet) {
        const ph = t * 9;
        m.footL = { x: -0.1 * KID, y: ANKLE + Math.max(0, Math.sin(ph)) * 0.1, z: Math.cos(ph) * 0.18 };
        m.footR = { x: 0.1 * KID, y: ANKLE + Math.max(0, -Math.sin(ph)) * 0.1, z: -Math.cos(ph) * 0.18 };
      }
      let holding = false;
      if (isShooter && plan && tau >= 0 && tau < LAND + 0.6) {
        // Atış: çömelir, sıçrar, topu en yüksekte bırakır.
        const p = shooterAt(tau);
        m.hip = STAND * (1 - 0.28 * p.crouch) + p.lift;
        m.footL = { x: -0.12 * KID, y: ANKLE + p.lift * 0.95, z: 0 };
        m.footR = { x: 0.12 * KID, y: ANKLE + p.lift * 0.95, z: 0.05 };
        const handY = lerp(m.hip + 0.45 * KID, m.hip + 1.08 * KID, p.arms);
        const handZ = lerp(0.28, 0.14, p.arms) + p.flick * 0.12;
        m.handL = { x: -0.1, y: handY - 0.04, z: handZ };
        m.handR = { x: 0.04, y: handY, z: handZ - 0.03 };
        m.lean = 0.08 - p.arms * 0.08;
        m.headPitch = -0.25 * p.arms;
        m.mouth = "focus";
        holding = tau < RELEASE;
      } else if (isShooter && aiming) {
        // Topu sektirir: mesafe seçilince atış noktasında, seçilmeden önce bulunduğu yerde.
        m.mouth = "focus";
        const period = 0.6;
        const ph = (t % period) / period;
        const by = 0.25 + Math.abs(Math.cos(ph * Math.PI)) * 0.55;
        m.handR = { x: 0.26 * KID, y: Math.max(by + 0.12, STAND - 0.05), z: 0.24 };
        m.lean = 0.12;
        if (!quiet && ph < st.lastDribble) basketAudio.bounce(0.15);
        st.lastDribble = ph;
        holding = true;
        fig.poseBody(m, t);
        const c = Math.cos(m.yaw);
        const s = Math.sin(m.yaw);
        const lx = 0.26 * KID;
        const lz = 0.3;
        ballPos.set(w.x + lx * c + lz * s, quiet ? STAND + 0.1 : by, w.z - lx * s + lz * c);
      }
      if (shooterSide !== null && !isShooter && plan && tau > GATHER && tau < LAND + 0.3) {
        // Savunmacı: atış sırasında elini kaldırıp sıçrar (top ona hiç değmez).
        const k = clamp01((tau - GATHER) / 0.5);
        const hop = Math.sin(Math.min(1, k) * Math.PI) * 0.25;
        m.hip = STAND + hop;
        m.footL = { x: -0.12 * KID, y: ANKLE + hop, z: 0 };
        m.footR = { x: 0.12 * KID, y: ANKLE + hop, z: 0 };
        m.handL = { x: -0.2 * KID, y: m.hip + 1.05 * KID, z: 0.1 };
        m.handR = { x: 0.2 * KID, y: m.hip + 1.05 * KID, z: 0.1 };
        m.mouth = "shock";
      }
      const mood = st.mood[side];
      if (mood && !(isShooter && plan && tau < LAND)) {
        if (mood.kind === "cheer") cheer(t, side, quiet);
        else dismay();
      }
      if (fin && (inp.winner === 0 || inp.winner === 1)) {
        if (inp.winner === side) cheer(t, side * 2, quiet);
        else dismay();
      }
      if (!(isShooter && aiming && !plan)) fig.poseBody(m, t);
      if (holding && isShooter && plan) {
        fig.handsCentre(handsV);
        ballPos.copy(handsV).add({ x: 0, y: 0.1, z: 0 } as THREE.Vector3);
      }
    });
    // Sıradaki takım arkadaşları: oturur, basketle ayağa kalkıp sevinir.
    bench.forEach(({ side, k, fig }) => {
      const sx = side === 0 ? -1 : 1;
      const at = { x: sx * BENCH_X, y: 0, z: 3.5 + k * 0.85 };
      baseStand(at, sx < 0 ? Math.PI / 2 : -Math.PI / 2, "smile");
      const mood = st.mood[side];
      const up = (mood?.kind === "cheer" && t - mood.start < 3) || (fin && inp.winner === side);
      if (up) cheer(t, k + side, quiet);
      else {
        // Oturuş: kalça sıranın üstünde, dizler önde.
        m.hip = 0.62;
        m.footL = { x: -0.12 * KID, y: ANKLE, z: 0.42 };
        m.footR = { x: 0.12 * KID, y: ANKLE, z: 0.42 };
        m.handL = { x: -0.2, y: 0.62, z: 0.3 };
        m.handR = { x: 0.2, y: 0.62, z: 0.3 };
        if (mood?.kind === "dismay" && t - mood.start < 2.5) dismay();
      }
      fig.poseBody(m, t);
      fig.root.position.x = at.x + (up ? 0 : -sx * 0.12);
    });
    st.joy = st.joy.map((j) => j * Math.exp(-dt * 0.5)) as [number, number];
    setFans(t, st.joy, quiet);

    // -- top --
    let flying = false;
    if (plan && tau >= RELEASE) {
      ballAt(plan, Math.min(tau, plan.end + 5), tmpV);
      ballPos.set(tmpV.x, tmpV.y, tmpV.z);
      ball.rotation.set(-ballSpin(plan, tau), 0, 0);
      flying = tau < (plan.madeAt ?? plan.events.find((e) => e.kind !== "release")!.t);
    } else if (!aiming || plan) {
      if (!plan) {
        // Top soru sırasında potanın altında durur.
        ballPos.set(0.6, BALL_R, 1.2);
      }
    }
    ball.position.copy(ballPos);
    ballBlob.visible = !settings.shadows;
    ballBlob.position.set(ballPos.x, 0.01, ballPos.z);
    updateNet(plan && tau >= RELEASE ? tmpV : null, t, quiet);
    netState.wobble *= Math.exp(-dt * 2.2);
    netState.push *= Math.exp(-dt * 3);
    if (flying && !quiet) trailPos.unshift(ballPos.clone());
    if (trailPos.length > TRAIL * 2) trailPos.length = TRAIL * 2;
    const fire = shot?.onFire ?? false;
    trail.forEach((s, i) => {
      const p = flying && !quiet ? trailPos[i * 2 + 1] : undefined;
      s.visible = !!p;
      if (!p) return;
      s.position.copy(p);
      s.scale.setScalar((fire ? 0.7 : 0.4) * (1 - i / (TRAIL + 2)));
      s.material.color.copy(tokenColor(fire ? "var(--color-ates)" : "var(--color-cream)"));
    });
    sparks.update(dt);

    // -- kamera --
    let shotCam: CamShot = QUESTION_SHOT;
    let rate = 2.4;
    if (aiming && !plan) {
      const sp = spotNow ?? { x: 0, y: 0, z: 4.2 };
      const d = Math.hypot(sp.x, sp.z) || 1;
      const back = spotNow ? 3.4 : 5;
      shotCam = { pos: { x: sp.x + (sp.x / d) * back, y: 2.1, z: sp.z + (sp.z / d) * back }, look: { x: sp.x * 0.3, y: RIM_Y - 0.55, z: sp.z * 0.3 }, fitW: 7, fitH: 5.4 };
    } else if (plan && !st.replay && tau < (plan.madeAt ?? plan.end) + 2.2) {
      const sp = plan.spot;
      const d = Math.hypot(sp.x, sp.z) || 1;
      const k = clamp01((tau - RELEASE) / 0.9);
      shotCam = {
        pos: { x: sp.x + (sp.x / d) * lerp(3.4, 2.4, easeInOut(k)), y: lerp(2.1, 2.5, k), z: sp.z + (sp.z / d) * lerp(3.4, 2.4, easeInOut(k)) },
        look: { x: lerp(sp.x * 0.3, 0, k), y: lerp(RIM_Y - 0.55, RIM_Y - 0.35, k), z: lerp(sp.z * 0.3, 0, k) },
        fitW: lerp(7, 5, k),
        fitH: lerp(5.4, 4.2, k),
      };
      rate = 3;
    }
    if (st.replay && plan) {
      const s = plan.spot.x >= 0 ? -1 : 1;
      shotCam = { pos: { x: s * 2.8, y: 1.6, z: 2.4 }, look: { x: 0, y: RIM_Y - 0.05, z: -0.1 }, fitW: 3.2, fitH: 2.9 };
      st.cut = st.cut || t - st.replay.start < dt * 1.5;
    } else if (fin && (inp.winner === 0 || inp.winner === 1)) {
      const p = players[inp.winner].root.position;
      const a = (quiet ? 0 : (t - fin.start) * 0.25) + (inp.winner === 0 ? -0.5 : 0.5);
      shotCam = { pos: { x: p.x + Math.sin(a) * 5.5, y: 2.2, z: p.z + Math.cos(a) * 5.5 }, look: { x: p.x, y: 1.3, z: p.z }, fitW: 5.5, fitH: 3.6 };
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
    void hoopLook;
    void wall;
    void RESULT_MADE;

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
