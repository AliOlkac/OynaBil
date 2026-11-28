import { z } from "zod";

/**
 * Ders videoları: her konu, sesli anlatımlı ve canlandırmalı sahnelerden oluşan kısa bir derstir.
 * Akış Türkiye Yüzyılı Maarif Modeli'nin öğrenme yaşantısını izler: merak uyandır, keşfet, öğren,
 * hayatla ilişkilendir, kendini dene, özetle. Görseller doğa, gök, motif ve çocuk karakterlerinden
 * oluşur; Allah, peygamberler ve melekler hiçbir zaman resmedilmez.
 */

export const STAGES = {
  giris: { label: "Başlıyoruz", color: "var(--color-firuze)" },
  merak: { label: "Merak et", color: "var(--color-kehribar)" },
  kesfet: { label: "Keşfet", color: "var(--color-kobalt)" },
  ogren: { label: "Öğren", color: "var(--color-firuze)" },
  hayat: { label: "Hayatla bağ kur", color: "var(--color-zumrut)" },
  dene: { label: "Kendini dene", color: "var(--color-mercan)" },
  ozet: { label: "Özetle", color: "var(--color-kehribar)" },
} as const;
export type Stage = keyof typeof STAGES;

export const SCENES = ["gece", "doga", "cocuklar", "sofra", "kitap", "cami"] as const;
export const ICONS = ["resim", "bina", "evren", "yildiz", "sonsuz", "el", "bir", "goz", "sofra", "kalp", "eller", "kitap"] as const;

const text = z.string().min(1);
const visual = z.discriminatedUnion("type", [
  z.object({ type: z.literal("kapak"), title: text, subtitle: text }),
  z.object({ type: z.literal("sahne"), scene: z.enum(SCENES), caption: text }),
  z.object({ type: z.literal("kavram"), term: text, meaning: text, note: text.optional(), tone: z.enum(["uyari"]).optional() }),
  z.object({ type: z.literal("liste"), title: text, items: z.array(z.object({ icon: z.enum(ICONS), text })).min(2).max(5) }),
  z.object({ type: z.literal("kartlar"), title: text, cards: z.array(z.object({ term: text, text })).min(2).max(6) }),
  z.object({ type: z.literal("ayet"), label: text, lines: z.array(text).min(1).max(5), source: text }),
  z.object({ type: z.literal("test"), question: text, options: z.array(text).length(4), answer: z.number().int().min(0).max(3) }),
  z.object({ type: z.literal("ozet"), items: z.array(text).min(2).max(5) }),
]);

export const sceneSchema = z
  .object({ stage: z.enum(Object.keys(STAGES) as [Stage, ...Stage[]]), visual, say: text, reveal: text.optional() })
  .refine((s) => (s.visual.type === "test") === Boolean(s.reveal), { message: "Kendini dene sahnesinde (ve yalnız orada) cevap anlatımı olmalı." });

export const lessonSchema = z.object({
  id: z.string().regex(/^[a-z]+-\d-\d+-d\d+$/),
  unit: z.string(),
  order: z.number().int().min(1),
  title: text,
  goal: text,
  scenes: z.array(sceneSchema).min(3),
});

export type Scene = z.infer<typeof sceneSchema>;
export type Visual = Scene["visual"];
export type Lesson = z.infer<typeof lessonSchema>;

/** Bir sahnenin ses dosyası (anlatım ve test cevabı ayrı). */
export const audioName = (lesson: Lesson, index: number, part: "say" | "reveal" = "say") =>
  `${lesson.id}-${String(index + 1).padStart(2, "0")}${part === "reveal" ? "-cevap" : ""}`;

/** Ses dosyası yokken anlatımın tahmini süresi (ms): okuma hızı ve kısa bir nefes. */
export const readingMs = (s: string) => Math.max(2200, s.length * 62 + 600);
