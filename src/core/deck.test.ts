import { describe, expect, it } from "vitest";
import { buildDeckIds, deckFromIds, toPlayable } from "./deck";
import type { Question } from "./model";

const q = (id: string, unit: string, extra: Partial<Question> = {}): Question =>
  ({
    id,
    unit,
    type: "multiple-choice",
    difficulty: 1,
    prompt: `Soru ${id}`,
    choices: ["A", "B", "C", "D"],
    answer: 0,
    explanation: "Açıklama",
    ...extra,
  }) as Question;

const pool: Question[] = [
  q("dkab-8-1-01", "dkab-8-1"),
  q("dkab-8-1-02", "dkab-8-1", { difficulty: 3 }),
  q("dkab-8-1-03", "dkab-8-1", { group: "g1" }),
  q("dkab-8-1-04", "dkab-8-1", { group: "g1" }),
  q("dkab-8-2-01", "dkab-8-2"),
  q("dkab-8-2-02", "dkab-8-2"),
  q("dkab-8-2-03", "dkab-8-2", { type: "true-false", answer: true } as Partial<Question>),
];

describe("Deste", () => {
  it("üniteleri harmanlar, seçilmeyen ünite ve tipi almaz", () => {
    const ids = buildDeckIds(pool, { unitIds: ["dkab-8-1", "dkab-8-2"], types: ["multiple-choice"], seed: 1 });
    expect(ids).not.toContain("dkab-8-2-03");
    expect(ids).toHaveLength(6);
    // İlk iki soru farklı ünitelerden gelir.
    expect(ids[0].slice(0, 8)).not.toBe(ids[1].slice(0, 8));
  });

  it("aynı gruptan ikinci soru destenin sonuna kalır", () => {
    const ids = buildDeckIds(pool, { unitIds: ["dkab-8-1"], types: ["multiple-choice"], seed: 7 });
    const positions = ["dkab-8-1-03", "dkab-8-1-04"].map((id) => ids.indexOf(id)).sort((a, b) => a - b);
    expect(positions[1]).toBe(ids.length - 1);
  });

  it("daha önce sorulanlar en eskisinden başlayarak sona dizilir", () => {
    const seen = { "dkab-8-1-01": 200, "dkab-8-1-02": 100 };
    const noGroups = pool.filter((x) => !x.group);
    const ids = buildDeckIds(noGroups, { unitIds: ["dkab-8-1"], types: ["multiple-choice"], seed: 3, seen });
    expect(ids.slice(-2)).toEqual(["dkab-8-1-02", "dkab-8-1-01"]);
  });

  it("şık sırası soruya ve tohuma bağlıdır, yeniden kurulunca aynıdır", () => {
    const a = toPlayable(pool[0], 42);
    const b = toPlayable(pool[0], 42);
    expect(a.options).toEqual(b.options);
    expect(a.options[a.correctIndex]).toBe("A");
    const deck = deckFromIds(pool, ["dkab-8-2-02", "silinmis-soru", "dkab-8-1-01"], 42);
    expect(deck.map((d) => d.id)).toEqual(["dkab-8-2-02", "dkab-8-1-01"]);
  });
});
