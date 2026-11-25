import { describe, expect, it } from "vitest";
import { applyMatch, botSkill, GUARD_MATCHES, rankName, SAFE_BELOW, startRank, TOP_STEP, type Rank } from "./league";
import { addStats, recordMatch, weakUnits, type Profile } from "./profile";

describe("Mobil lig", () => {
  it("basamak adları Bronz III'ten Usta'ya gider", () => {
    expect(rankName(0)).toBe("Bronz III");
    expect(rankName(2)).toBe("Bronz I");
    expect(rankName(7)).toBe("Altın II");
    expect(rankName(14)).toBe("Elmas I");
    expect(rankName(TOP_STEP)).toBe("Usta");
  });

  it("galibiyet puan kazandırır, 100'de basamak atlanır ve koruma başlar", () => {
    let r: Rank = startRank();
    let promoted = false;
    for (let i = 0; i < 6 && !promoted; i++) {
      const c = applyMatch(r, "win", false);
      expect(c.delta > 0 || c.promoted).toBe(true);
      r = c.rank;
      promoted = c.promoted;
    }
    expect(promoted).toBe(true);
    expect(r.step).toBe(1);
    expect(r.guard).toBe(GUARD_MATCHES);
    // Koruma sürerken yenilgi puan götürmez.
    const loss = applyMatch(r, "loss", false);
    expect(loss.guarded).toBe(true);
    expect(loss.rank.lp).toBe(r.lp);
    expect(loss.rank.guard).toBe(GUARD_MATCHES - 1);
  });

  it("Bronz ve Gümüş'te lig düşmez; üstünde düşer", () => {
    const low = applyMatch({ step: 3, lp: 4, mmr: 1000, guard: 0 }, "loss", false);
    expect(low.rank).toMatchObject({ step: 3, lp: 0 });
    expect(low.demoted).toBe(false);
    const high = applyMatch({ step: SAFE_BELOW + 1, lp: 4, mmr: 1400, guard: 0 }, "loss", false);
    expect(high.demoted).toBe(true);
    expect(high.rank).toMatchObject({ step: SAFE_BELOW, lp: 70 });
  });

  it("kalkan yenilgideki kaybı yarıya indirir", () => {
    const r: Rank = { step: 4, lp: 60, mmr: 1180, guard: 0 };
    const plain = applyMatch(r, "loss", false);
    const shielded = applyMatch(r, "loss", true);
    expect(shielded.shieldUsed).toBe(true);
    expect(Math.abs(shielded.delta)).toBeLessThan(Math.abs(plain.delta));
    expect(applyMatch(r, "win", true).shieldUsed).toBe(false);
  });

  it("gizli puanı yüksek oyuncu daha hızlı yükselir, rakibi de güçlenir", () => {
    const strong = applyMatch({ step: 2, lp: 10, mmr: 1300, guard: 0 }, "win", false).delta;
    const weak = applyMatch({ step: 2, lp: 10, mmr: 900, guard: 0 }, "win", false).delta;
    expect(strong).toBeGreaterThan(weak);
    expect(botSkill(1500)).toBeGreaterThan(botSkill(1000));
    expect(botSkill(100)).toBeGreaterThan(0);
    expect(botSkill(9999)).toBeLessThan(1);
  });
});

const base: Profile = { ready: true, name: "A", grade: 7, color: "kobalt", subject: "karisik", game: "sirayla", rank: startRank(), shields: 1, history: [], stats: {}, questDay: null, active: null };
const match = (sessionId: string, winner: 0 | 1 | "draw") => ({
  sessionId,
  gameId: "basketbol",
  subjectId: "matematik",
  opponent: "B",
  winner,
  score: [4, 2] as [number, number],
  log: [
    { questionId: "q1", unit: "mat-7-1", teamId: "sen", correct: true },
    { questionId: "q2", unit: "mat-7-1", teamId: "sen", correct: false },
    { questionId: "q2", unit: "mat-7-1", teamId: "rakip", correct: true },
  ],
});

describe("Mobil oyuncu kaydı", () => {
  it("maç bir kez işlenir; yalnızca oyuncunun cevapları istatistiğe girer", () => {
    const r = recordMatch(base, match("s1", 0), 1_000)!;
    expect(r.profile.history).toHaveLength(1);
    expect(r.profile.stats["mat-7-1"]).toEqual({ right: 1, total: 2 });
    expect(r.profile.rank.lp).toBeGreaterThan(0);
    expect(recordMatch(r.profile, match("s1", 0), 2_000)).toBeNull();
  });

  it("yenilgide kalkan harcanır; günde üç maç bir kalkan kazandırır", () => {
    let p = { ...base, rank: { step: 2, lp: 50, mmr: 1000, guard: 0 } };
    const a = recordMatch(p, match("s1", 1), 1_000)!;
    expect(a.outcome.shieldUsed).toBe(true);
    expect(a.profile.shields).toBe(0);
    p = recordMatch(a.profile, match("s2", 0), 2_000)!.profile;
    const c = recordMatch(p, match("s3", 0), 3_000)!;
    expect(c.outcome.questDone).toBe(true);
    expect(c.profile.shields).toBe(1);
    expect(recordMatch(c.profile, match("s4", 0), 4_000)!.outcome.questDone).toBe(false);
  });

  it("zayıf üniteler başarı oranına göre sıralanır", () => {
    const stats = addStats({}, [
      { unit: "a", correct: false },
      { unit: "a", correct: false },
      { unit: "b", correct: true },
      { unit: "b", correct: false },
      { unit: "c", correct: true },
      { unit: "c", correct: true },
      { unit: "d", correct: false },
    ]);
    expect(weakUnits(stats).map((w) => w.unit)).toEqual(["a", "b"]);
  });
});
