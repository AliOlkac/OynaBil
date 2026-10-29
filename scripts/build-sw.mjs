// Derleme sonrası: out/ altındaki dosyaları listeler ve service worker'ı yazar.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";
const SKIP = new Set(["sw.js", "404.html"]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(OUT)
  .map((f) => relative(OUT, f).split(sep).join("/"))
  .filter((f) => !SKIP.has(f) && !f.endsWith(".map") && !f.startsWith("_not-found"));

const urls = files.map((f) => {
  if (f === "index.html") return "/";
  if (f.endsWith("/index.html")) return `/${f.slice(0, -"index.html".length)}`;
  return `/${f}`;
});

const hash = createHash("sha256");
for (const f of files.sort()) hash.update(f).update(readFileSync(join(OUT, f)));
const version = hash.digest("hex").slice(0, 12);

const template = readFileSync("scripts/sw-template.js", "utf8");
writeFileSync(join(OUT, "sw.js"), template.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(urls.sort(), null, 2)));
console.log(`sw.js yazıldı: ${urls.length} dosya, sürüm ${version}`);
