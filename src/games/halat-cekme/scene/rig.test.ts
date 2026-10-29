import { describe, expect, it } from "vitest";
import { FOREARM, reach, solve, UPPER_ARM } from "./rig";

describe("Halat çeken iskelet", () => {
  it("asılınca omuzlar ayakların gerisine yatar, eller ip yüksekliğinde kalır", () => {
    const standing = solve({ lean: 0.05, ropeY: -80, armsUp: 0, step: 0 });
    const pulling = solve({ lean: 0.55, ropeY: -80, armsUp: 0, step: 0 });
    expect(pulling.shoulder.x).toBeLessThan(standing.shoulder.x - 20);
    expect(pulling.handNear.y).toBeCloseTo(-80, 0);
    expect(pulling.handFar.y).toBeCloseTo(-80, 0);
    // Eller ipte ileride, ön el arka elin önünde.
    expect(pulling.handNear.x).toBeGreaterThan(pulling.handFar.x);
    expect(pulling.handNear.x).toBeGreaterThan(pulling.shoulder.x);
  });

  it("kol boyu aşılmaz, dirsek omuz-el çizgisinin altına kırılır", () => {
    const shoulder = { x: 0, y: 0 };
    const { elbow, hand } = reach(shoulder, { x: 200, y: 0 });
    expect(Math.hypot(hand.x, hand.y)).toBeLessThanOrEqual(UPPER_ARM + FOREARM);
    const bent = reach(shoulder, { x: 40, y: 0 });
    expect(bent.elbow.y).toBeGreaterThan(0);
    expect(Math.hypot(bent.elbow.x, bent.elbow.y)).toBeCloseTo(UPPER_ARM, 5);
    expect(elbow.y).toBeGreaterThanOrEqual(0);
  });

  it("sevinçte eller başın üstüne kalkar", () => {
    const cheer = solve({ lean: 0, ropeY: null, armsUp: 1, step: 0 });
    expect(cheer.handNear.y).toBeLessThan(cheer.shoulder.y - 30);
  });
});
