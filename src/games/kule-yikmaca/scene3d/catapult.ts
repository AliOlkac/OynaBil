import * as THREE from "three";
import { canvasTexture, placeSegment, seeded, tokenColor, tokenCss } from "../../shared/stage3d/kit";
import type { ArtTeam } from "../scene/art";
import { Flag } from "./flag";
import { ARM_LEN, ARM_REST, bucketPoint, CATAPULT_X, CRANK_R, CRANK_Z, dirOf, DRUM, PILE, PIVOT, STONE_R } from "./world";

/**
 * Ahşap mancınık: tekerlekli şasi, burulma kolu ve kepçe, vinç ve kolu, taş yığını, takım flaması.
 * Yerelde +x ileri bakar; sağdaki takımın mancınığı x ekseninde aynalanır, vinç kolu yine kamera tarafında kalır.
 */

function woodTexture() {
  const rnd = seeded(5);
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = tokenCss("var(--color-ahsap)");
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = rnd() < 0.5 ? tokenCss("var(--color-ahsap-koyu)") : tokenCss("var(--color-ahsap-acik)");
      ctx.globalAlpha = 0.18 + rnd() * 0.3;
      ctx.lineWidth = 1 + rnd() * 2.5;
      const y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 8, w * 0.7, y + (rnd() - 0.5) * 8, w, y + (rnd() - 0.5) * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

function wheelTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const c = w / 2;
    ctx.fillStyle = tokenCss("var(--color-ahsap-koyu)");
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = tokenCss("var(--color-ahsap)");
    ctx.beginPath();
    ctx.arc(c, c, c * 0.84, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tokenCss("var(--color-ahsap-koyu)");
    ctx.lineWidth = 9;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * c * 0.84, c + Math.sin(a) * c * 0.84);
      ctx.lineTo(c - Math.cos(a) * c * 0.84, c - Math.sin(a) * c * 0.84);
      ctx.stroke();
    }
    ctx.fillStyle = tokenCss("var(--color-tas-derz)");
    ctx.beginPath();
    ctx.arc(c, c, c * 0.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Köşeli, yontulmamış taş: mancınık güllesi ve yığındaki taşlar. */
export function rockGeometry(radius: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(radius, 1);
  const rnd = seeded(seed);
  const p = g.attributes.position;
  // Aynı köşeyi paylaşan yüzler birlikte oynasın diye köşeler konuma göre eşlenir.
  const moved = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let k = moved.get(key);
    if (k === undefined) {
      k = 0.8 + rnd() * 0.36;
      moved.set(key, k);
    }
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

export class Catapult {
  readonly group = new THREE.Group();
  /** Kepçedeki taş ve ateşli güllenin alevi. */
  readonly loaded: THREE.Mesh;
  readonly flame: THREE.Sprite;
  private readonly body = new THREE.Group();
  private readonly arm = new THREE.Group();
  private readonly crank = new THREE.Group();
  private readonly rope: THREE.Mesh;
  private readonly wheels: THREE.Mesh[] = [];
  private readonly pennant: Flag;
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly stoneMat: THREE.MeshStandardMaterial;
  private readonly cool = tokenColor("var(--color-tas)");
  private readonly hot = tokenColor("var(--color-ates)");

  constructor(
    readonly side: 0 | 1,
    team: ArtTeam,
    glow: THREE.Texture,
  ) {
    this.group.position.set(CATAPULT_X[side], 0, 0);
    this.group.scale.x = dirOf(side);
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85, metalness: 0 });
    const darkWood = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ahsap-koyu)"), roughness: 0.9, metalness: 0 });
    const iron = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-tas-derz)"), roughness: 0.55, metalness: 0.35 });
    const rope = new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-ip)") });
    const teamMat = new THREE.MeshLambertMaterial({ color: tokenColor(team.base) });
    const add = <T extends THREE.Object3D>(parent: THREE.Object3D, obj: T): T => {
      obj.castShadow = true;
      parent.add(obj);
      return obj;
    };
    const box = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = wood) => {
      const m = add(parent, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
      m.position.set(x, y, z);
      return m;
    };
    /** İki nokta arasına kiriş. */
    const beam = (parent: THREE.Object3D, from: [number, number, number], to: [number, number, number], thick = 0.14, mat: THREE.Material = wood) => {
      const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      const g = new THREE.BoxGeometry(thick, len, thick);
      g.translate(0, len / 2, 0);
      const m = add(parent, new THREE.Mesh(g, mat));
      placeSegment(m, this.a.set(...from), this.b.set(...to));
      return m;
    };
    const axle = (parent: THREE.Object3D, radius: number, length: number, x: number, y: number, mat: THREE.Material) => {
      const m = add(parent, new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), mat));
      m.rotation.x = Math.PI / 2;
      m.position.set(x, y, 0);
      return m;
    };

    // ---- şasi ----
    const RAIL_Y = 0.62;
    const RAIL_Z = 0.62;
    for (const z of [-RAIL_Z, RAIL_Z]) box(this.body, 3.3, 0.18, 0.2, -0.1, RAIL_Y, z);
    for (const x of [-1.6, -0.2, 1.35]) box(this.body, 0.18, 0.16, RAIL_Z * 2 + 0.2, x, RAIL_Y, 0);
    const wheelMats = [darkWood, new THREE.MeshStandardMaterial({ map: wheelTexture(), roughness: 0.85 }), new THREE.MeshStandardMaterial({ map: wheelTexture(), roughness: 0.85 })];
    for (const x of [-1.24, 1.12]) {
      axle(this.body, 0.06, 1.9, x, 0.46, iron);
      for (const z of [-0.88, 0.88]) {
        const w = add(this.body, new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 18), wheelMats));
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.46, z);
        this.wheels.push(w);
        const hub = add(this.body, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 10), teamMat));
        hub.rotation.x = Math.PI / 2;
        hub.position.set(x, 0.46, z);
      }
    }
    // Kolun mili ve onu taşıyan çatkılar.
    axle(this.body, 0.075, RAIL_Z * 2 + 0.36, PIVOT.x, PIVOT.y, iron);
    // Kolun çarpıp durduğu yastıklı kiriş ve dikmeleri.
    const stopA = ((ARM_REST - 5.5) * Math.PI) / 180;
    const stop = { x: PIVOT.x + Math.cos(stopA) * 1.55, y: PIVOT.y + Math.sin(stopA) * 1.55 };
    for (const z of [-RAIL_Z, RAIL_Z]) {
      beam(this.body, [-0.55, RAIL_Y, z], [PIVOT.x, PIVOT.y + 0.06, z]);
      beam(this.body, [0.95, RAIL_Y, z], [PIVOT.x, PIVOT.y + 0.06, z]);
      beam(this.body, [1.3, RAIL_Y, z], [stop.x + 0.1, stop.y + 0.1, z], 0.15);
      beam(this.body, [0.1, RAIL_Y, z], [stop.x + 0.02, stop.y - 0.25, z], 0.11);
    }
    const pad = axle(this.body, 0.13, RAIL_Z * 2 + 0.3, stop.x + 0.1, stop.y, rope);
    pad.castShadow = true;
    box(this.body, 0.2, 0.3, 0.5, stop.x + 0.1, stop.y, 0, teamMat);

    // ---- vinç ----
    axle(this.body, 0.2, RAIL_Z * 2 - 0.1, DRUM.x, DRUM.y, rope);
    axle(this.body, 0.05, CRANK_Z * 2 + 0.1, DRUM.x, DRUM.y, iron);
    for (const z of [-RAIL_Z, RAIL_Z]) beam(this.body, [DRUM.x, RAIL_Y, z], [DRUM.x, DRUM.y + 0.16, z], 0.16);
    this.crank.position.set(DRUM.x, DRUM.y, 0);
    for (const z of [-CRANK_Z + 0.1, CRANK_Z - 0.1]) {
      box(this.crank, CRANK_R + 0.08, 0.07, 0.05, CRANK_R / 2, 0, z, iron);
      const handle = add(this.crank, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8), darkWood));
      handle.rotation.x = Math.PI / 2;
      handle.position.set(CRANK_R, 0, z + Math.sign(z) * 0.1);
    }
    this.body.add(this.crank);
    const ropeGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 5);
    ropeGeo.translate(0, 0.5, 0);
    this.rope = add(this.body, new THREE.Mesh(ropeGeo, rope));

    // ---- kol ve kepçe ----
    this.arm.position.set(PIVOT.x, PIVOT.y, 0);
    box(this.arm, ARM_LEN + 0.35, 0.15, 0.17, (ARM_LEN - 0.55) / 2 + 0.1, 0, 0);
    for (const x of [0.5, 1.3, 2.0]) box(this.arm, 0.07, 0.17, 0.19, x, 0, 0, iron);
    // Kepçe kolun -y yanındadır: kol kurulunca ağzı yukarı, bırakılınca ileri bakar.
    const bowl = add(this.arm, new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ahsap-koyu)"), roughness: 0.9, side: THREE.DoubleSide })));
    bowl.position.set(ARM_LEN, -0.2, 0);
    this.stoneMat = new THREE.MeshStandardMaterial({ color: this.cool.clone(), roughness: 0.9, emissive: tokenColor("var(--color-ates)"), emissiveIntensity: 0 });
    this.loaded = add(this.arm, new THREE.Mesh(rockGeometry(STONE_R, 11), this.stoneMat));
    this.loaded.position.set(ARM_LEN, -0.2, 0);
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: tokenColor("var(--color-ates)"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.flame.scale.setScalar(1.5);
    this.flame.position.copy(this.loaded.position);
    this.arm.add(this.flame);
    this.body.add(this.arm);

    // ---- flama ----
    const pole = add(this.body, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), darkWood));
    pole.position.set(-1.62, RAIL_Y + 0.95, -RAIL_Z);
    this.pennant = new Flag(0.9, 0.5, tokenColor(team.base), side * 2.1 + 1, 6);
    this.pennant.mesh.position.set(-1.62, RAIL_Y + 1.88, -RAIL_Z);
    this.body.add(this.pennant.mesh);
    this.group.add(this.body);

    // ---- taş yığını (geri tepmeyle oynamaz) ----
    const pileMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-tas)"), roughness: 0.95 });
    const spots: [number, number, number, number][] = [
      [0, 0.2, 0, 0.27], [0.42, 0.18, 0.12, 0.24], [-0.36, 0.19, 0.2, 0.25], [0.1, 0.19, 0.45, 0.25], [-0.1, 0.2, -0.38, 0.26], [0.06, 0.58, 0.1, 0.25], [0.5, 0.17, -0.34, 0.22],
    ];
    spots.forEach(([x, y, z, r], i) => {
      const rock = add(this.group, new THREE.Mesh(rockGeometry(r, 40 + i), pileMat));
      rock.position.set(PILE.x + x, y, PILE.z + z);
      rock.rotation.set(i, i * 2.1, i * 0.7);
      rock.receiveShadow = true;
    });

    this.setArm(ARM_REST);
    this.setLoaded(false, false, 0);
  }

  /** Kolun açısı (derece). Vinç ipi kolu izler. */
  setArm(angleDeg: number) {
    const a = (angleDeg * Math.PI) / 180;
    this.arm.rotation.z = a;
    this.a.set(DRUM.x, DRUM.y + 0.18, 0);
    this.b.set(PIVOT.x + Math.cos(a) * 1.04, PIVOT.y + Math.sin(a) * 1.04, 0);
    placeSegment(this.rope, this.a, this.b);
    this.rope.scale.y = this.a.distanceTo(this.b);
  }

  setCrank(angle: number) {
    this.crank.rotation.z = angle;
  }

  /** Atışın geri tepmesi: şasi geri kayar, tekerlekler döner. */
  setRecoil(offset: number) {
    this.body.position.x = offset;
    for (const w of this.wheels) w.rotation.y = -offset / 0.46;
  }

  setLoaded(loaded: boolean, fire: boolean, time: number) {
    this.loaded.visible = loaded;
    this.flame.visible = loaded && fire;
    this.stoneMat.color.copy(fire ? this.hot : this.cool);
    this.stoneMat.emissiveIntensity = fire ? 1.6 : 0;
    if (this.flame.visible) this.flame.material.opacity = 0.75 + 0.25 * Math.sin(time * 30);
  }

  /** Kepçedeki taşın dünya konumu: atış buradan başlar, kurucu taşı buraya koyar. */
  bucketWorld(angleDeg: number, out: THREE.Vector3): THREE.Vector3 {
    const p = bucketPoint(angleDeg);
    return out.set(CATAPULT_X[this.side] + dirOf(this.side) * (p.x + this.body.position.x), p.y, 0);
  }

  /** `wind` dünya yönündedir; aynalı mancınıkta flama yine doğru yöne döner. */
  update(time: number, wind: number, quiet: boolean) {
    this.pennant.update(time, wind * dirOf(this.side), quiet);
  }
}
