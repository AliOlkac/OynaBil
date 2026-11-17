import * as THREE from "three";
import { canvasTexture, seeded, tokenColor, tokenCss, type TierSettings } from "../../shared/stage3d/kit";
import { rockGeometry } from "./catapult";
import { CATAPULT_X, TOWER_X } from "./world";

/**
 * Kule Yıkmaca'nın manzarası: gün batımı göğü, ufukta güneş, sıra sıra tepeler, serviler, bulutlar
 * ve iki kulenin arasındaki çayır. Bulutlar rüzgârla kayar; rüzgâr oyunun bilgisidir.
 */

const CLOUD_SPAN = 150;

function skyTexture() {
  return canvasTexture(
    16,
    512,
    (ctx, w, h) => {
      // Küre dokusu: üst yarı gök, alt yarı ufkun altı.
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, tokenCss("var(--color-ink-950)"));
      g.addColorStop(0.3, tokenCss("var(--color-ink-900)"));
      g.addColorStop(0.42, tokenCss("var(--color-ink-700)"));
      g.addColorStop(0.475, tokenCss("var(--color-ufuk)"));
      g.addColorStop(0.5, tokenCss("var(--color-ufuk-acik)"));
      g.addColorStop(0.52, tokenCss("var(--color-ufuk)"));
      g.addColorStop(1, tokenCss("var(--color-ufuk)"));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { mipmaps: false },
  );
}

function groundTexture() {
  const rnd = seeded(9);
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = tokenCss("var(--color-saha)");
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = rnd() < 0.55 ? tokenCss("var(--color-saha-acik)") : tokenCss("var(--color-servi)");
        ctx.globalAlpha = 0.25 + rnd() * 0.4;
        const x = rnd() * w;
        const y = rnd() * h;
        ctx.fillRect(x, y, 2 + rnd() * 3, 5 + rnd() * 9);
      }
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = tokenCss("var(--color-camur)");
        ctx.globalAlpha = 0.12 + rnd() * 0.16;
        ctx.beginPath();
        ctx.ellipse(rnd() * w, rnd() * h, 14 + rnd() * 34, 8 + rnd() * 18, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    { repeat: [26, 26], anisotropy: 8 },
  );
}

/** Kulelerin ve mancınıkların çevresindeki çiğnenmiş toprak. */
function dirtTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.55, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function buildLandscape(settings: TierSettings) {
  const group = new THREE.Group();
  const rnd = seeded(123);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  group.add(sky);

  // ---- tepeler: uzaklaştıkça ufkun rengine yaklaşır ----
  const horizon = tokenColor("var(--color-ufuk)");
  const layers: { z: number; height: number; tone: number; seed: number }[] = [
    { z: -230, height: 34, tone: 0.62, seed: 3 },
    { z: -150, height: 22, tone: 0.4, seed: 8 },
    { z: -85, height: 11, tone: 0.2, seed: 14 },
  ];
  for (const layer of layers) {
    const r = seeded(layer.seed);
    const phase = [r() * 6, r() * 6, r() * 6];
    const shape = new THREE.Shape();
    const half = 420;
    shape.moveTo(-half, -4);
    for (let x = -half; x <= half; x += 12) {
      const k = x / half;
      const y = layer.height * (0.45 + 0.3 * Math.sin(k * 5 + phase[0]) + 0.17 * Math.sin(k * 13 + phase[1]) + 0.08 * Math.sin(k * 31 + phase[2]));
      shape.lineTo(x, Math.max(1, y));
    }
    shape.lineTo(half, -4);
    const hill = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-servi)").lerp(horizon, layer.tone), fog: false }));
    hill.position.z = layer.z;
    group.add(hill);
  }

  // ---- güneş: ufkun hemen üstünde, iki kulenin arasında ----
  const sunTex = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.16, "rgba(255,255,255,0.95)");
    g.addColorStop(0.2, "rgba(255,255,255,0.4)");
    g.addColorStop(0.55, "rgba(255,255,255,0.1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: tokenColor("var(--color-ufuk-acik)"), fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  sun.scale.setScalar(150);
  sun.position.set(-28, 30, -300);
  sun.renderOrder = -9;
  group.add(sun);

  // ---- zemin ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 520), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -150;
  ground.receiveShadow = true;
  group.add(ground);
  const dirtMat = new THREE.MeshStandardMaterial({ map: dirtTexture(), color: tokenColor("var(--color-camur)").lerp(tokenColor("var(--color-toz)"), 0.25), transparent: true, roughness: 1, depthWrite: false });
  const dirt = (x: number, z: number, sx: number, sz: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), dirtMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.015, z);
    m.scale.set(sx, sz, 1);
    m.receiveShadow = true;
    m.renderOrder = 1;
    group.add(m);
  };
  for (const side of [0, 1] as const) {
    dirt(TOWER_X[side], 0, 13, 11);
    dirt(CATAPULT_X[side], 0.3, 12, 8);
  }
  dirt(0, 1, 30, 5);

  // ---- serviler ve kayalar ----
  const trunk = new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-ahsap-koyu)") });
  const leaves = new THREE.MeshLambertMaterial({ color: tokenColor("var(--color-servi)") });
  const trees = new THREE.Group();
  const treeSpots: [number, number, number][] = [
    [-30, -13, 1.2], [-25.5, -19, 0.95], [-11, -17, 1.1], [-5, -26, 1.3], [4, -15, 0.9], [9.5, -23, 1.15], [24, -14, 1.05], [29.5, -21, 1.25], [34, -11, 0.9],
    [-37, -9, 1.1], [-17, -31, 1.3], [17, -33, 1.2], [-1, -40, 1.4], [40, -27, 1.3], [-44, -25, 1.25],
  ];
  for (const [x, z, s] of treeSpots) {
    const t = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 6), trunk);
    stem.position.y = 0.55;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.95, 6.2, 8), leaves);
    crown.position.y = 4;
    crown.castShadow = true;
    const crown2 = new THREE.Mesh(new THREE.SphereGeometry(0.98, 8, 6), leaves);
    crown2.position.y = 1.5;
    crown2.scale.y = 1.3;
    t.add(stem, crown, crown2);
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    trees.add(t);
  }
  group.add(trees);
  const rocks = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: tokenColor("var(--color-tas-koyu)"), roughness: 1 });
  for (let i = 0; i < 22; i++) {
    const rock = new THREE.Mesh(rockGeometry(0.25 + rnd() * 0.5, 200 + i), rockMat);
    const x = (rnd() - 0.5) * 70;
    // Kayalar oyun alanının arkasına ve önüne dağılır; kulelerle mancınıkların arası boş kalır.
    const z = rnd() < 0.7 ? -5 - rnd() * 16 : 4.5 + rnd() * 4;
    rock.position.set(x, 0.12, z);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.scale.y = 0.7;
    rock.castShadow = true;
    rock.receiveShadow = true;
    rocks.add(rock);
  }
  group.add(rocks);

  // ---- bulutlar ----
  const cloudMat = new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-ufuk-acik)").lerp(tokenColor("var(--color-cream)"), 0.35), fog: false, transparent: true, opacity: 0.9 });
  const cloudShade = new THREE.MeshBasicMaterial({ color: tokenColor("var(--color-ufuk)").lerp(tokenColor("var(--color-ink-700)"), 0.35), fog: false, transparent: true, opacity: 0.9 });
  const blob = new THREE.SphereGeometry(1, 10, 8);
  const clouds = Array.from({ length: 7 }, (_, i) => {
    const c = new THREE.Group();
    const parts = 4 + Math.floor(rnd() * 3);
    for (let k = 0; k < parts; k++) {
      const m = new THREE.Mesh(blob, k % 3 === 2 ? cloudShade : cloudMat);
      const s = 3.5 + rnd() * 3.5;
      m.scale.set(s * 1.5, s * 0.62, s);
      m.position.set((k - parts / 2) * 4.6 + rnd() * 2, (k % 3 === 2 ? -1.2 : 0) + rnd() * 1.6, rnd() * 3);
      c.add(m);
    }
    c.position.set(-CLOUD_SPAN + ((i + rnd() * 0.6) / 7) * CLOUD_SPAN * 2, 30 + rnd() * 24, -120 - rnd() * 70);
    c.scale.setScalar(0.9 + rnd() * 0.7);
    group.add(c);
    return c;
  });

  const setDetail = (s: TierSettings) => {
    rocks.visible = s.extras;
    clouds.forEach((c, i) => (c.visible = s.extras || i % 2 === 0));
    trees.children.forEach((t, i) => (t.visible = s.extras || i < 9));
  };
  setDetail(settings);

  return {
    group,
    setDetail,
    /** Bulutlar rüzgârın yönüne ve şiddetine göre kayar; hareket azaltılmışsa durur. */
    update(dt: number, wind: number, quiet: boolean) {
      if (quiet) return;
      const sign = wind === 0 ? 1 : Math.sign(wind);
      const speed = (0.5 + Math.abs(wind) * 1.4) * sign;
      for (const c of clouds) {
        c.position.x += speed * dt;
        if (c.position.x > CLOUD_SPAN) c.position.x -= CLOUD_SPAN * 2;
        else if (c.position.x < -CLOUD_SPAN) c.position.x += CLOUD_SPAN * 2;
      }
    },
  };
}
