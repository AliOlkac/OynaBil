import * as THREE from "three";
import { DARK, HAIR, PANTS, SKIN, STYLES } from "../../shared/kid";
import { FIGURE, KidFigure, type BodyMotion, type Mouth } from "../../shared/stage3d/figure";
import { clamp01, createRenderer, disposeTree, follow, glowTexture, lerp, tierSettings, tokenColor, tokenCss } from "../../shared/stage3d/kit";
import { ChipPool } from "../../shared/stage3d/particles";
import { createFrameWatch, type Tier } from "../../shared/stage3d/support";

/**
 * Bilgi Yarışması'nın stüdyosu: her takımın bir kürsüsü ve arkasında üç yarışmacısı vardır.
 * Sıradaki takımın kürsüsüne spot ışığı düşer; doğru cevapta takım zıplayarak sevinir ve kürsüden
 * takım renginde kıvılcımlar saçılır, yanlışta yarışmacılar başını tutar. Önde olan takımın kürsüsünde taç durur.
 * Soru okunurken sahne durgundur: yalnızca ışık yer değiştirir.
 */

export type StudioTeam = { base: string; deep: string };
export type StudioInput = {
  /** Cevap sırası olan takım (çalma hakkında çalan takım). */
  active: number;
  phase: "question" | "steal" | "reveal";
  /** Son sonucun sahibi ve türü; `key` her yeni sonuçta değişir. */
  result: { key: string; team: number; good: boolean; loser: number | null } | null;
  scores: number[];
  /** Tek başına önde olan takım; yoksa null. */
  leader: number | null;
};

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  tier: Tier;
  teams: StudioTeam[];
  getInput: () => StudioInput;
  isReducedMotion: () => boolean;
  onTier: (tier: Tier) => void;
  onGiveUp: (reason: "slow" | "lost") => boolean;
};

const KID = 0.88;
const STAND = 0.8 * KID;
const ANKLE = FIGURE.ankle * KID;
const PODIUM_W = 2.5;
const PODIUM_H = 0.92;
/** Yarışmacılar kürsünün arkasındaki basamakta durur; böylece gövdeleri kürsünün üstünden görünür. */
const RISER = 0.42;
const MEMBERS = 3;

export function createStudioEngine(o: EngineOptions): { dispose: () => void } {
  const { canvas, teams } = o;
  const N = teams.length;
  let settings = tierSettings(o.tier);
  const renderer = createRenderer(canvas, o.tier);
  const watch = createFrameWatch(o.tier);

  const scene = new THREE.Scene();
  scene.background = tokenColor("var(--color-ink-950)");
  const camera = new THREE.PerspectiveCamera(20, 7, 0.3, 120);

  scene.add(new THREE.HemisphereLight(tokenColor("var(--color-ink-300)"), tokenColor("var(--color-ink-800)"), 1.5));
  const key = new THREE.DirectionalLight(tokenColor("var(--color-cream)"), 2.2);
  key.position.set(-4, 9, 9);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(settings.shadowSize);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.03;
  // Sıradaki takımı aydınlatan sıcak ışık; kürsüden kürsüye kayar.
  const spot = new THREE.PointLight(tokenColor("var(--color-cream)"), 60, 9, 1.6);
  spot.position.set(0, 3.2, 2.4);
  scene.add(key, key.target, spot);

  // ---- stüdyo: parlak zemin, ışıklı arka duvar, tabela ----
  const SPAN = N <= 2 ? 6.6 : N === 3 ? 5.4 : 4.5;
  const xOf = (i: number) => (i - (N - 1) / 2) * SPAN;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 16), new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ink-850)"), roughness: 0.35, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 9), new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ink-900)"), roughness: 0.9 }));
  wall.position.set(0, 4.5, -3.4);
  scene.add(wall);
  const decor = new THREE.Group();
  const stripMats = ["var(--color-firuze)", "var(--color-kehribar)", "var(--color-kobalt)"].map((c) => new THREE.MeshBasicMaterial({ color: tokenColor(c) }));
  for (let i = -9; i <= 9; i++) {
    // Kürsülerin arası ışık sütunlarıyla dolar.
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3 + (Math.abs(i) % 3) * 0.45, 0.06), stripMats[Math.abs(i) % 3]);
    strip.position.set(i * 1.5 + 0.75, 1.35, -3.3);
    decor.add(strip);
  }
  scene.add(decor);

  const glow = glowTexture(64);
  // Spot ışığının yere düşen lekesi ve huzmesi.
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.3, 28), new THREE.MeshBasicMaterial({ map: glow, color: tokenColor("var(--color-cream)"), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.02;
  const beamGeo = new THREE.ConeGeometry(2.1, 6, 20, 1, true);
  beamGeo.translate(0, -3, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-cream)"), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 6;
  scene.add(pool, beam);

  // ---- kürsüler ve yarışmacılar ----
  const panels: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; shown: number }[] = [];
  const drawScore = (i: number, score: number) => {
    const p = panels[i];
    if (p.shown === score) return;
    p.shown = score;
    const { ctx } = p;
    ctx.fillStyle = tokenCss("var(--color-ink-950)");
    ctx.fillRect(0, 0, 256, 128);
    ctx.font = `800 96px "Lexend Variable", Lexend, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = tokenCss(teams[i].base);
    ctx.fillText(String(score), 128, 70);
    p.tex.needsUpdate = true;
  };
  const figs: KidFigure[][] = [];
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const blobs: THREE.Mesh[] = [];
  teams.forEach((team, i) => {
    const x = xOf(i);
    const body = new THREE.Mesh(new THREE.BoxGeometry(PODIUM_W, PODIUM_H, 0.7), new THREE.MeshStandardMaterial({ color: tokenColor(team.base), roughness: 0.5 }));
    body.position.set(x, PODIUM_H / 2, 0);
    body.castShadow = body.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(PODIUM_W + 0.16, 0.09, 0.86), new THREE.MeshStandardMaterial({ color: tokenColor(team.deep), roughness: 0.4 }));
    top.position.set(x, PODIUM_H + 0.045, 0);
    top.castShadow = true;
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 128;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    panels.push({ ctx: cv.getContext("2d")!, tex, shown: Number.NaN });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshBasicMaterial({ map: tex }));
    panel.position.set(x, PODIUM_H * 0.52, 0.356);
    const riser = new THREE.Mesh(new THREE.BoxGeometry(PODIUM_W + 0.2, RISER, 0.9), new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ink-800)"), roughness: 0.7 }));
    riser.position.set(x, RISER / 2, -0.8);
    riser.receiveShadow = true;
    scene.add(body, top, panel, riser);
    const b = new THREE.Mesh(new THREE.CircleGeometry(1, 20), blobMat);
    b.rotation.x = -Math.PI / 2;
    b.scale.set(PODIUM_W * 0.62, 0.9, 1);
    b.position.set(x, 0.03, 0);
    blobs.push(b);
    scene.add(b);
    figs.push(
      Array.from({ length: MEMBERS }, (_, k) => {
        const fig = new KidFigure({
          skin: SKIN[(k * 3 + i) % SKIN.length],
          hair: HAIR[(k * 2 + i * 3) % HAIR.length],
          hairStyle: STYLES[(k + i * 2) % STYLES.length],
          shirt: team.base,
          trim: team.deep,
          shorts: PANTS,
          socks: team.deep,
          boots: DARK,
          scale: KID,
        });
        scene.add(fig.root);
        return fig;
      }),
    );
    drawScore(i, o.getInput().scores[i] ?? 0);
  });
  // Önde olan takımın kürsüsündeki taç.
  const crown = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-kehribar)"), roughness: 0.3, metalness: 0.5, emissive: tokenColor("var(--color-kehribar-deep)"), emissiveIntensity: 0.5 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.13, 14, 1, true), gold);
  crown.add(band);
  for (let k = 0; k < 5; k++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.18, 4), gold);
    const a = (k / 5) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.2, 0.15, Math.sin(a) * 0.2);
    crown.add(spike);
  }
  crown.visible = false;
  scene.add(crown);

  const sparks = new ChipPool(60, 9);
  scene.add(sparks.mesh);
  const teamColors = teams.map((t) => [tokenColor(t.base), tokenColor("var(--color-cream)"), tokenColor("var(--color-kehribar)")]);

  // ---- durum ----
  const first = o.getInput();
  const st = {
    time: 0,
    last: performance.now(),
    aspect: 7,
    spotX: xOf(first.active),
    camX: 0,
    seen: first.result?.key ?? "",
    mood: teams.map(() => ({ kind: "calm" as "calm" | "cheer" | "slump", start: 0 })),
    crownX: 0,
    cut: true,
  };
  // Yeniden açılan oyunda son sonucun tepkisi durağan gösterilir.
  if (first.phase !== "question" && first.result) {
    st.mood[first.result.team] = { kind: first.result.good ? "cheer" : "slump", start: -10 };
    if (first.result.loser !== null) st.mood[first.result.loser] = { kind: "slump", start: -10 };
  }
  const m: BodyMotion = { x: 0, z: 0, hip: STAND, yaw: 0, footL: { x: 0, y: 0, z: 0 }, footR: { x: 0, y: 0, z: 0 }, handL: { x: 0, y: 0, z: 0 }, handR: { x: 0, y: 0, z: 0 } };
  const arms = teams.map(() => ({ up: 0, cover: 0 }));

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
      for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) x.needsUpdate = true;
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

    // ---- olaylar ----
    if (inp.result && inp.result.key !== st.seen) {
      st.seen = inp.result.key;
      const r = inp.result;
      st.mood[r.team] = { kind: r.good ? "cheer" : "slump", start: t };
      if (r.loser !== null) st.mood[r.loser] = { kind: "slump", start: t };
      if (r.good && !quiet) {
        const x = xOf(r.team);
        for (let i = 0; i < 34; i++) {
          sparks.emit({ x: x + (Math.random() - 0.5) * PODIUM_W, y: PODIUM_H + 0.1, z: 0.2, vx: (Math.random() - 0.5) * 3.4, vy: 2.5 + Math.random() * 3.6, vz: (Math.random() - 0.3) * 2, size: 0.05 + Math.random() * 0.07, life: 1 + Math.random() * 0.7, color: teamColors[r.team][i % 3] });
        }
      }
    }
    if (inp.phase === "question") for (const mood of st.mood) if (mood.kind !== "calm") mood.kind = "calm";

    // ---- yarışmacılar ----
    teams.forEach((_, i) => {
      const mood = st.mood[i];
      const since = t - mood.start;
      const upT = mood.kind === "cheer" ? 1 : 0;
      const coverT = mood.kind === "slump" ? 1 : 0;
      const kk = quiet ? 1 : follow(10, dt);
      arms[i].up = lerp(arms[i].up, upT, kk);
      arms[i].cover = lerp(arms[i].cover, coverT, kk);
      const active = inp.active === i && inp.phase !== "reveal";
      figs[i].forEach((fig, k) => {
        const hop = mood.kind === "cheer" && !quiet && since < 2.6 ? Math.abs(Math.sin(since * 7 + k * 1.1)) * 0.3 * (1 - clamp01((since - 1.8) / 0.8)) : 0;
        const up = arms[i].up;
        const cover = arms[i].cover;
        m.x = xOf(i) + (k - (MEMBERS - 1) / 2) * 0.78;
        m.z = -0.72;
        m.yaw = (k - 1) * -0.12;
        m.hip = STAND * (1 - 0.1 * cover) + hop;
        m.lean = 0.05 + 0.2 * cover - 0.1 * up;
        m.headPitch = 0.3 * cover - 0.2 * up;
        m.mouth = (mood.kind === "cheer" ? "grin" : mood.kind === "slump" ? "shock" : active ? "focus" : "smile") as Mouth;
        m.footL = { x: -0.1 * KID, y: ANKLE + hop * 0.85, z: 0 };
        m.footR = { x: 0.1 * KID, y: ANKLE + hop * 0.85, z: 0 };
        // Beklerken eller kürsünün üstünde durur.
        const restY = PODIUM_H + 0.14 - RISER;
        const y = lerp(lerp(restY, m.hip + 1.02 * KID, up), m.hip + 0.84 * KID, cover);
        const x = lerp(lerp(0.2, 0.36, up), 0.15, cover) * KID;
        const z = lerp(lerp(0.36, 0.1, up), 0.08, cover);
        m.handL = { x: -x, y, z };
        m.handR = { x, y, z };
        fig.poseBody(m, t);
        fig.root.position.y += RISER;
      });
      drawScore(i, inp.scores[i] ?? 0);
      blobs[i].visible = !settings.shadows;
    });

    // ---- ışık: sıradaki takımın (sonuçta puanı alanın) kürsüsüne kayar ----
    const focus = inp.phase === "reveal" && inp.result ? inp.result.team : inp.active;
    const kk = quiet || st.cut ? 1 : follow(5, dt);
    st.spotX = lerp(st.spotX, xOf(focus), kk);
    spot.position.x = st.spotX;
    pool.position.x = st.spotX;
    beam.position.x = st.spotX;
    crown.visible = inp.leader !== null;
    if (inp.leader !== null) {
      st.crownX = lerp(st.crownX, xOf(inp.leader), kk);
      crown.position.set(st.crownX - PODIUM_W / 2 + 0.3, PODIUM_H + 0.18, 0.12);
      crown.rotation.y = quiet || inp.phase !== "reveal" ? 0.5 : t * 1.4;
    }
    sparks.update(dt);

    // ---- kamera: bütün kürsüleri gösterir, sıradaki takıma doğru hafifçe kayar ----
    st.camX = lerp(st.camX, xOf(focus) * 0.16, quiet || st.cut ? 1 : follow(2.5, dt));
    st.cut = false;
    camera.position.set(st.camX, 1.5, 11);
    camera.lookAt(st.camX * 0.8, 1.22, 0);
    const fitW = (N - 1) * SPAN + PODIUM_W + 3;
    camera.fov = (2 * Math.atan(Math.max(2.25 / 2, fitW / 2 / st.aspect) / 11) * 180) / Math.PI;
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
      for (const p of panels) p.tex.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
