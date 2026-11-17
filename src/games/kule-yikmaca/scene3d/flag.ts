import * as THREE from "three";

/**
 * Direğin tepesine bağlı bayrak. Rüzgâr oyunun bilgisidir: bayrak rüzgârın yönüne döner,
 * şiddeti arttıkça yataya yaklaşır ve daha hızlı dalgalanır; rüzgâr yokken direkten aşağı sarkar.
 */
export class Flag {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  private readonly segments: number;

  constructor(
    private readonly length: number,
    private readonly height: number,
    color: THREE.Color,
    private readonly phase = 0,
    segments = 8,
  ) {
    this.segments = segments;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, height, segments, 1), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.update(0, 0, true);
  }

  /** `wind`: -3..3, artı değer +x yönüne eser. `quiet`: hareket azaltılmışsa bayrak dalgalanmaz. */
  update(time: number, wind: number, quiet: boolean) {
    const sign = wind === 0 ? 1 : Math.sign(wind);
    const strength = Math.abs(wind);
    const droop = 1.25 - strength * 0.36;
    const amp = 0.05 + strength * 0.045;
    const omega = quiet ? 0 : 5 + strength * 3;
    const dx = Math.cos(droop) * sign;
    const dy = -Math.sin(droop);
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const n = this.segments + 1;
    for (let j = 0; j < n; j++) {
      const s = j / this.segments;
      const wave = Math.sin(s * 5 - time * omega + this.phase) * amp * s;
      const x = dx * this.length * s;
      const y = dy * this.length * s + wave * 0.5;
      pos.setXYZ(j, x, y, wave);
      pos.setXYZ(n + j, x, y - this.height * (1 - s * 0.25), wave);
    }
    pos.needsUpdate = true;
  }
}
