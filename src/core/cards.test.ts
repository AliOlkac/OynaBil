import { describe, expect, it } from "vitest";
import { fill, questionsFromCards, type CardSet } from "./cards";

const kitaplar: CardSet = {
  kind: "pairs",
  id: "dkab-6-1-kitaplar",
  unit: "dkab-6-1",
  difficulty: 1,
  questions: [
    { prompt: "{kitap} hangi peygambere indirilmiştir?", answer: "peygamber" },
    { prompt: "{peygambereYonelme} indirilen kitap hangisidir?", answer: "kitap" },
  ],
  statement: { text: "{kitap}, {peygambereYonelme} indirilmiştir.", swap: "peygambereYonelme" },
  explanation: "{kitap}, {peygambereYonelme} indirilmiştir.",
  items: [
    { id: "tevrat", kitap: "Tevrat", peygamber: "Hz. Musa", peygambereYonelme: "Hz. Musa'ya" },
    { id: "zebur", kitap: "Zebur", peygamber: "Hz. Davud", peygambereYonelme: "Hz. Davud'a" },
    { id: "incil", kitap: "İncil", peygamber: "Hz. İsa", peygambereYonelme: "Hz. İsa'ya" },
    { id: "kuran", kitap: "Kur'an-ı Kerim", peygamber: "Hz. Muhammed", peygambereYonelme: "Hz. Muhammed'e", not: "Son ilahi kitaptır." },
  ],
};

const farzlar: CardSet = {
  kind: "list",
  id: "dkab-5-2-namazin-farzlari",
  unit: "dkab-5-2",
  difficulty: 2,
  positive: "Aşağıdakilerden hangisi namazın farzlarından biridir?",
  negative: "Aşağıdakilerden hangisi namazın farzlarından biri değildir?",
  statement: "{item}, namazın farzlarındandır.",
  explanation: "Namazın farzlarından bazıları: {members}.",
  members: ["Rükû", "Secde", "Kıyam"],
  nonMembers: ["Ezan okumak", "Tesbih çekmek", "Cemaatle kılmak"],
};

describe("Bilgi kartlarından soru üretimi", () => {
  it("eşleşme kümesi: her öğe için iki yönlü soru ile doğru ve yanlış ifade üretir", () => {
    const qs = questionsFromCards([kitaplar]);
    expect(qs).toHaveLength(4 * 4);
    const tevrat = qs.filter((q) => q.group === "dkab-6-1-kitaplar-tevrat");
    expect(tevrat.map((q) => q.id)).toEqual([
      "dkab-6-1-kitaplar-tevrat-s1",
      "dkab-6-1-kitaplar-tevrat-s2",
      "dkab-6-1-kitaplar-tevrat-d",
      "dkab-6-1-kitaplar-tevrat-y",
    ]);
    const forward = tevrat[0];
    expect(forward.type).toBe("multiple-choice");
    if (forward.type === "multiple-choice") {
      expect(forward.prompt).toBe("Tevrat hangi peygambere indirilmiştir?");
      expect(forward.choices[forward.answer]).toBe("Hz. Musa");
      expect(forward.choices).toHaveLength(4);
      expect(new Set(forward.choices).size).toBe(4);
    }
    const falseOne = tevrat[3];
    expect(falseOne.type === "true-false" && falseOne.answer).toBe(false);
    expect(falseOne.prompt).toBe("Tevrat, Hz. Davud'a indirilmiştir.");
    const kuran = qs.find((q) => q.id === "dkab-6-1-kitaplar-kuran-s1")!;
    expect(kuran.explanation).toBe("Kur'an-ı Kerim, Hz. Muhammed'e indirilmiştir. Son ilahi kitaptır.");
  });

  it("aynı kart her seferinde aynı soruları ve şıkları üretir", () => {
    expect(questionsFromCards([kitaplar])).toEqual(questionsFromCards([kitaplar]));
  });

  it("liste kümesi: biridir / değildir soruları ve ifadeler", () => {
    const qs = questionsFromCards([farzlar]);
    // 3 üye x (soru + doğru ifade) + 3 dışarıdaki x (soru + yanlış ifade)
    expect(qs).toHaveLength(12);
    const negative = qs.find((q) => q.id === "dkab-5-2-namazin-farzlari-x1-n")!;
    expect(negative.type === "multiple-choice" && negative.choices[negative.answer]).toBe("Ezan okumak");
    if (negative.type === "multiple-choice") expect(negative.choices.slice(1).every((c) => farzlar.kind === "list" && farzlar.members.includes(c))).toBe(true);
    const statement = qs.find((q) => q.id === "dkab-5-2-namazin-farzlari-x2-y")!;
    expect(statement.prompt).toBe("Tesbih çekmek, namazın farzlarındandır.");
    expect(statement.explanation).toBe("Namazın farzlarından bazıları: Rükû, Secde, Kıyam.");
  });

  it("kalıpta olmayan alan yazım hatası sayılır", () => {
    expect(() => fill("{kitap} {yok}", { kitap: "Tevrat" })).toThrow(/yok/);
  });
});
