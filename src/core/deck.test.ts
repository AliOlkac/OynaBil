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

describe("Deste: tekrar etmeyen açılış", () => {
  const big: Question[] = Array.from({ length: 30 }, (_, i) =>
    q(`tr-5-1-${String(i + 1).padStart(2, "0")}`, "tr-5-1", { difficulty: ((i % 3) + 1) as Question["difficulty"] }),
  );
  const opts = { unitIds: ["tr-5-1"], types: ["multiple-choice"] as const };

  it("her oyun farklı sorularla açılır, ama kabaca kolaydan zora ilerler", () => {
    const openings = new Set(Array.from({ length: 12 }, (_, seed) => buildDeckIds(big, { ...opts, seed: seed + 1 }).slice(0, 5).join(",")));
    expect(openings.size).toBeGreaterThan(8);
    const diff = (id: string) => big.find((x) => x.id === id)!.difficulty;
    const ids = buildDeckIds(big, { ...opts, seed: 7 });
    const avg = (xs: string[]) => xs.reduce((n, id) => n + diff(id), 0) / xs.length;
    expect(avg(ids.slice(0, 10))).toBeLessThan(avg(ids.slice(20)));
  });

  it("sorulmuş sorular sona kalır; en eski sorulan önce döner", () => {
    const seen = { [big[0].id]: 300, [big[1].id]: 100, [big[2].id]: 200 };
    const ids = buildDeckIds(big, { ...opts, seed: 3, seen });
    expect(ids.slice(-3)).toEqual([big[1].id, big[2].id, big[0].id]);
  });
});
