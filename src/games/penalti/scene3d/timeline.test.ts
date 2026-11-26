import { describe, expect, it } from "vitest";
import { BALL_X, BALL_Y, kickResult, thirdOf, type Kick, type Third } from "../logic";
import { ballAt, CONTACT, divePose, flightPoint, keeperAt, kickerStrike, kickTarget, LIVE_END, netBulgeAt, planKick, REPLAY, REPLAY_SECONDS, replayTau, STRIKE, type BallState } from "./timeline";
import { BALL_R, GOAL_H, GOAL_HALF, KEEPER_REACH, NET_DEPTH_BOTTOM, SPOT } from "./world";

const kick = (x: number, y: number, keeper: Third): Kick => ({ side: 0, x, y, third: thirdOf(x), keeper, result: kickResult(x, y, keeper), at: 0, questionId: "q" });
const fresh = (): BallState => ({ p: { x: 0, y: 0, z: 0 }, q: [0, 0, 0, 1], visible: true, held: false, phase: "spot" });
const at = (plan: ReturnType<typeof planKick>, tau: number) => ballAt(plan, tau, fresh());

describe("topun uçuşu", () => {
  it("penaltı noktasından başlar, hedefte biter", () => {
    const target = kickTarget(0.7, 0.8);
    expect(flightPoint(target, 0)).toEqual(SPOT);
    const end = flightPoint(target, 1);
    expect(end.x).toBeCloseTo(target.x, 5);
    expect(end.y).toBeCloseTo(target.y, 5);
    expect(end.z).toBeCloseTo(0, 5);
  });

  it("hep kaleye doğru ilerler ve yerin altına inmez", () => {
    const target = kickTarget(-0.9, 0.05);
    let lastZ = SPOT.z;
    for (let u = 0.05; u <= 1; u += 0.05) {
      const p = flightPoint(target, u);
      expect(p.z).toBeLessThan(lastZ);
      expect(p.y).toBeGreaterThanOrEqual(BALL_R - 1e-9);
      lastZ = p.z;
    }
  });

  it("vuruştan önce noktada durur, temas anında hedeftedir", () => {
    const plan = planKick(kick(0.5, 0.5, "sol"), 0);
    expect(at(plan, STRIKE - 0.01).p).toEqual(SPOT);
    const contact = at(plan, CONTACT).p;
    expect(contact.x).toBeCloseTo(plan.target.x, 3);
    expect(contact.z).toBeCloseTo(0, 3);
  });
});

describe("temastan sonrası", () => {
  it("gol olan top ağda kalır, kale çizgisinden geri çıkmaz", () => {
    for (const x of [-0.85, -0.5, 0, 0.5, 0.85]) {
      for (const y of [0.05, 0.5, 0.8]) {
        const keeper: Third = thirdOf(x) === "sol" ? "sag" : "sol";
        const plan = planKick(kick(x, y, keeper), 0);
        expect(plan.kick.result).toBe("gol");
        expect(plan.net, `ağ esnemedi (${x}, ${y})`).not.toBeNull();
        expect(plan.net!.push).toBeGreaterThan(0.05);
        // Ağ topu en fazla bir metre kadar esnetir.
        expect(plan.net!.push).toBeLessThan(1);
        for (const tau of [CONTACT + 0.3, CONTACT + 1, CONTACT + 3]) {
          const p = at(plan, tau).p;
          expect(p.z, `top sahaya döndü (${x}, ${y}, ${tau})`).toBeLessThan(0);
          expect(p.z).toBeGreaterThan(-NET_DEPTH_BOTTOM - 1);
          expect(Math.abs(p.x)).toBeLessThan(GOAL_HALF + 0.6);
          expect(p.y).toBeLessThan(GOAL_H + 0.6);
        }
        // Sonunda yerde durur.
        expect(at(plan, CONTACT + 3.5).p.y).toBeCloseTo(BALL_R, 1);
      }
    }
  });

  it("ağın esnemesi top bıraktıktan sonra söner", () => {
    const plan = planKick(kick(0.6, 0.6, "sol"), 0);
    expect(netBulgeAt(plan, CONTACT - 0.1)).toBeNull();
    const peak = netBulgeAt(plan, plan.net!.at)!;
    expect(peak.amount).toBeGreaterThan(0.05);
    const late = netBulgeAt(plan, plan.net!.at + 2.5);
    expect(late === null || Math.abs(late.amount) < 0.02).toBe(true);
  });

  it("köşedeki kurtarışta top eldivenden sahaya döner", () => {
    const plan = planKick(kick(0.7, 0.7, "sag"), 0);
    expect(plan.kick.result).toBe("kurtardi");
    expect(plan.held).toBe(false);
    const p = at(plan, CONTACT + 1).p;
    expect(p.z).toBeGreaterThan(0.5);
    expect(p.x).toBeGreaterThan(plan.target.x);
  });

  it("ortadaki kurtarışta top kalecide kalır", () => {
    const plan = planKick(kick(0.05, 0.5, "orta"), 0);
    expect(plan.held).toBe(true);
    expect(at(plan, CONTACT + 0.5).held).toBe(true);
    expect(keeperAt(plan, CONTACT + 0.5).holding).toBe(true);
  });

  it("direkten dönen top kaleye girmez", () => {
    for (const [x, y] of [
      [0.98, 0.5],
      [-0.98, 0.2],
      [0.3, 0.97],
      [1.03, 0.4],
    ]) {
      const plan = planKick(kick(x, y, "orta"), 0);
      expect(plan.kick.result).toBe("direk");
      for (const tau of [CONTACT + 0.2, CONTACT + 0.8, CONTACT + 2]) {
        const p = at(plan, tau).p;
        const inGoal = p.z < -0.3 && Math.abs(p.x) < GOAL_HALF - BALL_R && p.y < GOAL_H - BALL_R;
        expect(inGoal, `direkten dönen top ağda (${x}, ${y}, ${tau})`).toBe(false);
      }
    }
  });

  it("direkten giren top direğe değip ağa gider", () => {
    for (const [x, y] of [
      [1 - BALL_X, 0.5],
      [-(1 - BALL_X), 0.3],
      [0.4, 1 - BALL_Y],
    ]) {
      const plan = planKick({ ...kick(x, y, "orta"), result: "gol", post: true }, 0);
      const p = at(plan, CONTACT + 1.2).p;
      expect(p.z, `direkten giren top ağda değil (${x}, ${y})`).toBeLessThan(-0.3);
      expect(Math.abs(p.x)).toBeLessThan(GOAL_HALF);
    }
  });

  it("auta giden top kaleye girmez; tribüne giderse gözden kaybolur", () => {
    const wide = planKick(kick(1.4, 0.4, "orta"), 0);
    expect(wide.kick.result).toBe("aut");
    const p = at(wide, CONTACT + 0.5).p;
    expect(Math.abs(p.x)).toBeGreaterThan(GOAL_HALF);
    const high = planKick(kick(0.1, 1.8, "orta"), 0);
    expect(at(high, CONTACT + 3).visible).toBe(false);
  });

  it("aynı şut her zaman aynı yolu izler (tekrar gösterimi için)", () => {
    const a = planKick(kick(-0.6, 0.3, "sag"), 2);
    const b = planKick(kick(-0.6, 0.3, "sag"), 2);
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
    expect(at(a, 1.7).p).toEqual(at(b, 1.7).p);
  });
});

describe("kaleci", () => {
  it("kurtarışta eldivenleri topun olduğu yere ulaşır", () => {
    for (const [x, y] of [
      [0.75, 0.6],
      [-0.75, 0.1],
      [0.5, 0.5],
      [0.02, 0.8],
      [-0.1, 0.1],
    ]) {
      const plan = planKick(kick(x, y, thirdOf(x)), 0);
      expect(plan.kick.result).toBe("kurtardi");
      const pose = keeperAt(plan, CONTACT);
      const hands = pose.hands!;
      const cx = (hands[0].x + hands[1].x) / 2;
      const cy = (hands[0].y + hands[1].y) / 2;
      expect(Math.hypot(cx - plan.target.x, cy - plan.target.y), `eldivenler topta değil (${x}, ${y})`).toBeLessThan(0.05);
      // Kalça, eldivenlerin uzanabileceği mesafededir (ortadaki alçak topta kollar aşağı uzanır).
      const reach = Math.hypot(plan.target.x - pose.hip.x, plan.target.y - pose.hip.y);
      expect(reach).toBeLessThan(KEEPER_REACH + 0.75);
      expect(pose.hip.y).toBeGreaterThan(0.25);
    }
  });

  it("ortaya gelen topa atlamaz, köşeye gelen topa uçar", () => {
    expect(divePose({ x: 0.3, y: 1.2 }).centre).toBe(true);
    const dive = divePose({ x: 2.6, y: 1.8 });
    expect(dive.centre).toBe(false);
    expect(dive.angle).toBeGreaterThan(0.6);
    expect(divePose({ x: -2.6, y: 0.3 }).angle).toBeLessThan(-1.2);
  });

  it("gol olan şutta öbür köşeye uçar ve yere düşer", () => {
    const plan = planKick(kick(0.7, 0.5, "sol"), 0);
    expect(keeperAt(plan, CONTACT).hip.x).toBeLessThan(-0.5);
    const landed = keeperAt(plan, CONTACT + 1);
    expect(landed.landed).toBe(true);
    expect(landed.hip.y).toBeLessThan(0.4);
    expect(landed.mouth).toBe("shock");
  });
});

describe("şutçu ve tekrar", () => {
  it("vuruş anında ayağı topun arkasındadır", () => {
    const scale = 0.92;
    const m = kickerStrike(STRIKE, kickTarget(0.5, 0.5), scale);
    // Gövde koordinatındaki ayağı dünyaya çevir.
    const cos = Math.cos(m.yaw);
    const sin = Math.sin(m.yaw);
    const wx = m.x + m.footL.x * cos + m.footL.z * sin;
    const wz = m.z - m.footL.x * sin + m.footL.z * cos;
    expect(Math.hypot(wx - SPOT.x, wz - SPOT.z)).toBeLessThan(0.3);
    expect(m.footL.y).toBeLessThan(0.3);
  });

  it("tekrar, topun yolda olduğu andan durulmasına kadar ağır çekimde oynar", () => {
    expect(REPLAY.from).toBeGreaterThan(STRIKE);
    expect(REPLAY.from).toBeLessThan(CONTACT);
    expect(replayTau(0)).toBe(REPLAY.from);
    expect(replayTau(REPLAY_SECONDS)).toBeCloseTo(REPLAY.to, 5);
    expect(replayTau(REPLAY_SECONDS + 5)).toBe(REPLAY.to);
    expect(LIVE_END).toBeGreaterThan(CONTACT + 1);
  });
});
