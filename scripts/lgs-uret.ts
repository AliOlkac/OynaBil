/**
 * LGS tarzı paragraf sorusu üretim hattı.
 *
 *   npx tsx scripts/lgs-uret.ts --sinif 8                 # sınıfın bütün ünitelerine 10'ar soru
 *   npx tsx scripts/lgs-uret.ts --sinif 8 --unite dkab-8-2 --adet 6
 *   npx tsx scripts/lgs-uret.ts --sinif 8 --dogrula       # yeni üretmeden mevcut soruları körlemesine çözdür
 *   npx tsx scripts/lgs-uret.ts --sinif 8 --kuru          # API'yi çağırmadan istemleri göster
 *
 * Adımlar:
 *   1. Üret: Claude, ünitenin konusu, mevcut sorular (tekrar etmemesi için) ve örneklerle yapılandırılmış JSON üretir.
 *   2. Denetle: OynaBil şeması (uzunluklar, dört şık), tekrar/benzerlik ve şık dağılımı.
 *   3. Körlemesine çöz: ikinci bir çağrı soruları cevapları görmeden çözer. Cevabı tutmayan, emin olunamayan
 *      ya da sorun bildirilen sorular ayrılır.
 *   4. Yaz: kabul edilenler src/content/<ders>/sorular/<sınıf>-lgs.json dosyasına eklenir; ayrılanlar
 *      icerik-inceleme/ altına gerekçesiyle yazılır. Sonra `npm test` ile içerik testi çalıştırılır.
 *
 * Kimlik bilgisi: ANTHROPIC_API_KEY ortam değişkeni ya da `ant auth login` profili.
 * Her çalıştırma ücretlidir: ünite başına bir üretim ve bir doğrulama çağrısı yapılır.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { SUBJECTS } from "@/content";
import { passageSchema, questionSchema, type Grade, type Question, type Unit } from "@/core/model";

const MODEL = "claude-opus-5-5";

const { values: args } = parseArgs({
  options: {
    ders: { type: "string", default: "din-kulturu" },
    sinif: { type: "string" },
    unite: { type: "string" },
    adet: { type: "string", default: "10" },
    dogrula: { type: "boolean", default: false },
    kuru: { type: "boolean", default: false },
  },
});

const subject = SUBJECTS.find((s) => s.id === args.ders);
const grade = Number(args.sinif) as Grade;
if (!subject || !subject.grades.includes(grade)) {
  console.error(`Kullanım: npx tsx scripts/lgs-uret.ts --sinif <${SUBJECTS[0].grades.join("|")}> [--unite <id>] [--adet 10] [--dogrula] [--kuru]`);
  process.exit(1);
}
const units = subject.units.filter((u) => u.grade === grade && (!args.unite || u.id === args.unite));
const count = Math.max(1, Math.min(20, Number(args.adet)));

const contentDir = join(process.cwd(), "src", "content", subject.id, "sorular");
const lgsPath = join(contentDir, `${grade}-lgs.json`);
const readQuestions = (path: string): Question[] => (existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as unknown[]).map((q) => questionSchema.parse(q)) : []);
const existingLgs = readQuestions(lgsPath);
const existingAll = [...readQuestions(join(contentDir, `${grade}.json`)), ...existingLgs];

// ---- benzerlik: aynı metni ya da kökü ikinci kez eklememek için ----
const words = (text: string) => new Set(text.toLocaleLowerCase("tr").match(/[\p{L}\p{N}]+/gu)?.filter((w) => w.length > 3) ?? []);
function similarity(a: string, b: string) {
  const x = words(a);
  const y = words(b);
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / Math.max(1, x.size + y.size - common);
}
const textOf = (q: Question) => `${q.type === "passage" ? q.context : ""} ${q.prompt}`;

// ---- yapılandırılmış çıktı şemaları (uzunluk sınırları sonra OynaBil şemasıyla denetlenir) ----
const DraftSchema = z.object({
  questions: z.array(
    z.object({
      context: z.string(),
      prompt: z.string(),
      choices: z.array(z.string()),
      answer: z.number().int(),
      explanation: z.string(),
      difficulty: z.number().int(),
    }),
  ),
});

const VerdictSchema = z.object({
  results: z.array(
    z.object({
      index: z.number().int(),
      choice: z.number().int(),
      confident: z.boolean(),
      problem: z.string(),
    }),
  ),
});

const RULES = `Sen Türkiye'de ortaokul Din Kültürü ve Ahlak Bilgisi (DKAB) dersi için LGS tarzı soru yazan deneyimli bir öğretmensin.
Sorular akıllı tahtada takım yarışmasında gösterilecek; her sorudan sonra açıklama tahtada okunur.

Kurallar:
- Doğru, doğal Türkçe; Türkçe karakterler eksiksiz (ğ, ş, ı, İ, ç, ö, ü, â, î).
- MEB DKAB ders kitaplarının yaklaşımı: tarafsız, saygılı, mezhepler üstü, yaşa uygun. Fıkhî ayrıntılarda Hanefî görüş; gerekiyorsa belirt. Para tutarı yazma.
- Yalnızca Türkiye'deki din eğitiminde (Diyanet/MEB) tartışmasız kabul gören bilgiler. Ayet ya da hadis metni ancak Diyanet mealinin sözlerinden kesin eminsen ve kaynağıyla; değilsen durum, diyalog ya da açıklayıcı metin kullan.
- "context": 2-5 cümle, 150-550 karakter: kısa bilgi metni, öğrenci/aile durumu ya da iki öğrenci arasında diyalog.
- "prompt": soru kökü, en fazla 160 karakter. LGS kökleri: "Bu metinde aşağıdakilerden hangisine vurgu yapılmaktadır?", "Bu metinden aşağıdakilerden hangisi çıkarılamaz?", "Metindeki davranış hangi kavramla ilişkilidir?", "Bu durum aşağıdakilerden hangisine örnektir?". Olumsuz köklerden de kullan.
- "choices": tam 4 şık, her biri en fazla 120 karakter, uzunluk ve üslupça benzer. Yalnızca biri metin ve ünite bilgisiyle savunulabilir doğru; diğerleri makul ama açıkça desteklenmeyen.
- Çeldiriciler "yalnızca", "hiçbir", "her zaman", "bütün" gibi kesin sözcüklerle kendini ele vermesin; yanlışlığı içerikten anlaşılsın.
- "answer": doğru şıkkın sırası (0-3); şıklar arasında dengeli dağıt.
- "explanation": 1-2 cümle, en fazla 260 karakter: neden doğru, gerekirse en güçlü çeldirici neden yanlış.
- "difficulty": 1 kolay, 2 orta, 3 zor; çoğunluk orta.
- Hile sorusu, çift olumsuz, siyasi içerik yok. İki şık savunulabiliyorsa soruyu yeniden yaz.`;

/** Örnek olarak yalnızca modelin üreteceği alanlar gösterilir; kimlik ve ünite betikte atanır. */
function asExample(q: Question) {
  if (q.type !== "passage") return null;
  const { context, prompt, choices, answer, explanation, difficulty } = q;
  return { context, prompt, choices, answer, explanation, difficulty };
}

function draftPrompt(unit: Unit, n: number): string {
  const inUnit = existingAll.filter((q) => q.unit === unit.id);
  const examples = existingLgs.filter((q) => q.unit === unit.id).slice(0, 2);
  const fallbackExamples = examples.length ? examples : existingLgs.slice(0, 2);
  return [
    `Ünite: ${unit.order}. ünite, "${unit.title}" (${grade}. sınıf).`,
    `Bu ünite için ${n} yeni LGS tarzı paragraf sorusu yaz.`,
    inUnit.length
      ? `Bu ünitede zaten olan sorular (tekrar etme, farklı durum ve kazanımlar seç):\n${inUnit.map((q) => `- ${textOf(q).slice(0, 140)}`).join("\n")}`
      : "",
    fallbackExamples.length ? `Biçim örnekleri:\n${JSON.stringify(fallbackExamples.map(asExample), null, 2)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function verifyPrompt(questions: Question[]): string {
  const blocks = questions.map((q, i) => {
    if (q.type !== "passage") return "";
    return `#${i}\nMetin: ${q.context}\nSoru: ${q.prompt}\n${q.choices.map((c, j) => `${"ABCD"[j]}) ${c}`).join("\n")}`;
  });
  return `Aşağıdaki LGS tarzı DKAB sorularını iyi hazırlanmış bir 8. sınıf öğrencisi gibi çöz. Cevap anahtarı sende yok.
Her soru için:
- "choice": seçtiğin şıkkın sırası (A=0, B=1, C=2, D=3),
- "confident": tek bir doğru şıktan eminsen true,
- "problem": soruda sorun yoksa boş metin; varsa kısaca yaz (ör. "B ve C ikisi de savunulabilir", "metinden çıkarılamıyor", "bilgi hatası: ...", "müfredat dışı").

${blocks.join("\n\n")}`;
}

const client = new Anthropic();

/**
 * Claude Opus 5.5 güvenlik sınıflandırıcısı nadiren bir isteği reddedebilir; `fallbacks: "default"` bu durumda
 * isteği uygun bir modelle aynı çağrı içinde yeniden çalıştırır. Yine de reddedilirse ünite atlanır.
 */
async function ask<T>(system: string, user: string, schema: z.ZodType<T>, effort: "medium" | "high"): Promise<T | null> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort, format: betaZodOutputFormat(schema) },
  });
  if (response.stop_reason === "refusal") {
    console.warn(`  ! İstek reddedildi (${response.stop_details?.category ?? "kategori yok"}); bu ünite atlandı.`);
    return null;
  }
  if (response.stop_reason === "max_tokens") {
    console.warn("  ! Yanıt uzunluk sınırına takıldı; daha az soru isteyin (--adet).");
    return null;
  }
  return response.parsed_output;
}

type Flagged = { question: unknown; reason: string; verdict?: unknown };

async function verify(questions: Question[]): Promise<{ ok: Question[]; flagged: Flagged[] }> {
  const ok: Question[] = [];
  const flagged: Flagged[] = [];
  if (questions.length === 0) return { ok, flagged };
  const verdict = await ask(
    "Sen dikkatli bir ölçme-değerlendirme uzmanısın. Soruları bağımsız çözer, belirsiz ya da hatalı soruları açıkça bildirirsin.",
    verifyPrompt(questions),
    VerdictSchema,
    "medium",
  );
  questions.forEach((q, i) => {
    const r = verdict?.results.find((x) => x.index === i);
    if (!r) return flagged.push({ question: q, reason: "doğrulama yanıtı yok" });
    if (q.type !== "passage") return;
    if (r.choice !== q.answer) return flagged.push({ question: q, reason: `körlemesine çözümde ${"ABCD"[r.choice] ?? r.choice} seçildi, cevap ${"ABCD"[q.answer]}`, verdict: r });
    if (!r.confident || r.problem.trim()) return flagged.push({ question: q, reason: r.problem.trim() || "çözücü emin değil", verdict: r });
    ok.push(q);
  });
  return { ok, flagged };
}

function nextId(unitId: string, taken: Set<string>): string {
  for (let n = 1; ; n++) {
    const id = `${unitId}-lgs-${String(n).padStart(2, "0")}`;
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
}

async function main() {
  console.log(`${subject!.name}, ${grade}. sınıf, ${units.length} ünite, model ${MODEL}${args.kuru ? " (kuru çalıştırma)" : ""}`);
  const accepted: Question[] = [];
  const flagged: Flagged[] = [];
  const taken = new Set(existingAll.map((q) => q.id));

  for (const unit of units) {
    console.log(`\n${unit.id} ${unit.title}`);

    if (args.dogrula) {
      const current = existingLgs.filter((q) => q.unit === unit.id);
      if (args.kuru) {
        console.log(verifyPrompt(current).slice(0, 1500));
        continue;
      }
      const result = await verify(current);
      flagged.push(...result.flagged);
      console.log(`  ${result.ok.length}/${current.length} soru doğrulandı`);
      continue;
    }

    if (args.kuru) {
      console.log(`--- sistem ---\n${RULES}\n--- istem ---\n${draftPrompt(unit, count)}`);
      continue;
    }

    const draft = await ask(RULES, draftPrompt(unit, count), DraftSchema, "high");
    if (!draft) continue;

    // Şema ve tekrar denetimi
    const candidates: Question[] = [];
    for (const d of draft.questions) {
      const candidate = {
        id: nextId(unit.id, taken),
        unit: unit.id,
        type: "passage" as const,
        difficulty: Math.min(3, Math.max(1, d.difficulty)),
        context: d.context.trim(),
        prompt: d.prompt.trim(),
        choices: d.choices.map((c) => c.trim()),
        answer: d.answer,
        explanation: d.explanation.trim(),
        tags: ["LGS"],
      };
      const parsed = passageSchema.safeParse(candidate);
      if (!parsed.success) {
        flagged.push({ question: candidate, reason: `şema: ${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}` });
        continue;
      }
      const q = parsed.data;
      const duplicate = [...existingAll, ...accepted, ...candidates].find((other) => similarity(textOf(other), textOf(q)) > 0.55);
      if (duplicate) {
        flagged.push({ question: q, reason: `mevcut soruya çok benziyor: ${duplicate.id}` });
        continue;
      }
      candidates.push(q);
    }

    const result = await verify(candidates);
    accepted.push(...result.ok);
    flagged.push(...result.flagged);
    console.log(`  ${draft.questions.length} üretildi, ${result.ok.length} kabul, ${draft.questions.length - result.ok.length} ayrıldı`);
  }

  if (args.kuru) return;

  if (accepted.length) {
    const merged = [...existingLgs, ...accepted].sort((a, b) => a.id.localeCompare(b.id, "tr"));
    writeFileSync(lgsPath, `${JSON.stringify(merged, null, 2)}\n`);
    const positions = [0, 1, 2, 3].map((p) => merged.filter((q) => q.type === "passage" && q.answer === p).length);
    console.log(`\n${accepted.length} soru ${lgsPath} dosyasına eklendi. Doğru şık dağılımı A-D: ${positions.join(" / ")}`);
  }
  if (flagged.length) {
    const dir = join(process.cwd(), "icerik-inceleme");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${subject!.id}-${grade}-lgs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(path, `${JSON.stringify(flagged, null, 2)}\n`);
    console.log(`${flagged.length} soru öğretmen incelemesi için ayrıldı: ${path}`);
  }
  console.log("\nSıradaki adım: npm test (içerik şeması ve kimlik denetimi).");
}

main().catch((error: unknown) => {
  if (error instanceof Anthropic.AuthenticationError) console.error("Kimlik doğrulanamadı: ANTHROPIC_API_KEY ayarlayın ya da `ant auth login` çalıştırın.");
  else if (error instanceof Anthropic.RateLimitError) console.error("Hız sınırına takıldı; biraz sonra yeniden deneyin.");
  else if (error instanceof Anthropic.APIError) console.error(`API hatası ${error.status}: ${error.message}`);
  else console.error(error);
  process.exit(1);
});
