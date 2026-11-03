import { describe, expect, it } from "vitest";
import { BALL_X, BALL_Y } from "../logic";
import { ballAt, BALL_FAR, divePose, GOAL_BOTTOM, GOAL_H, GOAL_HALF, KEEPER_HIP, KEEPER_REACH, SPOT, toGoal, toScreen } from "./geometry";

describe("Penaltı geometrisi", () => {
  it("kale koordinatı ile dünya birbirine çevrilir; top yarıçapı mantıkla uyumlu", () => {
    const p = toScreen(-0.5, 0.75);
    expect(toGoal(p).x).toBeCloseTo(-0.5);
    expect(toGoal(p).y).toBeCloseTo(0.75);
    expect(BALL_FAR / GOAL_HALF).toBeCloseTo(BALL_X, 2);
    expect(BALL_FAR / GOAL_H).toBeCloseTo(BALL_Y, 2);
  });

  it("top penaltı noktasından çıkar, kale ağzında hedefe varır", () => {
    const target = toScreen(0.7, 0.8);
    expect(ballAt(target, 0).p).toEqual(SPOT);
    const end = ballAt(target, 1);
    expect(end.p.x).toBeCloseTo(target.x);
    expect(end.p.y).toBeCloseTo(target.y);
    expect(end.r).toBe(BALL_FAR);
    expect(end.ground.y).toBeCloseTo(GOAL_BOTTOM + 4);
  });

  it("kaleci yandaki topa eldivenleriyle uzanır; köşe topunda neredeyse yatay uçar", () => {
    for (const [x, y] of [
      [-0.8, 0.9],
      [0.75, 0.1],
      [0.1, 0.9],
      [0, 0.15],
    ]) {
      const target = toScreen(x, y);
      const { hip, angle } = divePose(target);
      const gloves = { x: hip.x + Math.sin(angle) * KEEPER_REACH, y: hip.y - Math.cos(angle) * KEEPER_REACH };
      if (Math.abs(target.x - KEEPER_HIP.x) >= 150) {
        expect(gloves.x).toBeCloseTo(target.x, 0);
        expect(gloves.y).toBeCloseTo(target.y, 0);
      }
    }
    expect(Math.abs(divePose(toScreen(0.8, 0.1)).angle)).toBeGreaterThan(1.3);
    expect(Math.abs(divePose(toScreen(0.8, 0.9)).angle)).toBeLessThan(1.3);
  });
});
