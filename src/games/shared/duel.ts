import { hashSeed } from "@/core/cards";
import { createRng, shuffle } from "@/core/random";

/**
 * Düello sorusu: iki takıma aynı soru sorulur, ilk doğru cevaplayan takım hakkı kazanır.
 * Yanlış cevap veren takım kilitlenir ve bekler; öteki takım hâlâ cevaplayabilir.
 * İki takım da yanlış cevap verirse kimse hak kazanamaz.
 *
 * Saf yardımcılar: Kule Yıkmaca ve Penaltı reducer'ları bunları kullanır.
 */

export type DuelSide = 0 | 1;

export type Duel = {
  /** Yanlış cevap verip bekleyen takımlar. */
  locked: [boolean, boolean];
  /** Takımların seçtiği şık (sorunun özgün sırasıyla). */
  picked: [number | null, number | null];
  /** İlk doğru cevaplayan takım. */
  winner: DuelSide | null;
};

export type DuelResult = "won" | "locked" | "both-wrong" | "ignored";

export const freshDuel = (): Duel => ({ locked: [false, false], picked: [null, null], winner: null });

/** Bir takımın cevabını işler. Kilitli takımın ya da karar verilmiş sorunun cevabı yok sayılır. */
export function duelAnswer(duel: Duel, side: DuelSide, option: number, correctIndex: number): { duel: Duel; result: DuelResult } {
  if (duel.winner !== null || duel.locked[side] || duel.locked.every(Boolean)) return { duel, result: "ignored" };
  const picked = [...duel.picked] as Duel["picked"];
  picked[side] = option;
  if (option === correctIndex) return { duel: { ...duel, picked, winner: side }, result: "won" };
  const locked = [...duel.locked] as Duel["locked"];
  locked[side] = true;
  return { duel: { ...duel, picked, locked }, result: locked.every(Boolean) ? "both-wrong" : "locked" };
}

/**
 * Takımın gördüğü şık sırası (görünen sıra -> özgün şık). İki takım aynı soruyu farklı sırayla görür;
 * yan yana duran öğrenciler birbirinin dokunduğu yerden cevabı çıkaramaz. Sıra soru ve oyundan türetilir.
 */
export function optionOrder(questionId: string, seed: number, side: DuelSide, count: number): number[] {
  const rng = createRng(hashSeed(`${questionId}:${side}`) ^ seed);
  return shuffle(
    Array.from({ length: count }, (_, i) => i),
    rng,
  );
}
