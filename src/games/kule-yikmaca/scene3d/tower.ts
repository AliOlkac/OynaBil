import * as THREE from "three";
import { canvasTexture, clamp01, easeInOut, seeded, tokenColor, tokenCss } from "../../shared/stage3d/kit";
import type { Zone } from "../logic";
import type { ArtTeam } from "../scene/art";
import { collapseFall, COLLAPSE_SECONDS, HEAP_SHIFT, knockCount, knockFall, pickBlocks, towerLayout, type BlockSpec, type Fall } from "./debris";
import { Flag } from "./flag";
import { arcAt, dirOf, H_APEX, H_BASE, H_BODY_TOP, H_ROOF_BASE, H_WINDOW_BOTTOM, R_BASE, R_BODY, R_PARAPET, R_ROOF, seededRandom, TOWER_X, type Arc } from "./world";

/**
 * Taş taş örülmüş kule. Bütün taşlar tek bir çizim çağrısıdır (InstancedMesh); isabet alan yerin
 * taşları yerinden fırlar ve arkadaki karanlık dolgu görünür, kule yıkılınca hepsi moloz yığınına dökülür.
 * Kule orta çağ Anadolu burçlarından esinlenir: taş gövde, çini kuşak, mazgallı burç, takım renginde külah.
 */

export type TowerHit = { zone: Zone; damage: number; hitY: number; index: number };

type Block = {
  spec: BlockSpec;
  home: THREE.Matrix4;
  qHome: THREE.Quaternion;
  /** 0 yerinde, 1 düşüyor, 2 yerde duruyor. */
  state: 0 | 1 | 2;
  arc: Arc | null;
  fall: Fall | null;
  q0: THREE.Quaternion;
  qRest: THREE.Quaternion;
  /** İsabetle düşen taş yere vurunca toz kaldırır; yıkılışta toz ayrıca üretilir. */
  thump: boolean;
};

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const ROOF_H = H_APEX - H_ROOF_BASE;
/** Hasar bu değeri geçince kule yana yatmaya başlar. */
const LEAN_FROM = 70;
const MAX_LEAN = 0.03;

/** İçe doğru daralan kama taş: yan yana dizilince yuvarlak bir duvar örer. */
function wedgeGeometry(taper = 0.73) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getZ(i) < 0) p.setX(i, p.getX(i) * taper);
  g.computeVertexNormals();
  return g;
}

function stoneTexture() {
  const rnd = seeded(77);
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    // Kenarlar koyu: taşın pahı. Yüzeyde çukurlar ve damarlar.
    const edge = ctx.createLinearGradient(0, 0, 0, h);
    edge.addColorStop(0, "rgba(255,255,255,0.0)");
    edge.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.42)";
    ctx.lineWidth = 9;
    ctx.strokeRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    for (let i = 0; i < 46; i++) {
      ctx.fillStyle = `rgba(0,0,0,${(0.05 + rnd() * 0.14).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      let x = rnd() * w;
      let y = rnd() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rnd() - 0.5) * 40;
        y += rnd() * 22;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

/** Külahın kiremitleri: takım renginde, balık pulu gibi dizili. */
function roofTexture(team: ArtTeam) {
  return canvasTexture(
    512,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = tokenCss(team.base);
      ctx.fillRect(0, 0, w, h);
      const rows = 7;
      const rowH = h / rows;
      ctx.lineWidth = 5;
      ctx.strokeStyle = tokenCss(team.deep);
      for (let r = 0; r < rows; r++) {
        // Doku yukarıdan aşağı çizilir; tepedeki sıralarda kiremit seyrekleşir.
        const count = 6 + r * 3;
        const step = w / count;
        const y = r * rowH;
        for (let i = -1; i <= count; i++) {
          const x = (i + (r % 2 ? 0.5 : 0)) * step;
          ctx.fillStyle = (i + r) % 3 === 0 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.07)";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + rowH * 0.45);
          ctx.arc(x + step / 2, y + rowH * 0.45, step / 2, Math.PI, 0, true);
          ctx.lineTo(x + step, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    },
    { anisotropy: 8 },
  );
}

/** Kemerli pencere: taş söve, içeride ışık, takım renginde kepenkler. Yerel +z dışarı bakar. */
function buildWindow(team: ArtTeam) {
  const group = new THREE.Group();
  const trim = new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-tas-acik)") });
  const wood = new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-ahsap-koyu)") });
  const shape = new THREE.Shape();
  const hw = 0.31;
  const rect = 0.6;
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, rect);
  shape.absarc(0, rect, hw, 0, Math.PI, false);
  shape.lineTo(-hw, 0);
  const opening = new THREE.ShapeGeometry(shape, 10);
  const recess = new THREE.Mesh(opening, new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-ink-950)") }));
  recess.position.z = -0.02;
  const glow = new THREE.Mesh(opening, new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-kehribar)").lerp(tokenColor("var(--color-ufuk-acik)"), 0.35), fog: false }));
  glow.scale.set(0.9, 0.92, 1);
  glow.position.set(0, 0.03, -0.012);
  const mullion = new THREE.Group();
  const bar = (w: number, h: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), wood);
    m.position.set(x, y, 0);
    mullion.add(m);
  };
  bar(0.05, 0.9, 0, 0.45);
  bar(0.62, 0.05, 0, 0.6);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.24), trim);
  sill.position.set(0, -0.05, -0.02);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.365, 0.06, 6, 14, Math.PI), trim);
  arch.position.set(0, rect, -0.01);
  arch.scale.z = 2;
  const jambs = [-1, 1].map((s) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, rect, 0.2), trim);
    m.position.set(s * 0.365, rect / 2, -0.03);
    return m;
  });
  const shutterMat = new THREE.MeshLambertMaterial({ color: tokenColor(team.base) });
  const strapMat = new THREE.MeshLambertMaterial({ color: tokenColor(team.deep) });
  const shutters = [-1, 1].map((s) => {
    const g = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.62, 0.045), shutterMat);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.07, 0.055), strapMat);
    strap.position.y = 0.14;
    const strap2 = strap.clone();
    strap2.position.y = -0.14;
    g.add(leaf, strap, strap2);
    g.position.set(s * 0.6, 0.33, -0.02);
    g.rotation.y = s * 0.28;
    return g;
  });
  group.add(recess, glow, mullion, sill, arch, ...jambs, ...shutters);
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== recess && o !== glow) o.castShadow = true;
  });
  return { group, alive: [glow, mullion, ...shutters] as THREE.Object3D[] };
}

export class Tower {
  readonly group = new THREE.Group();
  /** Bu kareye kadar yere vuran taşlar (dünya x, z): motor toz kaldırır ve ses çalar. */
  readonly landings: { x: number; z: number }[] = [];
  taken = 0;
  windowBroken = false;
  roofHits = 0;
  collapseStart: number | null = null;

  private readonly layout = towerLayout();
  private readonly blocks: Block[];
  private readonly intact: boolean[];
  private readonly mesh: THREE.InstancedMesh;
  private readonly standing = new THREE.Group();
  private readonly cores: THREE.Mesh[] = [];
  private readonly roof = new THREE.Group();
  private readonly roofHole: THREE.Mesh;
  private readonly flag: Flag;
  /** [0] düşmana bakan pencere (taş buraya çarpar), [1] kameraya bakan. */
  private readonly windows: ReturnType<typeof buildWindow>[] = [];
  private readonly windowBlocks: number[];
  private readonly poseM = new THREE.Matrix4();
  private readonly poseQ = new THREE.Quaternion();
  private lean = 0;
  private jitter = 0;
  private poseDirty = false;
  private flying = 0;
  private instantCollapse = false;
  private readonly roofArc: Arc = { t0: 0, T: 1.15, p0: { x: 0, y: H_ROOF_BASE, z: 0 }, rest: { x: 0, y: 0, z: 0 } };
  private roofTilt = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly tmp = { x: 0, y: 0, z: 0 };

  /** Kulenin düşmana bakan yüzünün x yönü ve yıkılırken devrildiği yön. */
  private readonly toward: 1 | -1;
  private readonly fallDir: 1 | -1;

  constructor(
    readonly side: 0 | 1,
    team: ArtTeam,
  ) {
    this.toward = dirOf(side);
    this.fallDir = -this.toward as 1 | -1;
    this.group.position.set(TOWER_X[side], 0, 0);

    // ---- taşlar ----
    const rnd = seeded(31 + side * 17);
    const stone = tokenColor("var(--color-tas)");
    const light = tokenColor("var(--color-tas-acik)");
    const dark = tokenColor("var(--color-tas-koyu)");
    const tile = [tokenColor("var(--color-firuze)"), tokenColor("var(--color-cream)"), tokenColor("var(--color-firuze-deep)")];
    this.mesh = new THREE.InstancedMesh(wedgeGeometry(), new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.94, metalness: 0 }), this.layout.length);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    const color = new THREE.Color();
    this.blocks = this.layout.map((spec, i) => {
      const qHome = new THREE.Quaternion().setFromAxisAngle(Y, spec.yaw);
      const home = new THREE.Matrix4().compose(new THREE.Vector3(spec.x, spec.y, spec.z), qHome, new THREE.Vector3(spec.w, spec.h, spec.d));
      this.mesh.setMatrixAt(i, home);
      const r = rnd();
      if (spec.part === "cini") color.copy(tile[i % 3]);
      else if (spec.part === "merlon") color.copy(light).lerp(stone, r * 0.5);
      else if (spec.part === "base") color.copy(stone).lerp(dark, 0.25 + r * 0.4);
      else color.copy(stone).lerp(r < 0.5 ? light : dark, Math.abs(r - 0.5) * 0.9);
      this.mesh.setColorAt(i, color);
      return { spec, home, qHome, state: 0, arc: null, fall: null, q0: new THREE.Quaternion(), qRest: new THREE.Quaternion(), thump: false } satisfies Block;
    });
    this.intact = this.blocks.map(() => true);
    this.group.add(this.mesh);

    // ---- dolgu: taşların arkasındaki karanlık çekirdek ----
    const coreMat = new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-tas-derz)") });
    const core = (radius: number, from: number, to: number) => {
      const g = new THREE.CylinderGeometry(radius, radius, to - from, 20);
      g.translate(0, (to - from) / 2, 0);
      const m = new THREE.Mesh(g, coreMat);
      m.position.y = from;
      this.cores.push(m);
      this.standing.add(m);
    };
    core(R_BASE - 0.46, 0, H_BASE);
    core(R_BODY - 0.385, H_BASE, H_BODY_TOP);
    core(R_PARAPET - 0.41, H_BODY_TOP, H_BODY_TOP + 0.9);
    core(1.2, H_BODY_TOP + 0.9, H_ROOF_BASE);

    // ---- pencereler ----
    const sillY = H_WINDOW_BOTTOM + 0.1;
    for (const yaw of [(this.toward * Math.PI) / 2, 0]) {
      const w = buildWindow(team);
      w.group.position.set(Math.sin(yaw) * (R_BODY + 0.085), sillY, Math.cos(yaw) * (R_BODY + 0.085));
      w.group.rotation.y = yaw;
      this.windows.push(w);
      this.standing.add(w.group);
    }
    // Düşmana bakan pencerenin arkasındaki taşlar: bunlardan biri düşerse söve de gider.
    this.windowBlocks = this.layout.flatMap((b, i) => (Math.hypot(b.x - this.toward * (R_BODY - 0.2), b.y - (sillY + 0.45), b.z) < 0.7 ? [i] : []));

    // ---- külah, alem ve bayrak ----
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTexture(team), roughness: 0.7, metalness: 0 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(R_ROOF, ROOF_H, 24, 1, true), roofMat);
    cone.position.y = ROOF_H / 2;
    cone.castShadow = true;
    const under = new THREE.Mesh(new THREE.CircleGeometry(R_ROOF, 24), new THREE.MeshLambertMaterial({ color: tokenColor(team.deep).multiplyScalar(0.45) }));
    under.rotation.x = Math.PI / 2;
    under.position.y = 0.01;
    const gold = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-kehribar)"), roughness: 0.35, metalness: 0.4 });
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), gold);
    finial.position.y = ROOF_H + 0.05;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-ahsap-koyu)") }));
    pole.position.y = ROOF_H + 0.75;
    this.flag = new Flag(1.35, 0.72, tokenColor(team.base), side * 1.3);
    this.flag.mesh.position.y = ROOF_H + 1.46;
    // Külaha isabet edince kiremitler dökülür: düşmana bakan yüzde karanlık bir gedik.
    const slope = new THREE.Vector3(this.toward * ROOF_H, R_ROOF, 0).normalize();
    this.roofHole = new THREE.Mesh(new THREE.CircleGeometry(0.42, 7), new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-ink-950)") }));
    this.roofHole.position.set(this.toward * (R_ROOF * 0.55 + 0.02), ROOF_H * 0.45, 0).addScaledVector(slope, 0.015);
    this.roofHole.quaternion.setFromUnitVectors(Z, slope);
    this.roofHole.scale.set(1.25, 0.85, 1);
    this.roofHole.visible = false;
    this.roof.add(cone, under, finial, pole, this.flag.mesh, this.roofHole);
    this.roof.position.y = H_ROOF_BASE;
    this.standing.add(this.roof);
    this.group.add(this.standing);
  }

  get collapsing() {
    return this.collapseStart !== null;
  }

  /** Yıkılış gösterisi bitti mi? */
  collapsed(time: number) {
    return this.collapseStart !== null && (this.instantCollapse || time - this.collapseStart > COLLAPSE_SECONDS);
  }

  /** İsabeti kuleye işler. `animated` değilse (oyun yeniden açıldıysa) taşlar doğrudan düştükleri yere konur. */
  hit(h: TowerHit, time: number, animated: boolean) {
    this.taken = Math.min(100, this.taken + h.damage);
    if (h.damage <= 0 || this.collapsing) return;
    if (h.zone === "pencere") this.breakWindow();
    if (h.zone === "kulah") {
      this.roofHits++;
      this.roofHole.visible = true;
      this.roofTilt = -this.fallDir * Math.min(2, this.roofHits) * 0.105;
      this.roof.rotation.z = this.roofTilt;
    }
    const rnd = seededRandom((this.side + 1) * 9973 + (h.index + 2) * 131);
    const impact = { x: this.toward * (h.zone === "kulah" ? R_PARAPET : h.hitY < H_BASE ? R_BASE : h.hitY < H_BODY_TOP ? R_BODY : R_PARAPET), y: h.hitY, z: 0 };
    const picked = pickBlocks(this.layout, this.intact, impact, knockCount(h.zone, h.damage), rnd);
    for (const i of picked) this.release(i, knockFall(this.layout[i], this.toward, animated ? time : time - 100, rnd), true);
    if (this.windowBlocks.some((i) => !this.intact[i])) this.windows[0].group.visible = false;
    const lean = -this.fallDir * clamp01((this.taken - LEAN_FROM) / (100 - LEAN_FROM)) * MAX_LEAN;
    if (lean !== this.lean) {
      this.lean = lean;
      this.poseDirty = true;
    }
  }

  /** Kule çöker: bütün taşlar sırayla çözülüp moloz yığınına dökülür. */
  collapse(time: number, instant: boolean) {
    if (this.collapsing) return;
    this.collapseStart = time;
    this.instantCollapse = instant;
    this.refreshPose();
    const rnd = seededRandom((this.side + 1) * 7919 + 17);
    for (let i = 0; i < this.blocks.length; i++) {
      if (this.blocks[i].state === 0) this.release(i, collapseFall(this.layout[i], this.fallDir, instant ? time - 100 : time, rnd), false);
    }
    // Külah yığının üstüne, yana yatmış olarak düşer.
    this.roofArc.t0 = instant ? time - 100 : time + 0.5;
    this.roofArc.rest = { x: this.fallDir * (HEAP_SHIFT + 1.5), y: 1.15, z: 0.5 };
    this.breakWindow();
  }

  private breakWindow() {
    this.windowBroken = true;
    for (const w of this.windows) for (const o of w.alive) o.visible = false;
  }

  private release(i: number, fall: Fall, thump: boolean) {
    const b = this.blocks[i];
    if (b.state !== 0) return;
    this.intact[i] = false;
    b.state = 1;
    b.fall = fall;
    b.thump = thump;
    this.p.setFromMatrixPosition(b.home).applyMatrix4(this.poseM);
    b.arc = { t0: fall.t0, T: fall.T, p0: { x: this.p.x, y: this.p.y, z: this.p.z }, rest: fall.rest };
    b.q0.copy(this.poseQ).multiply(b.qHome);
    // Yerde: önce hangi yüzüne yatacağı, sonra yığındaki eğimi, en son yönü.
    b.qRest.setFromAxisAngle(Y, fall.yaw);
    if (fall.tilt) b.qRest.multiply(this.q.setFromAxisAngle(this.axis.set(Math.cos(fall.tiltDir), 0, Math.sin(fall.tiltDir)), fall.tilt));
    if (fall.flip === 1) b.qRest.multiply(this.q.setFromAxisAngle(X, -Math.PI / 2));
    else if (fall.flip === 2) b.qRest.multiply(this.q.setFromAxisAngle(Z, Math.PI / 2));
    this.flying++;
  }

  private refreshPose() {
    this.poseQ.setFromAxisAngle(Z, this.lean);
    this.poseM.compose(this.p.set(this.jitter, 0, 0), this.poseQ, this.s.set(1, 1, 1));
    this.standing.position.x = this.jitter;
    this.standing.rotation.z = this.lean;
    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      if (b.state === 0) this.mesh.setMatrixAt(i, this.m.multiplyMatrices(this.poseM, b.home));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.poseDirty = false;
  }

  /** Her kare: düşen taşlar, yıkılış ve bayrak. `wind` -3..3, artı değer +x yönüne eser. */
  update(time: number, wind: number, quiet: boolean) {
    this.flag.update(time, wind, quiet);
    const col = this.collapseStart;
    const tau = col === null ? -1 : this.instantCollapse ? 99 : time - col;

    // Yıkılışın başında kule sarsılır; taşlar çözülmeye başlayınca dolgu çöker.
    const shake = tau >= 0 && tau < 0.45 && !quiet ? Math.sin(tau * 90) * 0.07 * (1 - tau / 0.45) : 0;
    if (col === null && this.poseDirty) this.refreshPose();

    if (this.flying > 0) {
      for (let i = 0; i < this.blocks.length; i++) {
        const b = this.blocks[i];
        if (b.state !== 1 || !b.arc || !b.fall) continue;
        const k = arcAt(b.arc, time, this.tmp);
        if (k <= 0) {
          this.p.set(this.tmp.x + shake, this.tmp.y, this.tmp.z);
          this.q.copy(b.q0);
        } else {
          this.p.set(this.tmp.x, this.tmp.y, this.tmp.z);
          const turn = k >= 1 ? 1 : k;
          this.q.copy(b.q0).slerp(b.qRest, easeInOut(turn));
          if (turn < 1 && b.fall.spins) {
            this.q2.setFromAxisAngle(this.axis.set(Math.cos(b.fall.axis), 0, Math.sin(b.fall.axis)), Math.PI * 2 * b.fall.spins * turn);
            this.q.premultiply(this.q2);
          }
          if (k >= 1) {
            if (b.thump) {
              b.thump = false;
              this.landings.push({ x: this.group.position.x + b.arc.rest.x, z: b.arc.rest.z });
            }
            // Sekme bitince taş yerine oturur ve bir daha hesaplanmaz.
            if (time - b.arc.t0 - b.arc.T > 0.7) {
              this.p.set(b.arc.rest.x, b.arc.rest.y, b.arc.rest.z);
              b.state = 2;
              this.flying--;
            }
          }
        }
        this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s.set(b.spec.w, b.spec.h, b.spec.d)));
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    }

    if (col === null) return;
    const sink = clamp01((tau - 0.3) / 0.75);
    this.standing.position.x = shake;
    for (const c of this.cores) {
      c.scale.y = Math.max(0.001, 1 - sink);
      c.visible = sink < 1;
    }
    for (const w of this.windows) if (tau > 0.3) w.group.visible = false;
    // Külah: taşlarla birlikte düşer, yığının üstünde yana yatar.
    const k = arcAt(this.roofArc, time, this.tmp);
    this.roof.position.set(this.tmp.x, this.tmp.y, this.tmp.z);
    this.roof.rotation.z = this.roofTilt + (-this.fallDir * 1.02 - this.roofTilt) * easeInOut(clamp01(k));
    this.roof.rotation.x = 0.16 * easeInOut(clamp01(k));
  }
}
