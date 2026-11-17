import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cardSetSchema, questionsFromCards, type CardSet } from "@/core/cards";
import { questionSchema, type Question, type Subject } from "@/core/model";
import { SUBJECTS } from "@/content";

/**
 * Dersler klasörlerden bulunur: `src/content/<ders>/subject.ts` bir `Subject` dışa aktarır.
 * Böylece yeni bir ders, kayda (index.ts) eklenmeden önce de kendi klasöründe sınanabilir:
 * `npx vitest run src/content -t "Matematik"`.
 */
const modules = import.meta.glob<Record<string, unknown>>("./*/subject.ts", { eager: true });
const isSubject = (v: unknown): v is Subject => typeof v === "object" && v !== null && "units" in v && "grades" in v && "code" in v;
const FOUND: { subject: Subject; dir: string }[] = Object.entries(modules).flatMap(([path, mod]) =>
  Object.values(mod)
    .filter(isSubject)
    .map((subject) => ({ subject, dir: path.split("/")[1] })),
);

/**
 * İçerik dosyalarını doğrudan diskten okur. İçerik ekleyen biri kendi dosyasını
 * `npx vitest run src/content -t "kartlar/6.json"` gibi bir süzgeçle hemen kontrol edebilir.
 */
const readJson = (path: string): unknown[] => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : []);

/**
 * Sorular mezhepler üstüdür: cevabı mezhebe göre değişen fıkıh ayrıntısı sorulmaz.
 * "Hanefi mezhebine göre…", "Şâfiîlere göre…" gibi kalıplar bu yüzden hata sayılır.
 * Mezhepleri konu olarak tanıtan sorular (7. sınıf) bu kalıpları kullanmaz.
 */
const MADHAB_RULING = /mezhebine göre|mezheplere göre|(hanef|şâfi|şafi|mâlik|malik|hanbel)[a-zçğıöşüâîû]*lere göre|imameyn/;

function checkQuestion(q: Question, label: string, unitIds: Set<string>, prefix: string) {
  expect(unitIds.has(q.unit), `${label}: bilinmeyen ünite ${q.unit}`).toBe(true);
  expect(q.unit.startsWith(prefix), `${label}: ${q.unit} bu sınıfa ait değil`).toBe(true);
  expect(q.id.startsWith(`${q.unit}-`), `${label}: id ünite ile başlamalı (${q.id})`).toBe(true);
  const texts = [q.prompt, q.explanation, ...(q.type === "true-false" ? [] : q.choices), ...(q.type === "passage" ? [q.context] : [])];
  for (const t of texts) expect(t.includes("{") || t.includes("}"), `${label}: doldurulmamış kalıp: ${t}`).toBe(false);
  for (const t of texts) {
    const ruling = t.toLocaleLowerCase("tr").match(MADHAB_RULING);
    expect(ruling, `${label}: mezhebe bağlı hüküm ("${ruling?.[0]}"); sorular mezhepler üstü olmalı`).toBeNull();
  }
  if (q.type !== "true-false") {
    const normalized = q.choices.map((c) => c.trim().toLocaleLowerCase("tr"));
    expect(new Set(normalized).size, `${label}: aynı şık iki kez`).toBe(q.choices.length);
  }
}

describe("ders kaydı", () => {
  it("kayıtlı her dersin klasörü vardır ve klasör adı ders kimliğidir", () => {
    for (const s of SUBJECTS) expect(FOUND.some((f) => f.subject.id === s.id), `${s.id} klasörde bulunamadı`).toBe(true);
    for (const f of FOUND) expect(f.dir, `${f.subject.id} dersinin klasörü kimliğiyle aynı olmalı`).toBe(f.subject.id);
  });
  it("ünite kimlikleri ders koduyla ve sınıfla başlar, benzersizdir", () => {
    const seen = new Set<string>();
    for (const { subject } of FOUND) {
      for (const u of subject.units) {
        expect(u.id.startsWith(`${subject.code}-${u.grade}-`), `${u.id}: "${subject.code}-${u.grade}-" ile başlamalı`).toBe(true);
        expect(subject.grades.includes(u.grade), `${u.id}: ${u.grade}. sınıf dersin sınıfları arasında yok`).toBe(true);
        expect(seen.has(u.id), `tekrarlanan ünite ${u.id}`).toBe(false);
        seen.add(u.id);
      }
      for (const g of subject.grades) expect(subject.units.some((u) => u.grade === g), `${subject.id}: ${g}. sınıfın ünitesi yok`).toBe(true);
    }
  });
});

for (const { subject } of FOUND) {
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
