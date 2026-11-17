import { describe, expect, it } from "vitest";
import { BANDS, zoneAt } from "../logic";
import { yOf } from "../scene/geometry";
import { collapseFall, COLLAPSE_SECONDS, HEAP_RADIUS, HEAP_SHIFT, knockCount, knockFall, pickBlocks, towerLayout } from "./debris";
import { ARM_COCKED, ARM_RELEASE, arcAt, armTip, bucketPoint, CATAPULT_X, flightAt, flightFor, H_APEX, H_BASE, H_BODY_TOP, H_ROOF_BASE, H_WINDOW_BOTTOM, H_WINDOW_TOP, heightOf, heightOfSvgY, R_BASE, radiusAt, rollAt, seededRandom, TOWER_X } from "./world";

const shot = (side: 0 | 1, hit: number) => ({ side, hit, zone: zoneAt(hit) });

describe("kule sahnesinin ölçüleri", () => {
  it("kulenin bölgeleri oyun mantığındaki sınırlarla aynıdır", () => {
    expect(heightOf(BANDS[0].to)).toBe(0);
    expect([H_BASE, H_WINDOW_BOTTOM, H_WINDOW_TOP, H_BODY_TOP, H_ROOF_BASE, H_APEX].map((h) => +h.toFixed(2))).toEqual([1.44, 3.12, 4.32, 6, 7.44, 8.88]);
    expect(radiusAt(0.5)).toBe(R_BASE);
    expect(radiusAt(H_APEX)).toBe(0);
  });

  it("çizim sahnesinin cetveli aynı yüksekliklere denk gelir", () => {
    for (const p of [0, 0.12, 0.43, 0.86, 1]) expect(heightOfSvgY(yOf(p))).toBeCloseTo(heightOf(p), 6);
  });

  it("kurulu kolda kepçe geride ve bel hizasındadır; taş kepçenin açık yüzünde durur", () => {
    const tip = armTip(ARM_COCKED);
    expect(tip.x).toBeLessThan(-2);
    expect(bucketPoint(ARM_COCKED).y).toBeGreaterThan(tip.y);
    expect(bucketPoint(ARM_RELEASE).x).toBeGreaterThan(armTip(ARM_RELEASE).x);
  });
});

describe("taşın uçuşu", () => {
  it("kepçeden çıkar, isabet yüksekliğinde kulenin yüzüne varır", () => {
    for (const side of [0, 1] as const) {
      const f = flightFor(shot(side, 0.43));
      expect(f.end).toBe("tower");
      expect(flightAt(f, 0)).toEqual(f.from);
      const end = flightAt(f, 1);
      expect(end.x).toBeCloseTo(f.to.x, 6);
      expect(end.y).toBeCloseTo(heightOf(0.43), 6);
      const tx = TOWER_X[1 - side];
      expect(Math.abs(end.x - tx)).toBeGreaterThan(radiusAt(end.y));
      expect(Math.abs(end.x - tx)).toBeLessThan(radiusAt(end.y) + 0.3);
      expect(Math.abs(f.from.x - CATAPULT_X[side])).toBeLessThan(1.5);
      // Yol bir yaydır: ortası iki ucundan yüksektir.
      expect(flightAt(f, 0.5).y).toBeGreaterThan(Math.max(f.from.y, f.to.y) + 3);
    }
  });

  it("kısa atış kulenin önüne, uzun atış külahın üstünden arkasına düşer", () => {
    const short = flightFor(shot(0, 0.02));
    expect(short.end).toBe("short");
    expect(short.to.x).toBeLessThan(TOWER_X[1] - R_BASE);
    const long = flightFor(shot(0, 0.95));
    expect(long.end).toBe("long");
    expect(long.to.x).toBeGreaterThan(TOWER_X[1] + R_BASE);
    for (let u = 0; u <= 1; u += 0.02) {
      const p = flightAt(long, u);
      // Külah koniktir: taş her noktada külahın o noktadaki yüksekliğinden en az yarım metre yukarıdadır.
      const off = Math.abs(p.x - TOWER_X[1]);
      if (off < 1.9) expect(p.y).toBeGreaterThan(H_APEX - off * 0.76 + 0.5);
    }
  });

  it("ıskalayan taş yuvarlanırken kulenin temeline girmez", () => {
    for (const hit of [0.119, 0.06, 0, -0.1]) {
      const f = flightFor(shot(0, hit));
      for (let t = 0; t < 4; t += 0.1) {
        const p = rollAt(f, 0, t);
        expect(p.x).toBeLessThan(TOWER_X[1] - R_BASE - 0.3);
        expect(p.y).toBeGreaterThan(0);
      }
    }
  });
});

describe("kulenin taşları", () => {
  const layout = towerLayout();

  it("taşlar kendi bölgelerinin yarıçapı içinde, zeminle külah arasında dizilir", () => {
    expect(layout.length).toBeGreaterThan(180);
    expect(layout.length).toBeLessThan(260);
    for (const b of layout) {
      expect(b.y - b.h / 2).toBeGreaterThanOrEqual(0);
      expect(b.y + b.h / 2).toBeLessThanOrEqual(H_ROOF_BASE + 1e-9);
      expect(Math.hypot(b.x, b.z) + b.d / 2).toBeCloseTo(radiusAt(b.y), 6);
    }
    expect(layout.filter((b) => b.part === "merlon")).toHaveLength(7);
    expect(layout.filter((b) => b.part === "cini")).toHaveLength(12);
  });

  it("isabet, çarptığı yere en yakın sağlam taşları düşürür; aynı tohum aynı taşları seçer", () => {
    const intact = layout.map(() => true);
    const impact = { x: 1.5, y: 3.7, z: 0 };
    const a = pickBlocks(layout, intact, impact, 8, seededRandom(5));
    const b = pickBlocks(layout, intact, impact, 8, seededRandom(5));
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(8);
    for (const i of a) expect(Math.hypot(layout[i].x - impact.x, layout[i].y - impact.y, layout[i].z)).toBeLessThan(1.6);
    for (const i of a) intact[i] = false;
    const next = pickBlocks(layout, intact, impact, 8, seededRandom(6));
    expect(next.some((i) => a.includes(i))).toBe(false);
  });

  it("hasar büyüdükçe daha çok taş düşer, ıska taş düşürmez", () => {
    expect(knockCount("govde", 0)).toBe(0);
    expect(knockCount("pencere", 35)).toBeGreaterThan(knockCount("govde", 18));
    expect(knockCount("kulah", 15)).toBeLessThan(knockCount("temel", 10) + 2);
    expect(knockCount("pencere", 200)).toBeLessThanOrEqual(22);
  });

  it("düşen taş kopana kadar yerinde durur, sonra duracağı yere iner", () => {
    const rnd = seededRandom(3);
    const b = layout[100];
    const fall = knockFall(b, 1, 10, rnd);
    const arc = { t0: fall.t0, T: fall.T, p0: { x: b.x, y: b.y, z: b.z }, rest: fall.rest };
    const p = { x: 0, y: 0, z: 0 };
    expect(arcAt(arc, 9.9, p)).toBe(0);
    expect(p).toEqual(arc.p0);
    const mid = arcAt(arc, fall.t0 + fall.T / 2, p);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(arcAt(arc, fall.t0 + fall.T + 3, p)).toBe(1);
    expect(p.x).toBeCloseTo(fall.rest.x, 6);
    expect(p.y).toBeCloseTo(fall.rest.y, 3);
    // Taş kulenin dibine, atışın geldiği tarafa düşer ve yere gömülmez.
    expect(fall.rest.x).toBeGreaterThan(R_BASE);
    expect(fall.rest.y).toBeGreaterThan(0.15);
  });

  it("yıkılış süresi içinde bütün taşlar yığına iner", () => {
    const rnd = seededRandom(11);
    for (const b of layout) {
      const fall = collapseFall(b, -1, 0, rnd);
      expect(fall.t0 + fall.T).toBeLessThan(COLLAPSE_SECONDS);
      expect(fall.rest.y).toBeGreaterThan(0.1);
      expect(fall.rest.y).toBeLessThan(3.2);
      expect(Math.hypot(fall.rest.x + HEAP_SHIFT + b.y * 0.2, fall.rest.z)).toBeLessThan(HEAP_RADIUS);
    }
  });
});
