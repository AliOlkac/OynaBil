import { describe, expect, it } from "vitest";
import { BANDS, zoneAt } from "../logic";
import {
  CATAPULT_X,
  flightAt,
  flightFor,
  GROUND,
  halfWidthAt,
  TOWER_X,
  Y_APEX,
  Y_BASE_TOP,
  Y_WINDOW_BOTTOM,
  Y_WINDOW_TOP,
  yOf,
} from "./geometry";

describe("Kule geometrisi", () => {
  it("kule bölgeleri mantıktaki sınırlarla çakışır", () => {
    expect(yOf(BANDS[0].to)).toBe(GROUND);
    expect(Y_BASE_TOP).toBeLessThan(GROUND);
    expect(Y_WINDOW_TOP).toBeLessThan(Y_WINDOW_BOTTOM);
    expect(zoneAt(0.43)).toBe("pencere");
    const y = yOf(0.43);
    expect(y).toBeLessThan(Y_WINDOW_BOTTOM);
    expect(y).toBeGreaterThan(Y_WINDOW_TOP);
    expect(halfWidthAt(Y_APEX - 1)).toBe(0);
  });

  it("kuleye isabet eden taş kulenin yüzüne, nişan yüksekliğine çarpar", () => {
    const f = flightFor({ side: 0, hit: 0.43, zone: "pencere" });
    expect(f.end).toBe("tower");
    expect(f.to.y).toBeCloseTo(yOf(0.43));
    expect(f.to.x).toBeLessThan(TOWER_X[1]);
    expect(flightAt(f, 0).x).toBeCloseTo(f.from.x);
    expect(flightAt(f, 1).y).toBeCloseTo(f.to.y);
  });

  it("taş yolda karşı mancınığın üstünden geçer", () => {
    for (const hit of [0.15, 0.3, 0.6, 0.8]) {
      const f = flightFor({ side: 0, hit, zone: zoneAt(hit) });
      const u = (CATAPULT_X[1] - f.from.x) / (f.to.x - f.from.x);
      expect(flightAt(f, u).y).toBeLessThan(GROUND - 260);
    }
  });

  it("üstünden geçen taş çatının üstünden aşar, kısa kalan kulenin önüne düşer", () => {
    const over = flightFor({ side: 1, hit: 0.95, zone: "uzun" });
    expect(over.end).toBe("long");
    const u = (TOWER_X[0] - over.from.x) / (over.to.x - over.from.x);
    expect(flightAt(over, u).y).toBeLessThan(Y_APEX - 40);
    expect(over.to.x).toBeLessThan(TOWER_X[0]);

    const short = flightFor({ side: 1, hit: 0.05, zone: "kisa" });
    expect(short.end).toBe("short");
    expect(short.to.x).toBeGreaterThan(TOWER_X[0]);
    expect(short.to.y).toBeGreaterThan(GROUND);
  });
});
