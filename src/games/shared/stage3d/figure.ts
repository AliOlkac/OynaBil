import * as THREE from "three";
import { canvasTexture, placeSegment, solveLimb, tokenColor, tokenCss } from "./kit";

/**
 * Sahnelerdeki çocuk karakterin üç boyutlu hâli: iri başlı, oyuncak gibi, basit şekillerden kurulur.
 * Hazır model ya da iskelet animasyonu yoktur. Motor her karede elin ve ayağın nereye gideceğini söyler,
 * dirsek ile diz ters kinematikle bulunur. Böylece aynı karakter koşar, şut çeker, uçar ve sevinir.
 *
 * Bütün ölçüler metredir ve kök (kalça ortası) koordinatındadır; karakter yerelde +z yönüne bakar.
 */

export type HairStyle = "short" | "ponytail" | "curly" | "bun";
export type Mouth = "focus" | "shock" | "grin" | "smile";

export type FigureLook = {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  trim: string;
  shorts: string;
  socks: string;
  boots: string;
  /** Forma numarası ve nerede yazacağı. */
  number?: string;
  numberOn?: "back" | "front";
  numberColor?: string;
  /** Kaleci eldiveni rengi; verilmezse çıplak el. */
  gloves?: string;
  headband?: string;
  scale?: number;
};

export type Vec3Like = { x: number; y: number; z: number };

export type FigurePose = {
  /** Bilek ve ayak bileği hedefleri (kök koordinatı). */
  footL: Vec3Like;
  footR: Vec3Like;
  handL: Vec3Like;
  handR: Vec3Like;
  /** Gövdenin öne eğilmesi, yana yatması ve dönmesi (radyan). */
  lean?: number;
  bank?: number;
  twist?: number;
  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
  /** Ayak ucunun aşağı dönmesi (şut bacağı, uçan kaleci). */
  toeL?: number;
  toeR?: number;
  mouth?: Mouth;
};

export const FIGURE = {
  hipX: 0.095,
  thigh: 0.39,
  shin: 0.39,
  ankle: 0.07,
  shoulderX: 0.2,
  shoulderY: 0.43,
  upperArm: 0.26,
  foreArm: 0.25,
  headY: 0.69,
  headR: 0.2,
  /** Dizler hafif kırıkken kalçanın yerden yüksekliği. */
  stand: 0.82,
} as const;

const MOUTHS: Record<Mouth, [number, number, number]> = {
  focus: [0.052, 0.011, 0.02],
  smile: [0.06, 0.02, 0.02],
  grin: [0.078, 0.038, 0.022],
  shock: [0.036, 0.048, 0.022],
};

function jerseyTexture(look: FigureLook): THREE.CanvasTexture {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = tokenCss(look.shirt);
    ctx.fillRect(0, 0, w, h);
    // Yan paneller: kapsülün u=0 (sol yan) ve u=0.5 (sağ yan) çizgileri.
    ctx.fillStyle = tokenCss(look.trim);
    for (const u of [0, 0.5, 1]) ctx.fillRect(u * w - w * 0.045, 0, w * 0.09, h);
    // Yaka
    ctx.fillRect(0, 0, w, h * 0.2);
    if (look.number) {
      // Sırt u=0.75, göğüs u=0.25. Doku yatayda sıkışık olduğu için rakam genişletilerek yazılır.
      const u = look.numberOn === "front" ? 0.25 : 0.75;
      ctx.save();
      ctx.translate(u * w, h * 0.47);
      ctx.scale(1.38, 1);
      ctx.fillStyle = tokenCss(look.numberColor ?? "var(--color-cream)");
      ctx.font = `800 ${Math.round(h * 0.4)}px "Lexend Variable", Lexend, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(look.number, 0, 0);
      ctx.restore();
    }
  });
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const tmpD = new THREE.Vector3();
const pole = new THREE.Vector3();

export class KidFigure {
  /** Kalça ortası. Konumu ve dönüşü motor verir. */
  readonly root = new THREE.Group();
  private readonly spine = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly mouth: THREE.Mesh;
  private readonly eyes: THREE.Mesh[] = [];
  private readonly limbs: {
    side: -1 | 1;
    thigh: THREE.Mesh;
    shin: THREE.Mesh;
    boot: THREE.Mesh;
    upper: THREE.Mesh;
    sleeve: THREE.Mesh;
    fore: THREE.Mesh;
    hand: THREE.Mesh;
  }[] = [];
  private blinkAt = 1 + Math.random() * 3;

  constructor(look: FigureLook) {
    const F = FIGURE;
    const std = (color: string, roughness = 0.78) => new THREE.MeshStandardMaterial({ color: tokenColor(color), roughness, metalness: 0 });
    const skin = std(look.skin, 0.7);
    const shirt = new THREE.MeshStandardMaterial({ map: jerseyTexture(look), roughness: 0.8, metalness: 0 });
    const sleeveMat = std(look.shirt, 0.8);
    const shorts = std(look.shorts);
    const socks = std(look.socks);
    const boots = std(look.boots, 0.5);
    const hair = std(look.hair, 0.9);
    const dark = new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-ink-950)") });
    const add = <T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, shadow = true): T => {
      if (shadow && (obj as unknown as THREE.Mesh).isMesh) obj.castShadow = true;
      parent.add(obj);
      return obj;
    };

    // --- gövde ---
    const torso = add(this.spine, new THREE.Mesh(new THREE.CapsuleGeometry(0.165, 0.2, 6, 16), shirt));
    torso.position.y = 0.24;
    torso.scale.set(1.12, 1, 0.82);
    const hips = add(this.root, new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.05, 5, 14), shorts));
    hips.position.y = -0.035;
    hips.scale.set(1.13, 1, 0.86);
    this.root.add(this.spine);

    // --- baş ---
    this.head.position.y = F.headY;
    this.spine.add(this.head);
    add(this.head, new THREE.Mesh(new THREE.SphereGeometry(F.headR, 24, 18), skin));
    for (const s of [-1, 1]) {
      const ear = add(this.head, new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin), false);
      ear.position.set(s * 0.195, -0.015, 0);
      const eye = add(this.head, new THREE.Mesh(new THREE.SphereGeometry(0.027, 10, 8), dark), false);
      eye.position.set(s * 0.072, 0.012, 0.183);
      this.eyes.push(eye);
    }
    this.mouth = add(this.head, new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), dark), false);
    this.mouth.position.set(0, -0.082, 0.178);
    this.mouth.scale.set(...MOUTHS.focus);

    const cap = add(this.head, new THREE.Mesh(new THREE.SphereGeometry(F.headR * 1.06, 22, 12, 0, Math.PI * 2, 0, 1.38), hair));
    cap.rotation.x = -0.5;
    if (look.hairStyle === "bun") {
      add(this.head, new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), hair)).position.set(0, 0.19, -0.11);
    } else if (look.hairStyle === "ponytail") {
      const tail = add(this.head, new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), hair));
      tail.position.set(0, 0.0, -0.25);
      tail.scale.set(0.9, 1.5, 0.9);
    } else if (look.hairStyle === "curly") {
      for (const [x, y, z] of [[0, 0.17, 0.04], [-0.12, 0.13, -0.02], [0.12, 0.13, -0.02], [0, 0.12, -0.14], [-0.13, 0.03, -0.12], [0.13, 0.03, -0.12], [0, 0.0, -0.19]]) {
        add(this.head, new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), hair)).position.set(x, y, z);
      }
    }
    if (look.headband) {
      const band = add(this.head, new THREE.Mesh(new THREE.TorusGeometry(F.headR * 1.02, 0.022, 8, 28), std(look.headband)), false);
      band.rotation.x = Math.PI / 2 - 0.22;
      band.position.y = 0.075;
    }

    // --- kollar ve bacaklar: +Y boyunca uzanan parçalar, her karede yerleştirilir ---
    const along = (radius: number, length: number, mat: THREE.Material) => {
      const g = new THREE.CapsuleGeometry(radius, length, 4, 10);
      g.translate(0, length / 2, 0);
      return new THREE.Mesh(g, mat);
    };
    for (const side of [-1, 1] as const) {
      const hand = look.gloves
        ? new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), std(look.gloves, 0.6))
        : new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 8), skin);
      if (look.gloves) hand.scale.set(1, 1.15, 0.7);
      const boot = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), boots);
      boot.scale.set(0.078, 0.062, 0.15);
      this.limbs.push({
        side,
        thigh: add(this.root, along(0.074, F.thigh, skin)),
        shin: add(this.root, along(0.062, F.shin, socks)),
        boot: add(this.root, boot),
        upper: add(this.root, along(0.05, F.upperArm, skin)),
        sleeve: add(this.root, along(0.066, 0.1, sleeveMat)),
        fore: add(this.root, along(0.046, F.foreArm, look.gloves ? sleeveMat : skin)),
        hand: add(this.root, hand),
      });
    }

    this.root.scale.setScalar(look.scale ?? 1);
  }

  /** Karakteri verilen poza getirir. `time` göz kırpması içindir. */
  pose(p: FigurePose, time = 0) {
    const F = FIGURE;
    this.spine.rotation.set(p.lean ?? 0, p.twist ?? 0, -(p.bank ?? 0), "YXZ");
    this.spine.updateMatrix();
    this.head.rotation.set(p.headPitch ?? 0, p.headYaw ?? 0, p.headRoll ?? 0, "YXZ");
    const m = MOUTHS[p.mouth ?? "focus"];
    this.mouth.scale.set(m[0], m[1], m[2]);

    // Göz kırpma: birkaç saniyede bir, kısa.
    if (time > this.blinkAt + 0.12) this.blinkAt = time + 1.8 + Math.random() * 3.2;
    const open = time > this.blinkAt ? 0.15 : p.mouth === "shock" ? 1.25 : 1;
    for (const e of this.eyes) e.scale.set(1, open, 1);

    for (const l of this.limbs) {
      const left = l.side === -1;
      // Bacak
      tmpA.set(l.side * F.hipX, -0.03, 0);
      tmpB.copy((left ? p.footL : p.footR) as THREE.Vector3);
      pole.set(l.side * 0.12, 0, 1);
      solveLimb(tmpA, tmpB, F.thigh, F.shin, pole, tmpC, tmpD);
      placeSegment(l.thigh, tmpA, tmpC);
      placeSegment(l.shin, tmpC, tmpD);
      l.boot.position.set(tmpD.x, tmpD.y - 0.012, tmpD.z + 0.055);
      l.boot.rotation.set((left ? p.toeL : p.toeR) ?? 0, 0, 0);

      // Kol: omuz gövdeyle birlikte eğilir.
      tmpA.set(l.side * F.shoulderX, F.shoulderY, 0).applyMatrix4(this.spine.matrix);
      tmpB.copy((left ? p.handL : p.handR) as THREE.Vector3);
      pole.set(l.side * 0.7, -0.5, -0.6);
      solveLimb(tmpA, tmpB, F.upperArm, F.foreArm, pole, tmpC, tmpD);
      placeSegment(l.upper, tmpA, tmpC);
      placeSegment(l.sleeve, tmpA, tmpC);
      placeSegment(l.fore, tmpC, tmpD);
      l.hand.position.copy(tmpD);
      l.hand.quaternion.copy(l.fore.quaternion);
    }
  }

  /** İki elin orta noktası (dünya koordinatı): kalecinin tuttuğu top buraya konur. */
  handsCentre(out: THREE.Vector3): THREE.Vector3 {
    this.root.updateMatrixWorld();
    out.copy(this.limbs[0].hand.position).add(this.limbs[1].hand.position).multiplyScalar(0.5);
    return out.applyMatrix4(this.root.matrixWorld);
  }
}
