import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SUBJECTS } from "@/content";
import { audioTiming, lessonCatalog, lessonContext, LESSONS } from "./index";
import { audioName } from "./model";

describe("Ders videoları", () => {
  it("her ders geçerli bir üniteye bağlı ve kimliği tek", () => {
    const units = new Set(SUBJECTS.flatMap((s) => s.units.map((u) => u.id)));
    expect(LESSONS.length).toBeGreaterThan(0);
    for (const l of LESSONS) {
      expect(units.has(l.unit), l.id).toBe(true);
      expect(l.id.startsWith(`${l.unit}-d`), l.id).toBe(true);
    }
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });

  it("Maarif akışını izler: girişle başlar, kendini dene ve özetle biter", () => {
    for (const l of LESSONS) {
      const stages = l.scenes.map((s) => s.stage);
      expect(stages[0], l.id).toBe("giris");
      expect(stages).toContain("merak");
      expect(stages).toContain("dene");
      expect(stages.at(-1), l.id).toBe("ozet");
    }
  });

  it("test sahnesinde doğru cevap anlatımı, seçeneklerdeki doğru şıkkı söyler", () => {
    for (const l of LESSONS)
      for (const s of l.scenes)
        if (s.visual.type === "test") {
          const right = s.visual.options[s.visual.answer];
          expect(s.reveal?.toLocaleLowerCase("tr"), `${l.id}: ${right}`).toContain(right.toLocaleLowerCase("tr"));
        }
  });

  it("her anlatımın ses dosyası ve kelime zamanları var", () => {
    for (const l of LESSONS)
      l.scenes.forEach((s, i) => {
        for (const part of s.reveal ? (["say", "reveal"] as const) : (["say"] as const)) {
          const name = audioName(l, i, part);
          expect(existsSync(join("public/ses/dersler", l.id, `${name}.mp3`)), name).toBe(true);
          const t = audioTiming(name);
          expect(t?.ms, name).toBeGreaterThan(1000);
          expect(t?.words.length, name).toBeGreaterThan(2);
        }
      });
  });

  it("liste ve sonraki ders bağlantıları tutarlı", () => {
    const catalog = lessonCatalog();
    expect(catalog.some((c) => c.subject.id === "din-kulturu")).toBe(true);
    const first = LESSONS.find((l) => l.id === "dkab-5-1-d1")!;
    expect(lessonContext(first).next?.id).toBe("dkab-5-1-d2");
    expect(lessonContext(LESSONS.find((l) => l.id === "dkab-5-1-d4")!).next).toBeNull();
  });
});
