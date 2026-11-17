import * as THREE from "three";
import { HAIR, SKIN } from "../../shared/kid";
import { canvasTexture, glowTexture, seeded, tokenColor, tokenCss, type TierSettings } from "../../shared/stage3d/kit";
import type { ArtTeam } from "../scene/art";
import { BOARD_H, BOARD_Z, GOAL_H, GOAL_HALF, NET_DEPTH_BOTTOM, NET_DEPTH_TOP, POST_R, SPOT, STAND_BASE_Y, STAND_RISE, STAND_Z } from "./world";

/**
 * Penaltı stadyumu: gece maçı, çizgili çim, kale ve esneyen ağ, kayan LED panolar, iki takımın
 * taraftarlarıyla dolu tribünler, projektörler. Hepsi kodla kurulur; resim ya da model dosyası yoktur.
 */

const ROW_DEPTH = 0.85;
const FAN_SPACING = 0.62;

export type Stadium = {
  group: THREE.Group;
  /** Kale direkleri ve ağ: direğe çarpan top bütün kaleyi titretir. */
  goal: THREE.Group;
  setNet(bulge: { x: number; y: number; amount: number } | null, time: number, sway: boolean): void;
  /** Tribün: `side` takımının taraftarları `amount` kadar zıplar. */
  setCrowd(time: number, side: 0 | 1 | null, amount: number): void;
  /** Panolar: normalde kayan yazı, golde atan takımın renginde "GOL". */
  setBoards(dt: number, goalSide: 0 | 1 | null, time: number): void;
  /** Tribündeki flaşlar (0 kapalı, 1 çok). */
  setFlashes(dt: number, intensity: number): void;
  setFlags(time: number, lively: boolean): void;
  /** Ağın saydamlığı: kamera ağın arkasına geçince ağ incelir, arkası görünür. */
  setNetOpacity(opacity: number): void;
  /** Kalite kademesi düşünce üç boyutlu taraftar sıralarını ve süsleri azaltır. */
  setDetail(tier: TierSettings): void;
};

function grassTexture() {
  const rand = seeded(7);
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#e4e4e4";
      ctx.fillRect(0, 0, w, h);
      // Açık koyu lekeler ve binlerce kısa çim çizgisi; döşenince tekrar ettiği belli olmaz.
      for (let i = 0; i < 46; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 18 + rand() * 40;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const tone = rand() > 0.5 ? "255,255,255" : "120,120,120";
        g.addColorStop(0, `rgba(${tone},0.16)`);
        g.addColorStop(1, `rgba(${tone},0)`);
        ctx.fillStyle = g;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) ctx.fillRect(x - r + ox, y - r + oy, r * 2, r * 2);
      }
      ctx.lineCap = "round";
      for (let i = 0; i < 5200; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const len = 2 + rand() * 5;
        const a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
        ctx.strokeStyle = rand() > 0.45 ? `rgba(255,255,255,${0.1 + rand() * 0.22})` : `rgba(60,60,60,${0.1 + rand() * 0.2})`;
        ctx.lineWidth = 0.7 + rand() * 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
    },
    { repeat: [1, 1], anisotropy: 8 },
  );
}

function netTexture() {
  return canvasTexture(
    64,
    64,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 9;
      ctx.strokeRect(0, 0, w, h);
    },
    { repeat: [1, 1], anisotropy: 8 },
  );
}

function ledTexture(words: { text: string; color: string }[], background: string) {
  return canvasTexture(
    2048,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = tokenCss(background);
      ctx.fillRect(0, 0, w, h);
      ctx.font = `800 76px "Lexend Variable", Lexend, system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      // Harfler aralıklı yazılır (tahtada uzaktan okunsun); kelimeler ölçülüp tuvale tam sığdırılır.
      const GAP = 12;
      const SPACE = 150;
      const measure = (text: string) => [...text].reduce((sum, ch) => sum + ctx.measureText(ch).width + GAP, 0);
      const total = words.reduce((sum, word) => sum + measure(word.text) + SPACE, 0);
      ctx.save();
      ctx.scale(w / total, 1);
      let x = SPACE / 2;
      for (const word of words) {
        ctx.fillStyle = tokenCss(word.color);
        for (const ch of word.text) {
          ctx.fillText(ch, x, h / 2 + 4);
          x += ctx.measureText(ch).width + GAP;
        }
        x += SPACE;
      }
      ctx.restore();
      // LED ızgarası
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    },
    { repeat: [1, 1], anisotropy: 8 },
  );
}

/** Tribünün uzak sıraları: tek tek modellemek yerine sıra sıra çizilmiş taraftarlar. */
function crowdTexture(colorAt: (u: number) => string[], cols: number, rows: number) {
  const rand = seeded(31);
  return canvasTexture(2048, 512, (ctx, w, h) => {
    ctx.fillStyle = tokenCss("var(--color-ink-950)");
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() < 0.06) continue;
        const palette = colorAt((c + 0.5) / cols);
        const x = (c + 0.5 + (rand() - 0.5) * 0.3) * cw;
        const y = h - (r + 0.2) * rh;
        ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
        ctx.fillRect(x - cw * 0.36, y - rh * 0.55, cw * 0.72, rh * 0.62);
        ctx.fillStyle = SKIN[Math.floor(rand() * SKIN.length)];
        ctx.beginPath();
        ctx.arc(x, y - rh * 0.72, cw * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

function fanPalette(team: ArtTeam): string[] {
  const base = tokenCss(team.base);
  const deep = tokenCss(team.deep);
  return [base, base, base, base, deep, deep, tokenCss("var(--color-cream)"), tokenCss("var(--color-cream-dim)"), tokenCss("var(--color-ink-600)")];
}

type Fans = {
  body: THREE.InstancedMesh;
  head: THREE.InstancedMesh;
  base: Float32Array;
  team: Uint8Array;
  phase: Float32Array;
  count: number;
  /** Her sıranın bittiği taraftar sırası: ilk n sırayı çizmek için. */
  rowEnds: number[];
  lifted: boolean;
};

/**
 * Bir tribün: yerel koordinatta ön kenarı z=0'da x boyunca uzanır, -z yönünde yükselir.
 * `teamAt` her taraftarın hangi takımı tuttuğunu söyler.
 */
function buildStand(opts: { length: number; rows: number; modelRows: number; teams: [ArtTeam, ArtTeam]; teamAt: (x: number) => 0 | 1; seed: number }) {
  const { length, rows, teams, teamAt } = opts;
  const group = new THREE.Group();
  const depth = rows * ROW_DEPTH;
  const rise = depth * STAND_RISE;
  const palettes = [fanPalette(teams[0]), fanPalette(teams[1])];

  // Eğimli zemin: uzak sıraların taraftarları buraya çizilidir.
  const cols = Math.floor(length / FAN_SPACING);
  const tex = crowdTexture((u) => palettes[teamAt((u - 0.5) * length)], cols, rows);
  const slope = new THREE.Mesh(new THREE.PlaneGeometry(length, Math.hypot(depth, rise)), new THREE.MeshBasicMaterial({ map: tex, color: 0xb8b8b8 }));
  slope.rotation.x = -Math.atan2(depth, rise);
  slope.position.set(0, STAND_BASE_Y + rise / 2, -depth / 2);
  group.add(slope);

  // Ön duvar ve çatı bandı
  const dark = new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-ink-950)") });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(length, STAND_BASE_Y + 0.5), dark);
  wall.position.set(0, (STAND_BASE_Y + 0.5) / 2, 0.02);
  group.add(wall);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(length, 2.4, 5), dark);
  roof.position.set(0, STAND_BASE_Y + rise + 2.6, -depth + 1.2);
  group.add(roof);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.28), new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-cream)"), fog: false }));
  strip.position.set(0, STAND_BASE_Y + rise + 1.5, -depth + 3.72);
  group.add(strip);

  // Öndeki sıralar gerçek üç boyutlu taraftar: gövde ve baş, iki örneklemeli ağ.
  const rand = seeded(opts.seed);
  const spots: { x: number; y: number; z: number; team: 0 | 1 }[] = [];
  const rowEnds: number[] = [];
  for (let r = 0; r < opts.modelRows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * FAN_SPACING - length / 2 + (rand() - 0.5) * 0.12;
      // Merdiven boşlukları ve arada boş koltuklar
      if (Math.abs((((x % 13) + 13) % 13) - 6.5) < 0.42 || rand() < 0.05) continue;
      spots.push({ x, y: STAND_BASE_Y + (r + 0.5) * ROW_DEPTH * STAND_RISE + 0.36, z: -(r + 0.5) * ROW_DEPTH, team: teamAt(x) });
    }
    rowEnds.push(spots.length);
  }
  const bodyGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.72, 7, 1, true);
  const headGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const mat = new THREE.MeshLambertMaterial();
  const fans: Fans = {
    body: new THREE.InstancedMesh(bodyGeo, mat, spots.length),
    head: new THREE.InstancedMesh(headGeo, mat, spots.length),
    base: new Float32Array(spots.length * 3),
    team: new Uint8Array(spots.length),
    phase: new Float32Array(spots.length),
    count: spots.length,
    rowEnds,
    lifted: false,
  };
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  spots.forEach((s, i) => {
    fans.base.set([s.x, s.y, s.z], i * 3);
    fans.team[i] = s.team;
    fans.phase[i] = rand() * Math.PI * 2;
    m.makeTranslation(s.x, s.y, s.z);
    fans.body.setMatrixAt(i, m);
    m.makeTranslation(s.x, s.y + 0.5, s.z);
    fans.head.setMatrixAt(i, m);
    const palette = palettes[s.team];
    fans.body.setColorAt(i, color.set(palette[Math.floor(rand() * palette.length)]));
    const skin = rand() < 0.22 ? HAIR[Math.floor(rand() * HAIR.length)] : SKIN[Math.floor(rand() * SKIN.length)];
    fans.head.setColorAt(i, color.set(skin));
  });
  fans.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fans.head.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fans.body.frustumCulled = false;
  fans.head.frustumCulled = false;
  group.add(fans.body, fans.head);
  return { group, fans, top: STAND_BASE_Y + rise, depth };
}

export function buildStadium(teams: [ArtTeam, ArtTeam], tier: TierSettings): Stadium {
  const group = new THREE.Group();
  const cream = tokenColor("var(--color-cream)");

  // ---- çim: 5,5 metrelik biçim şeritleri ----
  const grass = grassTexture();
  const BAND = 5.5;
  const FIELD_W = 96;
  const lightMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-cim-acik)"), map: grass, roughness: 1, metalness: 0 });
  const darkMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-cim)"), map: grass, roughness: 1, metalness: 0 });
  const bandGeo = new THREE.PlaneGeometry(FIELD_W, BAND);
  const uv = bandGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (FIELD_W / 1.6), uv.getY(i) * (BAND / 1.6));
  for (let i = -2; i < 13; i++) {
    const band = new THREE.Mesh(bandGeo, i % 2 === 0 ? lightMat : darkMat);
    band.rotation.x = -Math.PI / 2;
    band.position.set(0, 0, i * BAND + BAND / 2);
    band.receiveShadow = true;
    group.add(band);
  }

  // ---- saha çizgileri ----
  const lineMat = new THREE.MeshStandardMaterial({ color: cream, roughness: 1, metalness: 0, emissive: cream, emissiveIntensity: 0.18, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const W = 0.12;
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0) + W;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, W), lineMat);
    // Önce kendi düzleminde döner, sonra yere yatar.
    mesh.rotation.set(-Math.PI / 2, 0, -Math.atan2(z1 - z0, x1 - x0));
    mesh.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  line(-34, 0, 34, 0);
  line(-20.16, 16.5, 20.16, 16.5);
  line(-20.16, 0, -20.16, 16.5);
  line(20.16, 0, 20.16, 16.5);
  line(-9.16, 5.5, 9.16, 5.5);
  line(-9.16, 0, -9.16, 5.5);
  line(9.16, 0, 9.16, 5.5);
  line(-34, 0, -34, 66);
  line(34, 0, 34, 66);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), lineMat);
  spot.rotation.x = -Math.PI / 2;
  spot.position.set(SPOT.x, 0.012, SPOT.z);
  group.add(spot);
  // Ceza yayı: noktadan 9,15 m, ceza sahasının dışında kalan kısmı.
  const half = Math.acos(5.5 / 9.15);
  const arc = new THREE.Mesh(new THREE.RingGeometry(9.15 - W / 2, 9.15 + W / 2, 48, 1, -Math.PI / 2 - half, half * 2), lineMat);
  arc.rotation.x = -Math.PI / 2;
  arc.position.set(SPOT.x, 0.012, SPOT.z);
  arc.receiveShadow = true;
  group.add(arc);

  // ---- kale ----
  const goal = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: cream, roughness: 0.35, metalness: 0.05, emissive: cream, emissiveIntensity: 0.12 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, GOAL_H + POST_R * 2, 16), postMat);
    post.position.set(s * (GOAL_HALF + POST_R), (GOAL_H + POST_R * 2) / 2, 0);
    post.castShadow = true;
    goal.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, (GOAL_HALF + POST_R * 2) * 2, 16), postMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, GOAL_H + POST_R, 0);
  bar.castShadow = true;
  goal.add(bar);
  // Ağı geren arka çerçeve
  const frameMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ink-300)"), roughness: 0.6 });
  const tube = (a: THREE.Vector3, b: THREE.Vector3) => {
    const len = a.distanceTo(b);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, len, 8), frameMat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    goal.add(mesh);
  };
  for (const s of [-1, 1]) {
    const x = s * (GOAL_HALF + POST_R);
    tube(new THREE.Vector3(x, GOAL_H + POST_R, 0), new THREE.Vector3(x, GOAL_H + POST_R, -NET_DEPTH_TOP));
    tube(new THREE.Vector3(x, GOAL_H + POST_R, -NET_DEPTH_TOP), new THREE.Vector3(x, 0, -NET_DEPTH_BOTTOM));
  }
  tube(new THREE.Vector3(-GOAL_HALF - POST_R, 0.03, -NET_DEPTH_BOTTOM), new THREE.Vector3(GOAL_HALF + POST_R, 0.03, -NET_DEPTH_BOTTOM));

  // ---- ağ: arka yüz, tavan ve iki yan; düğümleri her karede yeniden yerleştirilir ----
  const netMat = new THREE.MeshBasicMaterial({ map: netTexture(), color: cream, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const CELL = 0.15;
  type Patch = { geo: THREE.BufferGeometry; base: Float32Array; edge: Float32Array };
  /** `at(u, v)` düğümün yerini ve ağın arka kenarına ne kadar yakın olduğunu (w: 0 kale çizgisi, 1 arka) verir. */
  const patch = (cols: number, rows: number, at: (u: number, v: number) => { p: [number, number, number]; edge: [number, number]; w: number; uv: [number, number] }): Patch => {
    const n = (cols + 1) * (rows + 1);
    const pos = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2);
    const edge = new Float32Array(n * 3);
    const index: number[] = [];
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const i = r * (cols + 1) + c;
        const a = at(c / cols, r / rows);
        pos.set(a.p, i * 3);
        uvs.set([a.uv[0] / CELL, a.uv[1] / CELL], i * 2);
        edge.set([a.edge[0], a.edge[1], a.w], i * 3);
        if (r < rows && c < cols) index.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, netMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    goal.add(mesh);
    return { geo, base: pos.slice(), edge };
  };
  const backLen = Math.hypot(NET_DEPTH_BOTTOM - NET_DEPTH_TOP, GOAL_H);
  const backZ = (y: number) => -(NET_DEPTH_BOTTOM + (NET_DEPTH_TOP - NET_DEPTH_BOTTOM) * (y / GOAL_H));
  const patches: Patch[] = [
    // arka yüz
    patch(30, 12, (u, v) => {
      const x = (u * 2 - 1) * GOAL_HALF;
      const y = v * GOAL_H;
      return { p: [x, y, backZ(y)], edge: [x, y], w: 1, uv: [u * GOAL_HALF * 2, v * backLen] };
    }),
    // tavan
    patch(30, 4, (u, v) => {
      const x = (u * 2 - 1) * GOAL_HALF;
      return { p: [x, GOAL_H, -v * NET_DEPTH_TOP], edge: [x, GOAL_H], w: v, uv: [u * GOAL_HALF * 2, v * NET_DEPTH_TOP] };
    }),
    // yanlar
    ...[-1, 1].map((s) =>
      patch(8, 12, (u, v) => {
        const y = v * GOAL_H;
        return { p: [s * GOAL_HALF, y, u * backZ(y)], edge: [s * GOAL_HALF, y], w: u, uv: [u * -backZ(y), y] };
      }),
    ),
  ];
  const slopeLen = backLen;
  const nY = (NET_DEPTH_BOTTOM - NET_DEPTH_TOP) / slopeLen;
  const nZ = -GOAL_H / slopeLen;
  let netRest = true;
  const setNet: Stadium["setNet"] = (bulge, time, sway) => {
    if (!bulge && !sway && netRest) return;
    netRest = !bulge && !sway;
    for (const p of patches) {
      const pos = p.geo.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const ex = p.edge[i * 3];
        const ey = p.edge[i * 3 + 1];
        const w = p.edge[i * 3 + 2];
        let d = sway ? Math.sin(time * 1.4 + ex * 0.8 + ey * 1.7) * 0.018 : 0;
        if (bulge) {
          const dx = ex - bulge.x;
          const dy = ey - bulge.y;
          d += Math.exp(-(dx * dx + dy * dy) / (2 * 0.62 * 0.62)) * bulge.amount;
        }
        // Kenarlar direklere bağlıdır: esneme kale çizgisine doğru sıfırlanır.
        d *= w * w;
        arr[i * 3] = p.base[i * 3];
        arr[i * 3 + 1] = p.base[i * 3 + 1] + d * nY;
        arr[i * 3 + 2] = p.base[i * 3 + 2] + d * nZ;
      }
      pos.needsUpdate = true;
    }
  };
  group.add(goal);

  // ---- LED panolar ----
  const idle = ledTexture(
    [
      { text: "OYNABİL", color: "var(--color-firuze)" },
      { text: "BİLEN ATAR", color: "var(--color-kehribar)" },
      { text: "OYNABİL", color: "var(--color-firuze)" },
      { text: "BİLEN ATAR", color: "var(--color-kehribar)" },
    ],
    "var(--color-ink-950)",
  );
  const goalTex = teams.map((t) =>
    ledTexture(
      [0, 1, 2, 3, 4].map(() => ({ text: "GOOOL!", color: "var(--color-ink-950)" })),
      t.base,
    ),
  );
  const ledMat = new THREE.MeshBasicMaterial({ map: idle, fog: false });
  const boardDark = new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-ink-950)") });
  const board = (length: number, repeat: number) => {
    const geo = new THREE.BoxGeometry(length, BOARD_H, 0.3);
    const uvs = geo.attributes.uv;
    // Kutunun +z yüzü 16-19. köşelerdir; yazı oraya `repeat` kez döşenir.
    for (let i = 16; i < 20; i++) uvs.setX(i, uvs.getX(i) * repeat);
    return new THREE.Mesh(geo, [boardDark, boardDark, boardDark, boardDark, ledMat, boardDark]);
  };
  // Yazının en-boy oranı bozulmasın diye doku panoya bu kadar kez döşenir.
  const REPEAT = (72 * (128 / BOARD_H)) / 2048;
  const back = board(72, REPEAT);
  back.position.set(0, BOARD_H / 2, BOARD_Z - 0.15);
  group.add(back);
  for (const s of [-1, 1]) {
    const sideBoard = board(72, REPEAT);
    sideBoard.rotation.y = -s * (Math.PI / 2);
    sideBoard.position.set(s * 37.2, BOARD_H / 2, BOARD_Z + 36);
    group.add(sideBoard);
  }
  let boardMode: 0 | 1 | null = null;
  const setBoards: Stadium["setBoards"] = (dt, goalSide, time) => {
    if (goalSide !== boardMode) {
      boardMode = goalSide;
      ledMat.map = goalSide === null ? idle : goalTex[goalSide];
      ledMat.needsUpdate = true;
    }
    const tex = ledMat.map!;
    tex.offset.x = (tex.offset.x + dt * (goalSide === null ? 0.012 : 0.09)) % 1;
    // Golde pano yanıp söner.
    ledMat.color.setScalar(goalSide === null ? 1 : 0.72 + 0.28 * Math.abs(Math.sin(time * 9)));
  };

  // ---- tribünler ----
  const backRows = 26;
  const sideRows = 18;
  const backStand = buildStand({ length: 86, rows: backRows, modelRows: tier.crowdRows[0], teams, teamAt: (x) => (x < 0 ? 0 : 1), seed: 11 });
  backStand.group.position.z = STAND_Z;
  group.add(backStand.group);
  const sideStands = ([0, 1] as const).map((side) => {
    const stand = buildStand({ length: 78, rows: sideRows, modelRows: tier.crowdRows[1], teams, teamAt: () => side, seed: 23 + side });
    stand.group.rotation.y = side === 0 ? Math.PI / 2 : -Math.PI / 2;
    stand.group.position.set(side === 0 ? -39.4 : 39.4, 0, STAND_Z + 39);
    group.add(stand.group);
    return stand;
  });
  // Karşı kale arkası: sisin içinde, yalnızca çizilmiş taraftarlarla dolu bir tribün.
  const farStand = buildStand({ length: 110, rows: 30, modelRows: 0, teams, teamAt: (x) => (x > 0 ? 0 : 1), seed: 41 });
  farStand.group.rotation.y = Math.PI;
  farStand.group.position.z = 72;
  group.add(farStand.group);

  const stands = [backStand, ...sideStands];
  const m = new THREE.Matrix4();
  const setCrowd: Stadium["setCrowd"] = (time, side, amount) => {
    for (const s of stands) {
      const f = s.fans;
      const active = side !== null && amount > 0.01;
      if (!active && !f.lifted) continue;
      for (let i = 0; i < f.count; i++) {
        const lift = active && f.team[i] === side ? Math.abs(Math.sin(time * 8.5 + f.phase[i])) * 0.34 * amount : 0;
        const x = f.base[i * 3];
        const y = f.base[i * 3 + 1] + lift;
        const z = f.base[i * 3 + 2];
        m.makeTranslation(x, y, z);
        f.body.setMatrixAt(i, m);
        m.makeTranslation(x, y + 0.5, z);
        f.head.setMatrixAt(i, m);
      }
      f.body.instanceMatrix.needsUpdate = true;
      f.head.instanceMatrix.needsUpdate = true;
      f.lifted = active;
    }
  };

  // ---- bayraklar: iki takımın renginde, tribünün önünde dalgalanır ----
  const flags: { geo: THREE.PlaneGeometry; base: Float32Array; phase: number }[] = [];
  const flagGroup = new THREE.Group();
  group.add(flagGroup);
  const flagTexture = (team: ArtTeam) =>
    canvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = tokenCss(team.base);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = tokenCss(team.deep);
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w * 0.45, 0);
      ctx.lineTo(w * 0.7, 0);
      ctx.lineTo(w * 0.25, h);
      ctx.fill();
      ctx.fillStyle = tokenCss("var(--color-cream)");
      ctx.beginPath();
      ctx.arc(w * 0.68, h * 0.5, h * 0.2, 0, Math.PI * 2);
      ctx.fill();
    });
  if (tier.extras) {
    const poleMat = new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-ink-300)") });
    [-27, -15, 15, 27].forEach((x, i) => {
      const team = teams[x < 0 ? 0 : 1];
      const geo = new THREE.PlaneGeometry(3.2, 2, 10, 1);
      geo.translate(1.6, 0, 0);
      const flag = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: flagTexture(team), side: THREE.DoubleSide }));
      const y = STAND_BASE_Y + 3.4 + (i % 2) * 2.2;
      const z = STAND_Z - 3 - (i % 2) * 4;
      flag.position.set(x, y, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6), poleMat);
      pole.position.set(x, y - 0.7, z);
      flagGroup.add(flag, pole);
      flags.push({ geo, base: (geo.attributes.position.array as Float32Array).slice(), phase: i * 1.7 });
    });
  }
  const setFlags: Stadium["setFlags"] = (time, lively) => {
    if (!extras) return;
    for (const f of flags) {
      const pos = f.geo.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = f.base[i * 3];
        const wave = Math.sin(time * (lively ? 7 : 3.2) - x * 2.2 + f.phase) * 0.16 * (x / 3.2);
        arr[i * 3 + 2] = f.base[i * 3 + 2] + wave;
        arr[i * 3 + 1] = f.base[i * 3 + 1] + wave * 0.35;
      }
      pos.needsUpdate = true;
    }
  };

  // ---- projektörler ----
  const glow = glowTexture();
  const lampMat = new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-cream)"), fog: false });
  const towerMat = new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-ink-850)") });
  for (const [x, z] of [
    [-34, STAND_Z - backStand.depth - 4],
    [34, STAND_Z - backStand.depth - 4],
    [-30, 72 + farStand.depth + 4],
    [30, 72 + farStand.depth + 4],
  ]) {
    const y = backStand.top + 9;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.9, y, 0.9), towerMat);
    tower.position.set(x, y / 2, z);
    const lamps = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 0.5), lampMat);
    lamps.position.set(x, y + 1.6, z);
    lamps.lookAt(0, 0, 12);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: tokenColor("var(--color-cream)"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.85 }));
    halo.position.set(x, y + 1.6, z);
    halo.scale.setScalar(tier.extras ? 30 : 20);
    group.add(tower, lamps, halo);
  }

  // ---- flaşlar: şut öncesi tribünde yanıp sönen küçük ışıklar ----
  const FLASHES = tier.extras ? 36 : 0;
  const flashPos = new Float32Array(FLASHES * 3);
  const flashCol = new Float32Array(FLASHES * 3);
  const flashLife = new Float32Array(FLASHES);
  const flashGeo = new THREE.BufferGeometry();
  flashGeo.setAttribute("position", new THREE.BufferAttribute(flashPos, 3).setUsage(THREE.DynamicDrawUsage));
  flashGeo.setAttribute("color", new THREE.BufferAttribute(flashCol, 3).setUsage(THREE.DynamicDrawUsage));
  const flashes = new THREE.Points(flashGeo, new THREE.PointsMaterial({ map: glow, size: 1.5, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  flashes.frustumCulled = false;
  if (FLASHES) group.add(flashes);
  const setFlashes: Stadium["setFlashes"] = (dt, intensity) => {
    if (!FLASHES || !extras) return;
    const f = backStand.fans;
    for (let i = 0; i < FLASHES; i++) {
      flashLife[i] -= dt;
      if (flashLife[i] <= 0 && Math.random() < intensity * dt * 5) {
        const j = Math.floor(Math.random() * f.count);
        flashPos[i * 3] = f.base[j * 3];
        flashPos[i * 3 + 1] = f.base[j * 3 + 1] + 0.75;
        flashPos[i * 3 + 2] = f.base[j * 3 + 2] + STAND_Z + 0.3;
        flashLife[i] = 0.16;
      }
      const v = Math.max(0, flashLife[i] / 0.16);
      flashCol[i * 3] = flashCol[i * 3 + 1] = flashCol[i * 3 + 2] = v;
    }
    flashGeo.attributes.position.needsUpdate = true;
    flashGeo.attributes.color.needsUpdate = true;
  };

  const setNetOpacity: Stadium["setNetOpacity"] = (opacity) => {
    netMat.opacity = opacity;
  };

  let extras = tier.extras;
  const setDetail: Stadium["setDetail"] = (next) => {
    const rows = [next.crowdRows[0], next.crowdRows[1], next.crowdRows[1]];
    stands.forEach((s, i) => {
      const f = s.fans;
      f.count = rows[i] <= 0 ? 0 : (f.rowEnds[Math.min(rows[i], f.rowEnds.length) - 1] ?? 0);
      f.body.count = f.head.count = f.count;
    });
    extras = next.extras;
    flagGroup.visible = extras;
    flashes.visible = extras;
  };

  return { group, goal, setNet, setCrowd, setBoards, setFlashes, setFlags, setNetOpacity, setDetail };
}
