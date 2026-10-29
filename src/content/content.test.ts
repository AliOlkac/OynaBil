import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { questionSchema } from "@/core/model";
import { SUBJECTS } from "@/content";

/**
 * Soru dosyalarını doğrudan diskten okur; böylece içerik ekleyen biri
 * `npx vitest run src/content` ile dosyasını hemen kontrol edebilir.
 */
for (const subject of SUBJECTS) {
  const dir = join(__dirname, subject.id, "sorular");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const unitIds = new Set(subject.units.map((u) => u.id));

  describe(`${subject.name} soruları`, () => {
    const seen = new Set<string>();

    for (const file of files) {
      const grade = Number(file.replace(".json", ""));
      const raw: unknown[] = JSON.parse(readFileSync(join(dir, file), "utf8"));

      it(`${file} geçerli bir soru listesi`, () => {
        expect(Array.isArray(raw)).toBe(true);
        expect(raw.length).toBeGreaterThan(0);
      });

      raw.forEach((item, i) => {
        const label = `${file}[${i}] ${(item as { id?: string }).id ?? ""}`;
        it(label, () => {
          const result = questionSchema.safeParse(item);
          if (!result.success) {
            throw new Error(`${label}: ${result.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
          }
          const q = result.data;
          expect(unitIds.has(q.unit), `bilinmeyen ünite ${q.unit}`).toBe(true);
          expect(q.unit.startsWith(`${subject.code}-${grade}-`), `${q.unit} ${file} dosyasına ait değil`).toBe(true);
          expect(q.id.startsWith(`${q.unit}-`), `id ünite ile başlamalı: ${q.id}`).toBe(true);
          expect(seen.has(q.id), `tekrarlanan id ${q.id}`).toBe(false);
          seen.add(q.id);
          if (q.type === "multiple-choice") {
            const normalized = q.choices.map((c) => c.trim().toLocaleLowerCase("tr"));
            expect(new Set(normalized).size, `aynı şık iki kez: ${q.id}`).toBe(q.choices.length);
          }
        });
      });
    }
  });
}
