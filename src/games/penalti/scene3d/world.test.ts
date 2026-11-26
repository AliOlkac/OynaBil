import { describe, expect, it } from "vitest";
import { BALL_X, BALL_Y, classify, POST_BAND } from "../logic";
import { BALL_R, GOAL_H, GOAL_HALF, goalToWorld, guessPoint, hitsBar, NET_DEPTH_BOTTOM, NET_DEPTH_TOP, netDepthAt, POST_R, standHeightAt, STAND_BASE_Y, STAND_Z, worldToGoal } from "./world";

describe("penaltı sahnesinin ölçüleri", () => {
  it("kale gerçek ölçüsündedir ve mantıktaki gibi 3'e 1'dir", () => {
    expect((GOAL_HALF * 2) / GOAL_H).toBeCloseTo(3, 5);
    expect(GOAL_HALF * 2).toBeCloseTo(7.32, 2);
  });

  it("kale koordinatı ile dünya arasında gidiş dönüş tutar", () => {
    const w = goalToWorld(-0.5, 0.25);
    expect(w).toEqual({ x: -GOAL_HALF / 2, y: GOAL_H / 4, z: 0 });
    expect(worldToGoal(w.x, w.y)).toEqual({ x: -0.5, y: 0.25 });
  });

  it("topun yarıçapı mantıktaki direk payıyla aynıdır: direğe değen top direğe değer", () => {
    expect(BALL_R).toBeCloseTo(BALL_X * GOAL_HALF, 6);
    expect(BALL_R).toBeCloseTo(BALL_Y * GOAL_H, 2);
    // İçeride sayılan en dıştaki topun kenarı direğin iç yüzüne ancak değer.
    const edge = (1 - BALL_X) * GOAL_HALF + BALL_R;
    expect(edge).toBeLessThanOrEqual(GOAL_HALF + 1e-9);
    // Direğe yakın bantta top direğe çarpar (mantıktaki risk payı); bandın içi kalededir.
    expect(classify(1 - BALL_X - POST_BAND, 0.5)).toBe("ic");
    expect(classify(1 - BALL_X, 0.5)).toBe("direk");
    expect(classify(1, 0.5)).toBe("direk");
    expect(POST_R).toBeLessThan(BALL_R);
  });

  it("üst direğe çarpan top yan direğe çarpandan ayrılır", () => {
    expect(hitsBar(0.3, 0.97)).toBe(true);
    expect(hitsBar(0.99, 0.5)).toBe(false);
    expect(hitsBar(0.3, 0.5)).toBe(false);
  });

  it("ağ altta derin, üstte sığdır", () => {
    expect(netDepthAt(0)).toBe(NET_DEPTH_BOTTOM);
    expect(netDepthAt(GOAL_H)).toBeCloseTo(NET_DEPTH_TOP, 6);
    expect(netDepthAt(-1)).toBe(NET_DEPTH_BOTTOM);
    expect(netDepthAt(GOAL_H / 2)).toBeGreaterThan(NET_DEPTH_TOP);
    expect(netDepthAt(GOAL_H / 2)).toBeLessThan(NET_DEPTH_BOTTOM);
  });

  it("tribün kaleden uzaklaştıkça yükselir", () => {
    expect(standHeightAt(STAND_Z)).toBe(STAND_BASE_Y);
    expect(standHeightAt(STAND_Z + 5)).toBe(STAND_BASE_Y);
    expect(standHeightAt(STAND_Z - 10)).toBeGreaterThan(STAND_BASE_Y + 4);
  });

  it("kaleci tahmininde kendi üçlüsüne gider", () => {
    expect(guessPoint("sol", 0.5).x).toBeLessThan(-GOAL_HALF / 3);
    expect(guessPoint("sag", 0.5).x).toBeGreaterThan(GOAL_HALF / 3);
    expect(guessPoint("orta", 0.5).x).toBe(0);
    expect(guessPoint("orta", 0.5).y).toBeCloseTo(GOAL_H / 2, 6);
  });
});
