#!/usr/bin/env node
// Ders videolarının anlatım seslerini siteye hazırlar.
//
// Kaynak: Ses Atölyesi'nin (ElevenLabs) ürettiği bir iş klasörü, ör. <ses deposu>/jobs/oynabil-dkab-5-1-dersler.
// Her mp3 tek kanala indirilir, düzeyi eşitlenir ve konuşma için 48 kb/sn mp3 olarak
// public/ses/dersler/<ders kimliği>/<ad>.mp3 altına yazılır. Baştaki sessizlik kırpılmaz: kelime
// zamanları (altyazı vurgusu) dosyanın başına göredir. Manifestteki süre ve kelime zamanları
// src/content/<ders>/dersler/<sınıf>.ses.json dosyasına eklenir.
//
// Kullanım: node scripts/dersleri-hazirla.mjs <iş klasörü> <ders klasörü (ör. din-kulturu)> <sınıf>
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [jobDir, subject, grade] = process.argv.slice(2);
if (!jobDir || !subject || !grade) {
  console.error("Kullanım: node scripts/dersleri-hazirla.mjs <iş klasörü> <ders klasörü> <sınıf>");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(jobDir, "manifest.json"), "utf8"));
const timingPath = join("src/content", subject, "dersler", `${grade}.ses.json`);
const timing = existsSync(timingPath) ? JSON.parse(readFileSync(timingPath, "utf8")) : {};

let bytes = 0;
for (const item of manifest.items) {
  const lesson = item.name.replace(/-\d\d(-cevap)?$/, "");
  const outDir = join("public/ses/dersler", lesson);
  mkdirSync(outDir, { recursive: true });
  const src = join(jobDir, item.file);
  // Tepe düzeyi -1.5 dB'e çekilir; sondaki sessizlik kısaltılır.
  const detect = execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${src}" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \\(-\\{0,1\\}[0-9.]*\\) dB.*/\\1/p'`]).toString().trim();
  const max = Number(detect) || 0;
  const gain = (-1.5 - max).toFixed(2);
  const out = join(outDir, `${item.name}.mp3`);
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-ac", "1", "-ar", "44100",
    "-af", `volume=${gain}dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.25,areverse`,
    "-codec:a", "libmp3lame", "-b:a", "48k", out,
  ]);
  bytes += readFileSync(out).length;
  timing[item.name] = {
    ms: Math.round(item.duration_sec * 1000),
    words: (item.words ?? []).map((w) => [Math.round(w.start * 1000), w.word]),
  };
}
writeFileSync(timingPath, JSON.stringify(timing) + "\n");
console.log(`${manifest.items.length} dosya, ${(bytes / 1024).toFixed(0)} KB; zamanlar: ${timingPath}`);
