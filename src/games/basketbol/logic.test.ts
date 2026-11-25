import { describe, expect, it } from "vitest";
import type { PlayableQuestion } from "@/core/deck";
import { defaultTeams } from "../teams";
import type { Team } from "../types";
import {
  AIM_LOCK_MS,
  basketReducer,
  createBasket,
  meterAt,
  METER_LOCK_MS,
  METER_PERIOD,
  onFire,
  OVERTIME_MAX,
  shotResult,
  SWEET,
  ZONE_HALF,
  type BasketSettings,
  type BasketState,
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
const start = (over: Partial<BasketSettings> = {}) => reduce(createBasket(teams, { questions: 4, seconds: 20, ...over }), { type: "start", now: 0 });

/** Güç çubuğunun yükselirken `power` değerine geldiği an (mesafe seçiminden sonra geçen süre). */
const atPower = (power: number, range: Range) => METER_LOCK_MS + (power / 2) * METER_PERIOD[range];

/** Takımın soruyu bilip verilen güçte atış yapması. */
function attempt(s: BasketState, side: 0 | 1, range: Range, power: number, now = 0) {
  s = reduce(s, { type: "answer", side, option: right(s), now });
  s = reduce(s, { type: "range", range, now: now + AIM_LOCK_MS });
  return reduce(s, { type: "shoot", now: now + AIM_LOCK_MS + atPower(power, range) });
}
const next = (s: BasketState, now = 0) => reduce(s, { type: "next", now });

describe("Basketbol: güç çubuğu ve atış", () => {
  it("güç çubuğu beklemeden sonra 0'dan 1'e çıkar ve geri iner", () => {
    expect(meterAt(0, 2)).toBe(0);
    expect(meterAt(METER_LOCK_MS, 2)).toBe(0);
    expect(meterAt(METER_LOCK_MS + METER_PERIOD[2] / 2, 2)).toBeCloseTo(1, 6);
    expect(meterAt(METER_LOCK_MS + METER_PERIOD[2], 2)).toBeCloseTo(0, 6);
    expect(meterAt(atPower(SWEET, 3), 3)).toBeCloseTo(SWEET, 6);
  });

  it("yeşilin ortası tertemiz, kenarı çember, dışı kaçan atıştır", () => {
    const w = ZONE_HALF[2];
    expect(shotResult(SWEET, 2)).toBe("temiz");
    expect(shotResult(SWEET + w * 0.8, 2)).toBe("cember");
    expect(shotResult(SWEET - w * 0.8, 2)).toBe("cember");
    expect(shotResult(SWEET - w * 1.5, 2)).toBe("kacti-on");
    expect(shotResult(SWEET + w * 1.5, 2)).toBe("kacti-arka");
    expect(shotResult(0.2, 2)).toBe("kisa");
    expect(shotResult(1, 2)).toBe("panya");
  });

  it("üçlükte yeşil bölge daha dardır; ateşli el bölgeyi genişletir", () => {
    const p = SWEET + ZONE_HALF[2] * 0.9;
    expect(shotResult(p, 2)).toBe("cember");
    expect(shotResult(p, 3)).not.toBe("cember");
    expect(shotResult(p, 3, true)).toBe("cember");
    expect(METER_PERIOD[3]).toBeLessThan(METER_PERIOD[2]);
  });
});

describe("Basketbol: oyun akışı", () => {
  it("ilk bilen takım mesafeyi seçer ve atar; basket mesafe kadar sayıdır", () => {
    let s = attempt(start(), 0, 3, SWEET);
    expect(s.phase).toBe("result");
    expect(s.score).toEqual([3, 0]);
    expect(s.shots[0]).toMatchObject({ side: 0, range: 3, result: "temiz", points: 3 });
    s = attempt(next(s), 1, 2, SWEET - ZONE_HALF[2] * 0.8);
    expect(s.score).toEqual([3, 2]);
    expect(s.shots[1].result).toBe("cember");
  });

  it("kaçan atış sayı getirmez", () => {
    const s = attempt(start(), 1, 2, 0.1);
    expect(s.shots[0]).toMatchObject({ result: "kisa", points: 0 });
    expect(s.score).toEqual([0, 0]);
  });

  it("mesafe kilit süresi dolmadan, atış güç çubuğu başlamadan alınmaz", () => {
    let s = reduce(start(), { type: "answer", side: 0, option: right(start()), now: 0 });
    expect(reduce(s, { type: "range", range: 2, now: AIM_LOCK_MS - 1 }).range).toBeNull();
    s = reduce(s, { type: "range", range: 2, now: AIM_LOCK_MS });
    expect(reduce(s, { type: "shoot", now: AIM_LOCK_MS + 10 }).phase).toBe("aim");
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
    let s = attempt(start({ questions: 6 }), 0, 2, SWEET);
    expect(onFire(s.shots, 0)).toBe(false);
    s = attempt(next(s), 0, 2, SWEET);
    expect(onFire(s.shots, 0)).toBe(true);
    s = attempt(next(s), 0, 3, SWEET + ZONE_HALF[3] * 1.2);
    expect(s.shots[2]).toMatchObject({ onFire: true, result: "cember", points: 3 });
    s = attempt(next(s), 0, 2, 0.05);
    expect(onFire(s.shots, 0)).toBe(false);
  });

  it("fark kalan sorularla kapanamıyorsa oyun erken biter", () => {
    let s = start({ questions: 2 });
    s = attempt(s, 0, 3, SWEET);
    s = next(s);
    expect(s.phase).toBe("question");
    s = attempt(s, 0, 3, SWEET);
    // 6 sayı fark, soru kalmadı.
    expect(next(s).phase).toBe("finished");
    expect(next(s).winner).toBe(teams[0].id);
  });

  it("eşitlikte uzatmaya geçilir; ilk basket oyunu bitirir", () => {
    let s = start({ questions: 2 });
    s = attempt(s, 0, 2, SWEET);
    s = attempt(next(s), 1, 2, SWEET);
    s = next(s);
    expect(s.overtime).toBe(true);
    expect(s.phase).toBe("question");
    s = attempt(s, 1, 2, 0.05);
    expect(s.phase).toBe("result");
    s = attempt(next(s), 0, 3, SWEET);
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe(teams[0].id);
  });

  it("uzatmada da kimse atamazsa berabere biter", () => {
    let s = start({ questions: 1 });
    s = next(reduce(reduce(s, { type: "answer", side: 0, option: wrong(s), now: 0 }), { type: "answer", side: 1, option: wrong(s, 2), now: 0 }));
    expect(s.overtime).toBe(true);
    for (let i = 0; i < OVERTIME_MAX; i++) {
      expect(s.phase).toBe("question");
      s = next(attempt(s, i % 2 === 0 ? 0 : 1, 2, 0.05));
    }
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe("draw");
  });
});
