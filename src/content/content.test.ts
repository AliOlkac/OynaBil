import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cardSetSchema, questionsFromCards, type CardSet } from "@/core/cards";
import { questionSchema, type Question } from "@/core/model";
import { SUBJECTS } from "@/content";

/**
 * İçerik dosyalarını doğrudan diskten okur. İçerik ekleyen biri kendi dosyasını
 * `npx vitest run src/content -t "kartlar/6.json"` gibi bir süzgeçle hemen kontrol edebilir.
 */
const readJson = (path: string): unknown[] => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : []);

function checkQuestion(q: Question, label: string, unitIds: Set<string>, prefix: string) {
  expect(unitIds.has(q.unit), `${label}: bilinmeyen ünite ${q.unit}`).toBe(true);
  expect(q.unit.startsWith(prefix), `${label}: ${q.unit} bu sınıfa ait değil`).toBe(true);
  expect(q.id.startsWith(`${q.unit}-`), `${label}: id ünite ile başlamalı (${q.id})`).toBe(true);
  const texts = [q.prompt, q.explanation, ...(q.type === "true-false" ? [] : q.choices), ...(q.type === "passage" ? [q.context] : [])];
  for (const t of texts) expect(t.includes("{") || t.includes("}"), `${label}: doldurulmamış kalıp: ${t}`).toBe(false);
  if (q.type !== "true-false") {
    const normalized = q.choices.map((c) => c.trim().toLocaleLowerCase("tr"));
    expect(new Set(normalized).size, `${label}: aynı şık iki kez`).toBe(q.choices.length);
  }
}

for (const subject of SUBJECTS) {
  const unitIds = new Set(subject.units.map((u) => u.id));
  const base = join(__dirname, subject.id);

  for (const grade of subject.grades) {
    const prefix = `${subject.code}-${grade}-`;
    const seen = new Map<string, string>();
    const claim = (id: string, where: string) => {
      expect(seen.has(id), `tekrarlanan id ${id} (${seen.get(id)} ve ${where})`).toBe(false);
      seen.set(id, where);
    };

    describe(`${subject.name} sorular/${grade}.json`, () => {
      const raw = readJson(join(base, "sorular", `${grade}.json`));
      it("boş değil", () => expect(raw.length).toBeGreaterThan(0));
      raw.forEach((item, i) => {
        const label = `sorular/${grade}.json[${i}] ${(item as { id?: string }).id ?? ""}`;
        it(label, () => {
          const q = questionSchema.parse(item);
          checkQuestion(q, label, unitIds, prefix);
          claim(q.id, label);
        });
      });
    });

    describe(`${subject.name} kartlar/${grade}.json`, () => {
      const raw = readJson(join(base, "kartlar", `${grade}.json`));
      it("geçerli bir liste", () => expect(Array.isArray(raw)).toBe(true));
      raw.forEach((item, i) => {
        const label = `kartlar/${grade}.json[${i}] ${(item as { id?: string }).id ?? ""}`;
        it(label, () => {
          const parsed = cardSetSchema.safeParse(item);
          if (!parsed.success) throw new Error(`${label}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
          const set: CardSet = parsed.data;
          expect(unitIds.has(set.unit), `${label}: bilinmeyen ünite ${set.unit}`).toBe(true);
          expect(set.unit.startsWith(prefix), `${label}: ${set.unit} bu sınıfa ait değil`).toBe(true);
          expect(set.id.startsWith(`${set.unit}-`), `${label}: küme kimliği ünite ile başlamalı`).toBe(true);
          if (set.kind === "pairs") {
            const ids = set.items.map((x) => x.id);
            expect(new Set(ids).size, `${label}: aynı öğe kimliği iki kez`).toBe(ids.length);
          }
          const generated = questionsFromCards([set]);
          expect(generated.length, `${label}: hiç soru üretmedi`).toBeGreaterThan(0);
          // Aynı kök iki farklı cevapla çıkarsa soru belirsizdir (ilişki bire bir değildir).
          const prompts = generated.filter((q) => q.type !== "true-false" && set.kind === "pairs").map((q) => q.prompt);
          expect(new Set(prompts).size, `${label}: aynı soru kökü iki kez üretildi; eşleşme bire bir olmalı`).toBe(prompts.length);
          const statements = generated.filter((q) => q.type === "true-false").map((q) => q.prompt);
          expect(new Set(statements).size, `${label}: aynı ifade iki kez üretildi`).toBe(statements.length);
          for (const q of generated) {
            checkQuestion(q, `${label} -> ${q.id}`, unitIds, prefix);
            claim(q.id, label);
          }
        });
      });
    });

    describe(`${subject.name} sorular/${grade}-lgs.json`, () => {
      const raw = readJson(join(base, "sorular", `${grade}-lgs.json`));
      it("geçerli bir liste", () => expect(Array.isArray(raw)).toBe(true));
      raw.forEach((item, i) => {
        const label = `sorular/${grade}-lgs.json[${i}] ${(item as { id?: string }).id ?? ""}`;
        it(label, () => {
          const q = questionSchema.parse(item);
          expect(q.type, `${label}: LGS dosyasında yalnızca paragraf soruları olur`).toBe("passage");
          checkQuestion(q, label, unitIds, prefix);
          claim(q.id, label);
        });
      });
    });
  }
}
