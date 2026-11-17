import confetti from "canvas-confetti";
import * as THREE from "three";
import { cssColor } from "@/lib/color";
import { sfx } from "@/lib/sound";
import { DARK, HAIR, PANTS, SKIN, STYLES } from "../../shared/kid";
import { FIGURE, KidFigure, type BodyMotion, type Mouth } from "../../shared/stage3d/figure";
import { canvasTexture, clamp01, createRenderer, disposeTree, easeInOut, follow, glowTexture, lerp, placeSegment, seeded, tierSettings, tokenColor, tokenCss } from "../../shared/stage3d/kit";
import { ChipPool, DustPool } from "../../shared/stage3d/particles";
import { createFrameWatch, type Tier } from "../../shared/stage3d/support";
import type { SceneInput, SceneTeam } from "../scene/TugScene";

/**
 * Halat Çekme'nin üç boyutlu motoru. Çizim sahnesiyle (TugScene) aynı girdiyi alır: ipin konumu,
 * son doğru ve yanlış cevap anları, donma ve kazanan. Dörder çocuk ipe asılır; doğru cevapta takım
 * ipi çeker, yanlışta buz keser, kurdele çizgiye ulaşınca kaybeden takım çamura kapaklanır.
 */

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  tier: Tier;
  teams: [SceneTeam, SceneTeam];
  getInput: () => SceneInput;
  isReducedMotion: () => boolean;
  onTier: (tier: Tier) => void;
  onGiveUp: (reason: "slow" | "lost") => boolean;
};

const PULLERS = 4;
/** En öndeki çocuğun merkeze uzaklığı, çocuklar arası mesafe ve ipin gidebileceği yol (metre). */
const FRONT = 2.15;
const SPACING = 0.92;
const TRAVEL = 1.3;
const ROPE_Y = 0.74;
const PIT_R = 0.95;
const KID = 0.9;
const STAND = 0.8 * KID;
const ANKLE = FIGURE.ankle * KID;

const easeIn = (t: number) => t * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

function ropeTexture() {
  return canvasTexture(
    64,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = tokenCss("var(--color-ip)");
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = tokenCss("var(--color-ip-koyu)");
      ctx.lineWidth = 9;
      for (let i = -2; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-10, i * 22);
        ctx.lineTo(w + 10, i * 22 + 34);
        ctx.stroke();
      }
    },
    { repeat: [1, 6] },
  );
}

function grassTexture() {
  const rnd = seeded(4);
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = tokenCss("var(--color-saha)");
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1100; i++) {
        ctx.fillStyle = rnd() < 0.6 ? tokenCss("var(--color-saha-acik)") : tokenCss("var(--color-servi)");
        ctx.globalAlpha = 0.25 + rnd() * 0.4;
        ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 5 + rnd() * 10);
      }
      ctx.globalAlpha = 1;
    },
    { repeat: [14, 14], anisotropy: 8 },
  );
}

export function createTugEngine(o: EngineOptions): { dispose: () => void } {
  const { canvas, teams } = o;
  let settings = tierSettings(o.tier);
  const renderer = createRenderer(canvas, o.tier);
  const watch = createFrameWatch(o.tier);

  const scene = new THREE.Scene();
  const night = tokenColor("var(--color-ink-800)");
  scene.background = night;
  scene.fog = new THREE.Fog(night, 26, 80);
  const camera = new THREE.PerspectiveCamera(22, 4, 0.3, 200);

  // ---- ışıklar: akşam göğü, sahayı aydınlatan sıcak projektör, arkadan serin kontur ----
  scene.add(new THREE.HemisphereLight(tokenColor("var(--color-ink-300)"), tokenColor("var(--color-saha)"), 2.1));
  const key = new THREE.DirectionalLight(tokenColor("var(--color-cream)"), 3.4);
  key.position.set(-6, 12, 10);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(settings.shadowSize);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.03;
  const rim = new THREE.DirectionalLight(tokenColor("var(--color-firuze)"), 1.2);
  rim.position.set(8, 6, -10);
  scene.add(key, key.target, rim);

  // ---- saha ----
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 20, 12),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(16, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, tokenCss("var(--color-ink-950)"));
        g.addColorStop(0.42, tokenCss("var(--color-ink-900)"));
        g.addColorStop(0.5, tokenCss("var(--color-ink-700)"));
        g.addColorStop(1, tokenCss("var(--color-ink-700)"));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }),
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  scene.add(sky);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 160), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -50;
  ground.receiveShadow = true;
  scene.add(ground);
  const backdrop = new THREE.Group();
  const rnd = seeded(21);
  for (const layer of [{ z: -60, h: 9, tone: 0.5 }, { z: -34, h: 4.5, tone: 0.2 }]) {
    const shape = new THREE.Shape();
    shape.moveTo(-130, -2);
    const ph = rnd() * 6;
    for (let x = -130; x <= 130; x += 5) shape.lineTo(x, Math.max(0.6, layer.h * (0.55 + 0.3 * Math.sin(x * 0.045 + ph) + 0.15 * Math.sin(x * 0.13 + ph * 2))));
    shape.lineTo(130, -2);
    const hill = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-servi)").lerp(night, layer.tone), fog: false }));
    hill.position.z = layer.z;
    backdrop.add(hill);
  }
  const leaves = new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-servi)") });
  const trees = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.6, 7), leaves);
    t.position.set(-22 + i * 4 + rnd() * 2, 2.3, -9 - rnd() * 9);
    t.scale.setScalar(0.8 + rnd() * 0.6);
    trees.add(t);
  }
  backdrop.add(trees);
  scene.add(backdrop);
  // Şenlik flamaları: iki takımın renginde, sahanın arkasında gerili.
  const bunting = new THREE.Group();
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.16, 0, 0, 0.16, 0, 0, 0, -0.36, 0]), 3));
  flagGeo.computeVertexNormals();
  const flagMats = [teams[0].base, "var(--color-cream)", teams[1].base].map((c) => new THREE.MeshBasicMaterial({ color: tokenColor(c), side: THREE.DoubleSide, fog: false }));
  for (let i = 0; i < 44; i++) {
    const k = i / 43;
    const f = new THREE.Mesh(flagGeo, flagMats[i % 3]);
    f.position.set(lerp(-9.5, 9.5, k), 3.25 - Math.sin(((k * 4) % 1) * Math.PI) * 0.32, -2.6);
    bunting.add(f);
  }
  for (const x of [-9.5, -4.75, 0, 4.75, 9.5]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.3, 6), new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-ahsap)") }));
    pole.position.set(x, 1.65, -2.6);
    pole.castShadow = true;
    bunting.add(pole);
  }
  scene.add(bunting);

  // Çamur havuzu ve çizgiler.
  const pit = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-camur-koyu)"), roughness: 0.25, metalness: 0.1 }));
  pit.rotation.x = -Math.PI / 2;
  pit.scale.set(PIT_R, PIT_R * 0.9, 1);
  pit.position.y = 0.02;
  pit.receiveShadow = true;
  const pitRim = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.2, 28), new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-camur)"), roughness: 0.9 }));
  pitRim.rotation.x = -Math.PI / 2;
  pitRim.scale.copy(pit.scale);
  pitRim.position.y = 0.025;
  pitRim.receiveShadow = true;
  scene.add(pit, pitRim);
  ([0, 1] as const).forEach((side) => {
    const dir = side === 0 ? -1 : 1;
    // Takımın çizgisi: kurdele buraya ulaşınca o takım kazanır.
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 2.6), new THREE.MeshBasicMaterial({ color: tokenColor(teams[side].base), transparent: true, opacity: 0.85 }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(dir * TRAVEL, 0.03, 0);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-cream)") }));
    pole.position.set(dir * TRAVEL, 0.75, -1.25);
    pole.castShadow = true;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshBasicMaterial({ color: tokenColor(teams[side].base), side: THREE.DoubleSide }));
    flag.position.set(dir * (TRAVEL + 0.26), 1.3, -1.25);
    scene.add(line, pole, flag);
  });

  // ---- çocuklar ----
  const KIDS = ([0, 1] as const).flatMap((side) => Array.from({ length: PULLERS }, (_, k) => ({ side, k })));
  const figs = KIDS.map(({ side, k }) => {
    const fig = new KidFigure({
      skin: SKIN[(k * 3 + side) % SKIN.length],
      hair: HAIR[(k * 2 + side * 3) % HAIR.length],
      hairStyle: STYLES[(k + side * 2) % STYLES.length],
      shirt: teams[side].base,
      trim: teams[side].deep,
      shorts: PANTS,
      socks: teams[side].deep,
      boots: DARK,
      scale: KID,
    });
    fig.root.rotation.order = "YXZ";
    scene.add(fig.root);
    return fig;
  });
  // Yanlış cevapta takım buz keser: her çocuğun çevresinde yarı saydam bir buz kalıbı.
  const iceMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-kobalt)").lerp(tokenColor("var(--color-cream)"), 0.6), transparent: true, opacity: 0.42, roughness: 0.15, depthWrite: false });
  const ices = KIDS.map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.62, 0.62), iceMat);
    m.visible = false;
    m.renderOrder = 3;
    scene.add(m);
    return m;
  });
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const blobs = KIDS.map(() => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16), blobMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.035;
    scene.add(m);
    return m;
  });

  // ---- ip: el el uzanan parçalar, ortada kurdele ----
  const ropeMat = new THREE.MeshStandardMaterial({ map: ropeTexture(), roughness: 0.9 });
  const SEGMENTS = 2 * (PULLERS + 1) + 8;
  const ropeGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 7);
  ropeGeo.translate(0, 0.5, 0);
  const segs = Array.from({ length: SEGMENTS }, () => {
    const m = new THREE.Mesh(ropeGeo, ropeMat);
    m.castShadow = true;
    scene.add(m);
    return m;
  });
  const ribbon = new THREE.Group();
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-mercan)") }));
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.42), new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-mercan)"), side: THREE.DoubleSide }));
  tail.position.y = -0.24;
  ribbon.add(knot, tail);
  scene.add(ribbon);

  // ---- parçacıklar ----
  const glow = glowTexture(64);
  const dust = new DustPool(40, glow);
  const mud = new ChipPool(70, 13);
  scene.add(dust.group, mud.mesh);
  const C = { toz: tokenColor("var(--color-toz)"), camur: [tokenColor("var(--color-camur)"), tokenColor("var(--color-camur-koyu)"), tokenColor("var(--color-camur-parlak)")] };
  const calm = () => o.isReducedMotion();
  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  // ---- durum ----
  const start = o.getInput();
  const st = {
    time: 0,
    last: performance.now(),
    aspect: 4,
    offset: 0,
    vel: 0,
    impulse: [0, 0],
    yank: [0, 0],
    lastPull: [...start.pullAt] as number[],
    lastMiss: [...start.missAt] as number[],
    back: KIDS.map(() => 0),
    endStart: null as number | null,
    endOffset: null as number | null,
    // Oyun bitmiş hâlde açıldıysa gösteri atlanır, son kare çizilir.
    skipEnding: start.phase === "finished",
    splashed: false,
    cheered: false,
    snapped: false,
    cut: true,
    cam: new THREE.Vector3(),
    look: new THREE.Vector3(),
    fitW: 15,
  };
  const motion: BodyMotion = { x: 0, z: 0, hip: STAND, yaw: 0, footL: { x: 0, y: 0, z: 0 }, footR: { x: 0, y: 0, z: 0 }, handL: { x: 0, y: 0, z: 0 }, handR: { x: 0, y: 0, z: 0 } };
  const hands = KIDS.map(() => new THREE.Vector3());
  const holding = KIDS.map(() => true);
  const pts: THREE.Vector3[] = Array.from({ length: SEGMENTS + 2 }, () => new THREE.Vector3());

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
    trees.visible = bunting.visible = settings.extras;
    scene.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) m.needsUpdate = true;
    });
    resize();
    o.onTier(next);
  };
  trees.visible = bunting.visible = settings.extras;

  let stopped = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    stopped = true;
    o.onGiveUp("lost");
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const frame = (now: number) => {
    if (stopped) return;
    const realMs = now - st.last;
    const dt = Math.min(0.05, realMs / 1000);
    st.last = now;
    st.time += dt;
    const t = st.time;
    const inp = o.getInput();
    const quiet = calm();

    const verdict = watch.sample(realMs);
    if (verdict === "in") applyTier(watch.tier);
    else if (verdict === "vazgec" && o.onGiveUp("slow")) return;

    // ---- olaylar: doğru cevap çeker, yanlış cevap dondurur ----
    for (const s of [0, 1] as const) {
      if (inp.pullAt[s] !== st.lastPull[s]) {
        st.lastPull[s] = inp.pullAt[s];
        st.impulse[s] = 1;
        st.yank[1 - s] = 1;
        st.vel += (s === 0 ? -1 : 1) * 2.3;
        sfx.heave();
        if (!quiet) {
          for (let k = 0; k < PULLERS; k++) {
            const x = (s === 0 ? -1 : 1) * (FRONT + k * SPACING) + st.offset;
            for (let i = 0; i < 2; i++) dust.emit({ x: x + rand(-0.15, 0.15), y: 0.08, z: rand(-0.2, 0.3), vx: (s === 0 ? -1 : 1) * rand(0.2, 0.7), vy: rand(0.2, 0.6), size: rand(0.35, 0.6), grow: 0.5, life: 0.7, color: C.toz, alpha: 0.5 });
          }
        }
      }
      if (inp.missAt[s] !== st.lastMiss[s]) {
        st.lastMiss[s] = inp.missAt[s];
        sfx.freeze();
      }
    }

    // ---- ipin konumu: yaylı takip ----
    const ending = inp.phase === "finished" && inp.winner !== null;
    if (ending && st.endStart === null) st.endStart = st.skipEnding ? t - 100 : t;
    const te = st.endStart === null ? 0 : t - st.endStart;
    const winDir = inp.winner === 0 ? -1 : inp.winner === 1 ? 1 : 0;
    const target = (inp.rope / Math.max(1, inp.target)) * TRAVEL;
    if (ending && st.endOffset === null) st.endOffset = st.skipEnding ? winDir * TRAVEL : st.offset;
    if (!ending) {
      st.vel += (70 * (target - st.offset) - 9 * st.vel) * dt;
      st.offset += st.vel * dt;
    }
    const live = inp.phase === "go";
    const struggle = live && !quiet ? Math.sin(t * 2.3) * 0.012 + Math.sin(t * 5.7) * 0.005 : 0;
    // Bitişte kazananlar yerinde kalıp geriye devrilir; kaybedenler merkeze, çamura sürüklenir.
    const sideOffset = (side: 0 | 1) => {
      if (!ending || st.endOffset === null || inp.winner === "draw") return st.offset;
      if (side === inp.winner) return st.endOffset + winDir * 0.16 * easeOut(clamp01(te / 0.4));
      return st.endOffset + (winDir * (FRONT - 0.95) - st.endOffset) * easeIn(clamp01(te / 0.5));
    };

    // ---- bitiş anları: sıçrama, sevinç, kopma ----
    if (ending && !st.skipEnding) {
      if (inp.winner !== "draw" && !st.splashed && te > 0.48) {
        st.splashed = true;
        sfx.splash();
        if (!quiet) {
          for (let i = 0; i < 46; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = rand(1, 3.6);
            mud.emit({ x: rand(-0.4, 0.4), y: 0.1, z: rand(-0.3, 0.3), vx: Math.cos(a) * v, vy: rand(2, 6.5), vz: Math.sin(a) * v * 0.7 + 0.6, size: rand(0.06, 0.16), life: rand(0.9, 1.5), color: C.camur[i % 3] });
          }
          for (let i = 0; i < 6; i++) dust.emit({ x: rand(-0.6, 0.6), y: 0.2, z: rand(-0.3, 0.4), vx: rand(-0.8, 0.8), vy: rand(0.6, 1.4), size: rand(0.6, 1), grow: 1, life: 0.9, color: C.camur[0], alpha: 0.6 });
        }
      }
      if (inp.winner === "draw" && !st.snapped && te > 0.2) {
        st.snapped = true;
        sfx.snap();
      }
      if (inp.winner !== "draw" && !st.cheered && te > 1.75) {
        st.cheered = true;
        sfx.cheer();
        if (!quiet) {
          const colors = [teams[inp.winner as 0 | 1].base, "var(--color-cream)", "var(--color-kehribar)"].map(cssColor);
          confetti({ particleCount: 110, spread: 90, startVelocity: 45, origin: { x: inp.winner === 0 ? 0.25 : 0.75, y: 0.35 }, colors, disableForReducedMotion: true });
        }
      }
    }

    // ---- çocuklar ----
    KIDS.forEach((kid, i) => {
      const dir = kid.side === 0 ? -1 : 1;
      const frozen = inp.frozen[kid.side] && !ending;
      const isWinner = ending && inp.winner === kid.side;
      const isLoser = ending && inp.winner !== "draw" && inp.winner !== kid.side;
      const isDraw = ending && inp.winner === "draw";

      // Geriye yaslanma: beklerken dik, çekişirken ipe asılı.
      let backTarget = live || ending ? 0.62 + kid.k * 0.03 : 0.08;
      backTarget += 0.24 * st.impulse[kid.side] - 0.3 * st.yank[kid.side];
      if (frozen) backTarget = 0.4;
      if (live && !quiet) backTarget += Math.sin(t * 3.1 + i * 1.7) * 0.03;
      st.back[i] += (backTarget - st.back[i]) * Math.min(1, dt * (frozen ? 4 : 9));
      let back = st.back[i];
      let pitch = 0;
      let lift = 0;
      let armsUp = 0;
      let hold = true;
      let mouth: Mouth = live ? "focus" : "smile";

      if (isLoser) {
        // Öne kapaklanır; en öndeki çamur havuzuna düşer.
        const p = easeIn(clamp01((te - kid.k * 0.07) / 0.5));
        pitch = 1.45 * p;
        back *= 1 - p;
        mouth = "shock";
      } else if (isWinner || isDraw) {
        // İp boşalınca geriye devrilir, sonra kalkıp sevinir.
        const fall = easeIn(clamp01((te - 0.15 - kid.k * 0.05) / 0.4));
        const rise = easeInOut(clamp01((te - 1.25 - kid.k * 0.05) / 0.45));
        pitch = -1.2 * fall * (1 - rise);
        back *= 1 - rise;
        mouth = rise > 0 ? (isDraw ? "shock" : "grin") : fall > 0.5 ? "shock" : "focus";
        if (rise >= 1) {
          hold = false;
          if (isWinner) {
            armsUp = 1;
            const hop = te - 1.75 - kid.k * 0.09;
            if (hop > 0 && hop < 2.4 && !quiet) lift = Math.abs(Math.sin(hop * 6)) * 0.3;
          }
        }
      } else if (frozen) mouth = "shock";
      else if (live && st.impulse[kid.side] < 0.3 && st.yank[kid.side] > 0.5) mouth = "shock";

      const shiver = frozen && !quiet ? Math.sin(t * 70 + i) * 0.012 : 0;
      const baseX = dir * (FRONT + kid.k * SPACING) + sideOffset(kid.side) + shiver + (live ? struggle : 0);
      const step = st.impulse[kid.side];
      const m = motion;
      m.x = baseX;
      m.z = 0;
      m.yaw = (-dir * Math.PI) / 2;
      m.hip = STAND * (1 - 0.26 * back) + lift;
      m.lean = 0.05 - 0.78 * back;
      m.headPitch = armsUp ? -0.25 : 0.32 * back;
      m.mouth = mouth;
      m.footL = { x: -0.11 * KID, y: ANKLE + lift * 0.85, z: 0.06 + 0.5 * back };
      m.footR = { x: 0.11 * KID, y: ANKLE + lift * 0.85 + step * 0.06 * back, z: 0.02 + 0.2 * back - 0.14 * step * back };
      if (armsUp) {
        m.handL = { x: -0.34 * KID, y: m.hip + 1.02 * KID, z: 0.08 };
        m.handR = { x: 0.34 * KID, y: m.hip + 1.02 * KID, z: 0.08 };
      } else if (!hold) {
        m.handL = { x: -0.42 * KID, y: m.hip + 0.3, z: 0.14 };
        m.handR = { x: 0.42 * KID, y: m.hip + 0.3, z: 0.14 };
      } else {
        const reach = 0.2 + 0.08 * back;
        m.handL = { x: -0.03, y: ROPE_Y, z: reach + 0.14 };
        m.handR = { x: 0.03, y: ROPE_Y, z: reach };
      }
      const fig = figs[i];
      fig.poseBody(m, t);
      // Devrilme: gövde ayaklarının çevresinde döner. En öndeki kaybeden çamura gömülür.
      if (pitch !== 0) {
        fig.root.rotation.x = pitch;
        const sink = isLoser && kid.k === 0 ? 0.12 : 0;
        fig.root.position.y = Math.max(0.2 - sink, m.hip * Math.cos(pitch));
        fig.root.position.x = baseX - dir * m.hip * Math.sin(pitch) * 0.9;
      }
      holding[i] = hold;
      if (hold) fig.handsCentre(hands[i]);
      else hands[i].set(baseX - dir * 0.15, 0.04, 0.05);
      ices[i].visible = frozen;
      if (frozen) ices[i].position.set(baseX, 0.8, 0);
      blobs[i].visible = !settings.shadows;
      blobs[i].position.set(fig.root.position.x, 0.035, 0);
    });
    st.impulse = st.impulse.map((v) => v * Math.exp(-dt * 3.2));
    st.yank = st.yank.map((v) => v * Math.exp(-dt * 4));

    // ---- ip: kuyruk -> arka çocuk -> ... -> ön çocuk -> orta (sarkar) -> karşı taraf ----
    const snapped = inp.winner === "draw" && ending && (st.snapped || st.skipEnding);
    const frontL = hands[0];
    const frontR = hands[PULLERS];
    const slack = ending ? 0.3 : live ? 0.04 + Math.abs(struggle) : 0.2;
    let n = 0;
    pts[n++].set(hands[PULLERS - 1].x - 0.9, 0.04, 0.15);
    for (let k = PULLERS - 1; k >= 0; k--) pts[n++].copy(hands[k]);
    const MID = 8;
    const drop = snapped ? easeOut(clamp01((te - 0.2) / 0.5)) : 0;
    for (let j = 1; j < MID; j++) {
      const u = j / MID;
      const p = pts[n++].lerpVectors(frontL, frontR, u);
      p.y -= Math.sin(u * Math.PI) * slack;
      // İp koparsa iki ucu yere düşer.
      if (snapped) p.y = lerp(p.y, 0.04, drop * Math.sin(u * Math.PI) ** 0.3);
      p.y = Math.max(0.04, p.y);
    }
    for (let k = 0; k < PULLERS; k++) pts[n++].copy(hands[PULLERS + k]);
    pts[n++].set(hands[2 * PULLERS - 1].x + 0.9, 0.04, 0.15);
    for (let i = 0; i < segs.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const seg = segs[i];
      // Kopan ipin ortadaki parçası görünmez.
      seg.visible = i + 1 < n && !(snapped && i === PULLERS + MID / 2 - 1 && drop > 0.2);
      if (!seg.visible) continue;
      placeSegment(seg, a, b);
      seg.scale.y = Math.max(0.001, a.distanceTo(b));
    }
    const mid = pts[PULLERS + MID / 2];
    ribbon.position.copy(mid);
    ribbon.rotation.z = clamp01(Math.abs(st.vel) / 3) * -Math.sign(st.vel) * 0.5;

    dust.update(dt);
    mud.update(dt);

    // ---- kamera: oyunda ipin peşinden hafifçe kayar, bitişte çamura yaklaşır ----
    const settled = ending && inp.winner !== "draw";
    const cx = settled && st.endOffset !== null ? st.endOffset * 0.5 + winDir * 0.9 : st.offset * 0.45;
    const fitW = settled ? 13 : 15.4;
    const kk = quiet || st.cut ? 1 : follow(settled ? 2.2 : 1.6, dt);
    st.cut = false;
    st.cam.x = lerp(st.cam.x, cx, kk);
    st.cam.y = lerp(st.cam.y, settled ? 2.5 : 2.2, kk);
    st.cam.z = lerp(st.cam.z, settled ? 9.4 : 10.5, kk);
    st.look.set(st.cam.x * 0.9, 1.06, 0);
    st.fitW = lerp(st.fitW, fitW, kk);
    camera.position.copy(st.cam);
    camera.lookAt(st.look);
    const dist = st.cam.distanceTo(st.look);
    camera.fov = (2 * Math.atan(Math.max(3.3 / 2, st.fitW / 2 / st.aspect) / dist) * 180) / Math.PI;
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
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
