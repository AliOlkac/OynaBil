import * as THREE from "three";

/**
 * Sahnelerin ortak parçacıkları: toz bulutu (kameraya dönük, büyüyüp sönen lekeler) ve kırıntı
 * (yerçekimiyle düşüp seken küçük parçalar). İkisi de sabit sayıda öğeyle çalışır; yeni parçacık
 * en eskisinin yerini alır, böylece bellek ve çizim yükü oyun boyunca değişmez.
 */

export type Puff = { x: number; y: number; z: number; vx?: number; vy?: number; vz?: number; size: number; grow?: number; life: number; color: THREE.Color; alpha?: number };

export class DustPool {
  readonly group = new THREE.Group();
  private readonly sprites: THREE.Sprite[] = [];
  private readonly state: { vx: number; vy: number; vz: number; grow: number; life: number; max: number; alpha: number }[] = [];
  private next = 0;

  constructor(count: number, texture: THREE.Texture) {
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.visible = false;
      this.sprites.push(sprite);
      this.state.push({ vx: 0, vy: 0, vz: 0, grow: 0, life: 0, max: 0, alpha: 0 });
      this.group.add(sprite);
    }
  }

  emit(p: Puff) {
    if (!this.sprites.length) return;
    const i = this.next++ % this.sprites.length;
    const sprite = this.sprites[i];
    sprite.position.set(p.x, p.y, p.z);
    sprite.scale.setScalar(p.size);
    sprite.material.color.copy(p.color);
    sprite.visible = true;
    Object.assign(this.state[i], { vx: p.vx ?? 0, vy: p.vy ?? 0, vz: p.vz ?? 0, grow: p.grow ?? 0, life: 0, max: p.life, alpha: p.alpha ?? 0.6 });
  }

  update(dt: number) {
    for (let i = 0; i < this.sprites.length; i++) {
      const sprite = this.sprites[i];
      if (!sprite.visible) continue;
      const s = this.state[i];
      s.life += dt;
      if (s.life >= s.max) {
        sprite.visible = false;
        continue;
      }
      const drag = Math.exp(-dt * 1.5);
      s.vx *= drag;
      s.vy *= drag;
      s.vz *= drag;
      sprite.position.x += s.vx * dt;
      sprite.position.y += s.vy * dt;
      sprite.position.z += s.vz * dt;
      sprite.scale.setScalar(Math.max(0.01, sprite.scale.x + s.grow * dt));
      sprite.material.opacity = s.alpha * (1 - s.life / s.max);
    }
  }
}

export type Chip = { x: number; y: number; z: number; vx: number; vy: number; vz: number; size: number; life: number; color: THREE.Color };

export class ChipPool {
  readonly mesh: THREE.InstancedMesh;
  private readonly p: Float32Array;
  private readonly v: Float32Array;
  private readonly spin: Float32Array;
  private readonly meta: Float32Array;
  private next = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor(private readonly count: number, private readonly gravity = 14) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.7, 0.8), new THREE.MeshLambertMaterial(), count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    this.spin = new Float32Array(count * 3);
    // boyut, yaş, ömür
    this.meta = new Float32Array(count * 3);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < count; i++) {
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, white);
    }
  }

  emit(c: Chip) {
    const i = this.next++ % this.count;
    this.p.set([c.x, c.y, c.z], i * 3);
    this.v.set([c.vx, c.vy, c.vz], i * 3);
    this.spin.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14], i * 3);
    this.meta.set([c.size, 0, c.life], i * 3);
    this.mesh.setColorAt(i, c.color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    const { p, v, meta } = this;
    for (let i = 0; i < this.count; i++) {
      const life = meta[i * 3 + 2];
      if (life === 0) continue;
      const age = (meta[i * 3 + 1] += dt);
      if (age >= life) {
        meta[i * 3 + 2] = 0;
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      v[i * 3 + 1] -= this.gravity * dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      const size = meta[i * 3];
      let spinning = 1;
      if (p[i * 3 + 1] < size / 2) {
        p[i * 3 + 1] = size / 2;
        v[i * 3 + 1] *= -0.3;
        v[i * 3] *= 0.55;
        v[i * 3 + 2] *= 0.55;
        if (Math.abs(v[i * 3 + 1]) < 0.5) spinning = 0;
      }
      this.e.set(this.spin[i * 3] * age * spinning, this.spin[i * 3 + 1] * age * spinning, this.spin[i * 3 + 2] * age * spinning);
      const fade = Math.min(1, (life - age) * 3);
      this.m.compose(this.pos.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), this.q.setFromEuler(this.e), this.scale.setScalar(size * fade));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
