import { describe, expect, it } from "vitest";
import { duelAnswer, freshDuel, optionOrder } from "./duel";

describe("Düello sorusu", () => {
  it("ilk doğru cevaplayan kazanır, sonrası yok sayılır", () => {
    let { duel, result } = duelAnswer(freshDuel(), 1, 2, 2);
    expect(result).toBe("won");
    expect(duel.winner).toBe(1);
    ({ duel, result } = duelAnswer(duel, 0, 2, 2));
    expect(result).toBe("ignored");
    expect(duel.winner).toBe(1);
  });

  it("yanlış cevap veren bekler, öteki takım yine kazanabilir", () => {
    let { duel, result } = duelAnswer(freshDuel(), 0, 1, 3);
    expect(result).toBe("locked");
    expect(duel.locked).toEqual([true, false]);
    expect(duelAnswer(duel, 0, 3, 3).result).toBe("ignored");
    ({ duel, result } = duelAnswer(duel, 1, 3, 3));
    expect(result).toBe("won");
    expect(duel.winner).toBe(1);
  });

  it("iki takım da yanlışsa kimse kazanamaz", () => {
    let { duel } = duelAnswer(freshDuel(), 0, 0, 3);
    const second = duelAnswer(duel, 1, 1, 3);
    duel = second.duel;
    expect(second.result).toBe("both-wrong");
    expect(duel.winner).toBeNull();
    expect(duel.picked).toEqual([0, 1]);
  });

  it("iki takım aynı soruyu belirli ama farklı sırayla görür", () => {
    const a = optionOrder("dkab-7-1-01", 42, 0, 4);
    expect(optionOrder("dkab-7-1-01", 42, 0, 4)).toEqual(a);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    const differs = Array.from({ length: 30 }, (_, i) => optionOrder(`q-${i}`, 7, 0, 4).join() !== optionOrder(`q-${i}`, 7, 1, 4).join());
    expect(differs.filter(Boolean).length).toBeGreaterThan(20);
  });
});
