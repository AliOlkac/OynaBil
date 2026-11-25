import { describe, expect, it } from "vitest";
import type { Range, ShotResult } from "./logic";
import { ballAt, BALL_R, BOARD_Z, LAND, planShot, RELEASE, RIM_R, RIM_Y, shooterAt, spotFor, THREE_POINT } from "./timeline";

const RESULTS: ShotResult[] = ["temiz", "cember", "kacti-on", "kacti-arka", "kisa", "panya"];
const sample = (plan: ReturnType<typeof planShot>, step = 0.01) => {
  const out: { t: number; x: number; y: number; z: number }[] = [];
  for (let t = RELEASE; t <= plan.end + 0.2; t += step) out.push({ t, ...ballAt(plan, t)! });
  return out;
};

describe("Basketbol: atışın zaman çizelgesi", () => {
  it("üçlük noktaları çizginin dışında, yakın atışlar içindedir", () => {
    for (let i = 0; i < 6; i++) {
      expect(Math.hypot(spotFor(3, i).x, spotFor(3, i).z)).toBeGreaterThan(THREE_POINT);
      expect(Math.hypot(spotFor(2, i).x, spotFor(2, i).z)).toBeLessThan(THREE_POINT);
    }
  });

  for (const range of [2, 3] as Range[]) {
    for (const result of RESULTS) {
      it(`${range} sayılık "${result}": top elden çıkar, sonuca uygun yere gider ve yerde durur`, () => {
        const plan = planShot({ range, result }, 3);
        expect(ballAt(plan, RELEASE - 0.01)).toBeNull();
        const path = sample(plan);
        // Yol kesintisizdir: iki örnek arasında top ışınlanmaz.
        for (let i = 1; i < path.length; i++) {
          const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y, path[i].z - path[i - 1].z);
          expect(d).toBeLessThan(0.35);
        }
        // Top yerin altına inmez, panyanın arkasına geçmez.
        for (const p of path) {
          expect(p.y).toBeGreaterThan(BALL_R - 1e-6);
          expect(p.z).toBeGreaterThan(BOARD_Z);
        }
        const last = path[path.length - 1];
        expect(last.y).toBeCloseTo(BALL_R, 2);
        // Basket olan top çemberin içinden geçer; kaçan top geçmez.
        const through = path.some((p, i) => i > 0 && path[i - 1].y >= RIM_Y && p.y < RIM_Y && Math.hypot(p.x, p.z) < RIM_R - BALL_R * 0.3);
        expect(through).toBe(result === "temiz" || result === "cember");
        expect(plan.made).toBe(result === "temiz" || result === "cember");
        if (plan.made) expect(plan.madeAt).toBeGreaterThan(RELEASE);
      });
    }
  }

  it("tertemiz basket çembere ve panyaya değmez; çemberden giren en az bir kez çembere vurur", () => {
    const clean = planShot({ range: 2, result: "temiz" }, 0);
    expect(clean.events.some((e) => e.kind === "rim" || e.kind === "board")).toBe(false);
    const rim = planShot({ range: 2, result: "cember" }, 0);
    expect(rim.events.filter((e) => e.kind === "rim").length).toBeGreaterThan(0);
    expect(planShot({ range: 3, result: "panya" }, 1).events.some((e) => e.kind === "board")).toBe(true);
  });

  it("aynı atış her seferinde aynı oynar", () => {
    expect(planShot({ range: 3, result: "cember" }, 4)).toEqual(planShot({ range: 3, result: "cember" }, 4));
  });

  it("şutçu çömelir, sıçrar, topu en yüksekte bırakır ve iner", () => {
    expect(shooterAt(0.15).crouch).toBeGreaterThan(0.5);
    expect(shooterAt(RELEASE).lift).toBeGreaterThan(0.25);
    expect(shooterAt(RELEASE).arms).toBeCloseTo(1, 5);
    expect(shooterAt(LAND + 0.01).lift).toBe(0);
  });
});
