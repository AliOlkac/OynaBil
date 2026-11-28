import * as THREE from "three";
import { canvasTexture, placeSegment, seeded, tokenColor, tokenCss } from "../../shared/stage3d/kit";
import type { ArtTeam } from "../scene/art";
import { rockGeometry } from "./catapult";
import { Flag } from "./flag";
import { CATAPULT_X, dirOf, PILE, POUCH_REST, STONE_R } from "./world";

/**
 * Dev sapan: kalın bir Y gövde, iki çatal ucundan gerilen lastikler ve taşı tutan deri cep.
 * Oyuncu çektikçe cep geriye ve aşağıya gelir, lastikler uzayıp incelir; bırakınca cep ileri fırlar.
 * Yerelde +x ileri (karşı kuleye) bakar; sağdaki takımın sapanı x ekseninde aynalanır.
 */

/** Çatalın x konumu ve uçlarının yüksekliği, yarı açıklığı (z). */
const FORK_X = POUCH_REST.x + 0.35;
const TIP_Y = POUCH_REST.y + 0.2;
const TIP_Z = 0.62;
const TRUNK_TOP = POUCH_REST.y - 1.25;
/** Cebin yarı genişliği: lastikler cebin iki yanına bağlanır. */
const POUCH_Z = 0.2;

function barkTexture() {
  const rnd = seeded(9);
  return canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = tokenCss("var(--color-ahsap)");
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = rnd() < 0.5 ? tokenCss("var(--color-ahsap-koyu)") : tokenCss("var(--color-ahsap-acik)");
      ctx.globalAlpha = 0.2 + rnd() * 0.35;
      ctx.lineWidth = 1 + rnd() * 2;
      const x = rnd() * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (rnd() - 0.5) * 10, h * 0.3, x + (rnd() - 0.5) * 10, h * 0.7, x + (rnd() - 0.5) * 6, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

export class Slingshot {
  readonly group = new THREE.Group();
  /** Cepteki taş ve ateşli güllenin alevi. */
  readonly loaded: THREE.Mesh;
  readonly flame: THREE.Sprite;
  private readonly body = new THREE.Group();
  private readonly pouch = new THREE.Group();
  private readonly bands: THREE.Mesh[] = [];
  private readonly backBands: THREE.Mesh[] = [];
  private readonly pennant: Flag;
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly stoneMat: THREE.MeshStandardMaterial;
  private readonly cool = tokenColor("var(--color-tas)");
  private readonly hot = tokenColor("var(--color-ates)");
  private offset = { x: 0, y: 0 };

  constructor(
    readonly side: 0 | 1,
    team: ArtTeam,
    glow: THREE.Texture,
  ) {
    this.group.position.set(CATAPULT_X[side], 0, 0);
    this.group.scale.x = dirOf(side);
    const wood = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.85, metalness: 0 });
    const darkWood = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ahsap-koyu)"), roughness: 0.9 });
    const rubber = new THREE.MeshStandardMaterial({ color: tokenColor(team.deep), roughness: 0.6 });
    const leather = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-ahsap-koyu)"), roughness: 0.8, side: THREE.DoubleSide });
    const teamMat = new THREE.MeshLambertMaterial({ color: tokenColor(team.base) });
    const add = <T extends THREE.Object3D>(parent: THREE.Object3D, obj: T): T => {
      obj.castShadow = true;
      parent.add(obj);
      return obj;
    };
    /** İki nokta arasında yuvarlak dal. */
    const limb = (from: [number, number, number], to: [number, number, number], r0: number, r1: number) => {
      const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      const g = new THREE.CylinderGeometry(r1, r0, len, 10);
      g.translate(0, len / 2, 0);
      const m = add(this.body, new THREE.Mesh(g, wood));
      placeSegment(m, this.a.set(...from), this.b.set(...to));
      return m;
    };

    // ---- gövde: toprağa gömülü kalın dal, iki çatal, arkada destek ----
    const base = add(this.body, new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 0.35, 12), darkWood));
    base.position.set(FORK_X, 0.17, 0);
    base.receiveShadow = true;
    limb([FORK_X, 0.2, 0], [FORK_X, TRUNK_TOP, 0], 0.3, 0.26);
    for (const z of [-TIP_Z, TIP_Z]) {
      limb([FORK_X, TRUNK_TOP - 0.1, 0], [FORK_X - 0.05, TIP_Y - 0.55, z * 0.9], 0.24, 0.19);
      limb([FORK_X - 0.05, TIP_Y - 0.6, z * 0.9], [FORK_X, TIP_Y, z], 0.19, 0.15);
      // Lastiğin bağlandığı yerde takım renginde sargı.
      const wrap = add(this.body, new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.26, 10), teamMat));
      wrap.position.set(FORK_X, TIP_Y - 0.1, z);
    }
    // Arkaya eğik destek dikmeleri: dev sapan devrilmesin.
    for (const z of [-0.55, 0.55]) limb([FORK_X - 1.5, 0.05, z], [FORK_X - 0.05, TRUNK_TOP - 0.3, 0], 0.11, 0.09);

    // ---- lastikler: arkadaki ve öndeki çift (cebin iki yanına) ----
    const bandGeo = new THREE.BoxGeometry(0.09, 1, 0.16);
    bandGeo.translate(0, 0.5, 0);
    for (let i = 0; i < 2; i++) {
      this.bands.push(add(this.body, new THREE.Mesh(bandGeo, rubber)));
      this.backBands.push(add(this.body, new THREE.Mesh(bandGeo, rubber)));
    }

    // ---- cep ve taş ----
    const cup = add(this.pouch, new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), leather));
    cup.rotation.z = Math.PI / 2;
    cup.scale.set(1, 0.7, 1.15);
    this.stoneMat = new THREE.MeshStandardMaterial({ color: this.cool.clone(), roughness: 0.9, emissive: tokenColor("var(--color-ates)"), emissiveIntensity: 0 });
    this.loaded = add(this.pouch, new THREE.Mesh(rockGeometry(STONE_R, 11), this.stoneMat));
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: tokenColor("var(--color-ates)"), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.flame.scale.setScalar(1.5);
    this.pouch.add(this.flame);
    this.body.add(this.pouch);

    // ---- flama ----
    const pole = add(this.body, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6), darkWood));
    pole.position.set(-1.62, 0.95, -0.9);
    this.pennant = new Flag(0.9, 0.5, tokenColor(team.base), side * 2.1 + 1, 6);
    this.pennant.mesh.position.set(-1.62, 1.88, -0.9);
    this.body.add(this.pennant.mesh);
    this.group.add(this.body);

    // ---- taş yığını ----
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

    this.setPouch(0, 0);
    this.setLoaded(false, false, 0);
  }

  /** Cebin dinlenme yerinden kayması (yerel, metre): lastikler çatal uçlarından cebe uzanır, uzadıkça incelir. */
  setPouch(dx: number, dy: number) {
    this.offset = { x: dx, y: dy };
    const px = POUCH_REST.x + dx;
    const py = POUCH_REST.y + dy;
    this.pouch.position.set(px, py, 0);
    // Cep lastiklerin çektiği yöne döner.
    this.pouch.rotation.z = Math.atan2(TIP_Y - py, FORK_X - px) * 0.35;
    const rest = Math.hypot(FORK_X - POUCH_REST.x, TIP_Y - POUCH_REST.y);
    [-1, 1].forEach((sz, i) => {
      for (const [list, zTip] of [[this.bands, TIP_Z], [this.backBands, TIP_Z * 0.92]] as const) {
        const m = list[i];
        this.a.set(FORK_X, TIP_Y - 0.08, sz * zTip);
        this.b.set(px, py, sz * POUCH_Z);
        placeSegment(m, this.a, this.b);
        const len = this.a.distanceTo(this.b);
        const thin = Math.sqrt(Math.max(rest, 0.4) / Math.max(len, 0.4));
        m.scale.set(thin, len, thin);
      }
    });
  }

  /** Atışın sarsıntısı: gövde hafifçe titrer. */
  setRecoil(offset: number) {
    this.body.position.x = offset * 0.25;
    this.body.rotation.z = offset * 0.05;
  }

  setLoaded(loaded: boolean, fire: boolean, time: number) {
    this.loaded.visible = loaded;
    this.flame.visible = loaded && fire;
    this.stoneMat.color.copy(fire ? this.hot : this.cool);
    this.stoneMat.emissiveIntensity = fire ? 1.6 : 0;
    if (this.flame.visible) this.flame.material.opacity = 0.75 + 0.25 * Math.sin(time * 30);
  }

  /** Cebin (ve içindeki taşın) dünya konumu: kurucu taşı buraya koyar, tutukluk taşı buradan düşer. */
  pouchWorld(out: THREE.Vector3): THREE.Vector3 {
    return out.set(CATAPULT_X[this.side] + dirOf(this.side) * (POUCH_REST.x + this.offset.x + this.body.position.x), POUCH_REST.y + this.offset.y, 0);
  }

  /** `wind` dünya yönündedir; aynalı sapanda flama yine doğru yöne döner. */
  update(time: number, wind: number, quiet: boolean) {
    this.pennant.update(time, wind * dirOf(this.side), quiet);
  }
}
