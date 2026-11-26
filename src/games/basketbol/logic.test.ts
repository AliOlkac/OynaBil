import { describe, expect, it } from "vitest";
import type { PlayableQuestion } from "@/core/deck";
import { defaultTeams } from "../teams";
import type { Team } from "../types";
import {
  AIM_LOCK_MS,
  ANGLE,
  basketReducer,
  ballHeight,
  createBasket,
  DIST,
  HOOP_H,
  METER_LOCK_MS,
  MIN_PULL,
  onFire,
  OVERTIME_MAX,
  powerFor,
  RELEASE_H,
  rimPass,
  shotResult,
  windowScale,
  WINDOW,
  type BasketSettings,
  type BasketState,
  type Launch,
  type Range,
} from "./logic";

const deck: PlayableQuestion[] = Array.from({ length: 30 }, (_, i) => ({
  id: `dkab-8-1-${String(i + 1).padStart(2, "0")}`,
  unit: "dkab-8-1",
  type: "multiple-choice",
  difficulty: 2,
  prompt: `Soru ${i + 1}`,
  options: ["A", "B", "C", "D"],
  correctIndex: i % 4,
  explanation: "Açıklama",
}));

const teams = defaultTeams(2) as [Team, Team];
const reduce = basketReducer(deck);
const right = (s: BasketState) => deck[s.current].correctIndex;
const wrong = (s: BasketState, k = 1) => (deck[s.current].correctIndex + k) % 4;
const start = (over: Partial<BasketSettings> = {}) => reduce(createBasket(teams, { questions: 4, seconds: 20, difficulty: 1, ...over }), { type: "start", now: 0 });

const ANG = (52 * Math.PI) / 180;
/** Topu çemberin ortasından `miss` metre öteye (eksi: kısa) indiren çekiş. */
const aimed = (miss: number, range: Range, angle = ANG): Launch => ({ angle, power: powerFor(angle, range, miss) });
/** Atışın isabet penceresinin ölçeği (zorluk, ateşli el ve iniş açısıyla). */
const scale = (range: Range, fire = false, d: 1 | 2 | 3 = 1) => windowScale(rimPass(aimed(0, range), range)!.entry, fire, d);
/** Pencerelerin ortası: tertemiz, çember, kaçan, uzak. */
const mid = { temiz: 0, cember: (WINDOW.temiz + WINDOW.cember) / 2, kacti: (WINDOW.cember + WINDOW.kacti) / 2, uzak: WINDOW.kacti * 1.6 };
/** Mesafe seçiminden sonra atışın alındığı an. */
const AFTER = METER_LOCK_MS + 800;

/** Takımın soruyu bilip verilen çekişle atış yapması; sayı verilirse topu o kadar öteye indirir. */
function attempt(s: BasketState, side: 0 | 1, range: Range, shot: Launch | number, now = 0) {
  s = reduce(s, { type: "answer", side, option: right(s), now });
  s = reduce(s, { type: "range", range, now: now + AIM_LOCK_MS });
  return reduce(s, { type: "shoot", launch: typeof shot === "number" ? aimed(shot, range) : shot, now: now + AIM_LOCK_MS + AFTER });
}
const next = (s: BasketState, now = 0) => reduce(s, { type: "next", now });
const weak = (): Launch => ({ angle: ANG, power: MIN_PULL });

describe("Basketbol: çekilen atışın fiziği", () => {
  it("top şutçunun başının üstünden çıkar, yay çizip çember yüksekliğine iner", () => {
    const l = aimed(0, 2);
    expect(ballHeight(l, 2, 0)).toBeCloseTo(RELEASE_H, 6);
    expect(ballHeight(l, 2, 0.5)).toBeGreaterThan(HOOP_H);
    expect(ballHeight(l, 2, 1)).toBeCloseTo(HOOP_H, 3);
    expect(rimPass(l, 2)!.miss).toBeCloseTo(0, 3);
  });

  it("güç arttıkça top daha uzağa iner; üçlük daha çok güç ister", () => {
    expect(rimPass({ angle: ANG, power: 0.5 }, 2)!.miss).toBeLessThan(rimPass({ angle: ANG, power: 0.6 }, 2)!.miss);
    expect(powerFor(ANG, 3)).toBeGreaterThan(powerFor(ANG, 2));
    expect(DIST[3]).toBeGreaterThan(DIST[2]);
    // Çok zayıf çekilen top çember yüksekliğine bile çıkmaz.
    expect(rimPass({ angle: ANGLE.min, power: 0 }, 3)).toBeNull();
  });

  it("çemberin ortası tertemiz, kenarı çember, biraz dışı kaçan, çok kısası hava, çok uzunu panya", () => {
    const k = scale(2);
    expect(shotResult(aimed(0, 2), 2).result).toBe("temiz");
    expect(shotResult(aimed(mid.cember * k, 2), 2).result).toBe("cember");
    expect(shotResult(aimed(-mid.cember * k, 2), 2).result).toBe("cember");
    expect(shotResult(aimed(-mid.kacti * k, 2), 2).result).toBe("kacti-on");
    expect(shotResult(aimed(mid.kacti * k, 2), 2).result).toBe("kacti-arka");
    expect(shotResult(aimed(-mid.uzak * k, 2), 2).result).toBe("kisa");
    expect(shotResult(aimed(mid.uzak * k, 2), 2).result).toBe("panya");
    expect(shotResult(weak(), 2).result).toBe("kisa");
  });

  it("dik inen top daha kolay girer; ateşli el pencereyi genişletir", () => {
    const flat = rimPass(aimed(0, 2, (32 * Math.PI) / 180), 2)!.entry;
    const steep = rimPass(aimed(0, 2, (62 * Math.PI) / 180), 2)!.entry;
    expect(windowScale(steep, false)).toBeGreaterThan(windowScale(flat, false));
    const miss = (WINDOW.cember + 0.02) * scale(2);
    expect(shotResult(aimed(miss, 2), 2).result).not.toBe("cember");
    expect(shotResult(aimed(miss, 2), 2, true).result).toBe("cember");
  });

  it("açı ve güç sınırlara çekilir", () => {
    const s = reduce(reduce(reduce(start(), { type: "answer", side: 0, option: right(start()), now: 0 }), { type: "range", range: 2, now: AIM_LOCK_MS }), {
      type: "shoot",
      launch: { angle: 3, power: 4 },
      now: AIM_LOCK_MS + AFTER,
    });
    expect(s.shots[0].launch).toEqual({ angle: ANGLE.max, power: 1 });
  });
});

describe("Basketbol: oyun akışı", () => {
  it("ilk bilen takım mesafeyi seçer ve atar; basket mesafe kadar sayıdır", () => {
    let s = attempt(start(), 0, 3, 0);
    expect(s.phase).toBe("result");
    expect(s.score).toEqual([3, 0]);
    expect(s.shots[0]).toMatchObject({ side: 0, range: 3, result: "temiz", points: 3 });
    s = attempt(next(s), 1, 2, -mid.cember * scale(2));
    expect(s.score).toEqual([3, 2]);
    expect(s.shots[1].result).toBe("cember");
  });

  it("kaçan atış sayı getirmez", () => {
    const s = attempt(start(), 1, 2, weak());
    expect(s.shots[0]).toMatchObject({ result: "kisa", points: 0 });
    expect(s.score).toEqual([0, 0]);
  });

  it("mesafe kilit süresi dolmadan, atış şutçu yerine geçmeden ve top yeterince çekilmeden alınmaz", () => {
    let s = reduce(start(), { type: "answer", side: 0, option: right(start()), now: 0 });
    expect(reduce(s, { type: "range", range: 2, now: AIM_LOCK_MS - 1 }).range).toBeNull();
    s = reduce(s, { type: "range", range: 2, now: AIM_LOCK_MS });
    expect(reduce(s, { type: "shoot", launch: aimed(0, 2), now: AIM_LOCK_MS + 10 }).phase).toBe("aim");
    expect(reduce(s, { type: "shoot", launch: { angle: ANG, power: MIN_PULL / 2 }, now: AIM_LOCK_MS + AFTER }).phase).toBe("aim");
    expect(reduce(s, { type: "shoot", launch: aimed(0, 2), now: AIM_LOCK_MS + AFTER }).phase).toBe("result");
    // Mesafe bir kez seçilir.
    expect(reduce(s, { type: "range", range: 3, now: AIM_LOCK_MS + 900 }).range).toBe(2);
  });

  it("yanlış cevap veren takım bekler; iki takım da bilemezse atış yoktur", () => {
    let s = start();
    s = reduce(s, { type: "answer", side: 0, option: wrong(s), now: 1 });
    expect(s.phase).toBe("question");
    s = reduce(s, { type: "answer", side: 1, option: wrong(s, 2), now: 2 });
    expect(s.phase).toBe("reveal");
    expect(s.shots).toHaveLength(0);
  });

  it("üst üste iki basket atan takımın eli ateş alır", () => {
    let s = attempt(start({ questions: 6 }), 0, 2, 0);
    expect(onFire(s.shots, 0)).toBe(false);
    s = attempt(next(s), 0, 2, 0);
    expect(onFire(s.shots, 0)).toBe(true);
    s = attempt(next(s), 0, 3, (WINDOW.cember + 0.02) * scale(3));
    expect(s.shots[2]).toMatchObject({ onFire: true, result: "cember", points: 3 });
    s = attempt(next(s), 0, 2, weak());
    expect(onFire(s.shots, 0)).toBe(false);
  });

  it("fark kalan sorularla kapanamıyorsa oyun erken biter", () => {
    let s = start({ questions: 2 });
    s = attempt(s, 0, 3, 0);
    s = next(s);
    expect(s.phase).toBe("question");
    s = attempt(s, 0, 3, 0);
    // 6 sayı fark, soru kalmadı.
    expect(next(s).phase).toBe("finished");
    expect(next(s).winner).toBe(teams[0].id);
  });

  it("eşitlikte uzatmaya geçilir; ilk basket oyunu bitirir", () => {
    let s = start({ questions: 2 });
    s = attempt(s, 0, 2, 0);
    s = attempt(next(s), 1, 2, 0);
    s = next(s);
    expect(s.overtime).toBe(true);
    expect(s.phase).toBe("question");
    s = attempt(s, 1, 2, weak());
    expect(s.phase).toBe("result");
    s = attempt(next(s), 0, 3, 0);
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe(teams[0].id);
  });

  it("uzatmada da kimse atamazsa berabere biter", () => {
    let s = start({ questions: 1 });
    s = next(reduce(reduce(s, { type: "answer", side: 0, option: wrong(s), now: 0 }), { type: "answer", side: 1, option: wrong(s, 2), now: 0 }));
    expect(s.overtime).toBe(true);
    for (let i = 0; i < OVERTIME_MAX; i++) {
      expect(s.phase).toBe("question");
      s = next(attempt(s, i % 2 === 0 ? 0 : 1, 2, weak()));
    }
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe("draw");
  });
});

describe("Basketbol: zorluk", () => {
  it("normal ve zorda isabet penceresi daralır", () => {
    expect(scale(2, false, 2)).toBeLessThan(scale(2, false, 1));
    expect(scale(2, false, 3)).toBeLessThan(scale(2, false, 2));
    // Kolayda çemberden giren atış zorda kaçar.
    const miss = mid.cember * scale(2, false, 1) * 1.15;
    expect(shotResult(aimed(miss, 2), 2, false, 1).result).toBe("cember");
    expect(shotResult(aimed(miss, 2), 2, false, 3).result).not.toBe("cember");
  });
});
