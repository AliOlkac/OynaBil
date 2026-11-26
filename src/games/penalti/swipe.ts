/**
 * Kaydırmalı şutun okunması: parmağın çizdiği çizgiden hedef, güç ve falso. Saf hesap; iki sahne de
 * (3D ve çizim) kendi ekran-kale çevirisini verir, sonuç aynı kurala göre çıkar.
 */

/** Parmağın bir anı: ekran (ya da çizim) koordinatı ve zaman (ms). */
export type SwipeSample = { x: number; y: number; t: number };
export type Swipe = { x: number; y: number; power: number; curve: number };

/** Çizginin hızı (sahne yüksekliği / saniye): bu hızda güç 0, şu hızda 1. */
export const SWIPE_SPEED = { min: 0.5, max: 4.5 } as const;
/** Kalenin altında biten çizgi kaleye doğru uzatılır; top bu yükseklikte (yerden) gider. */
export const LOW_SHOT = 0.08;

/**
 * `toGoal` ekran noktasını kale koordinatına çevirir (x: -1..1 direkler, y: 0 zemin, 1 üst direk; dışarısı
 * da olur). `height`, sahnenin yüksekliğidir (aynı birimde): hız ve kavis buna göre ölçülür.
 * Çizgi yukarı gitmiyorsa ya da çok kısaysa şut yoktur (null).
 */
export function readSwipe(samples: SwipeSample[], toGoal: (x: number, y: number) => { x: number; y: number }, height: number): Swipe | null {
  if (samples.length < 2 || height <= 0) return null;
  const first = samples[0];
  // Parmak kıpırdamadan beklediyse çizgi hareketin başladığı yerden sayılır.
  let i0 = 0;
  while (i0 < samples.length - 1 && Math.hypot(samples[i0 + 1].x - first.x, samples[i0 + 1].y - first.y) < height * 0.02) i0++;
  const S = samples[i0];
  const E = samples[samples.length - 1];
  // Parmak sonda durup beklediyse süre, sona varıldığı anda biter.
  let i1 = samples.length - 1;
  while (i1 > i0 && Math.hypot(samples[i1 - 1].x - E.x, samples[i1 - 1].y - E.y) < height * 0.02) i1--;
  const dx = E.x - S.x;
  const dy = E.y - S.y;
  const len = Math.hypot(dx, dy);
  if (len < height * 0.06 || dy > -height * 0.03) return null;

  const ms = Math.max(16, samples[i1].t - S.t);
  const speed = len / height / (ms / 1000);
  const power = Math.min(1, Math.max(0, (speed - SWIPE_SPEED.min) / (SWIPE_SPEED.max - SWIPE_SPEED.min)));

  // Kavis: çizginin kirişten en çok saptığı yer (sağa artı).
  let bulge = 0;
  for (let i = i0 + 1; i < samples.length - 1; i++) {
    const d = (dx * (samples[i].y - S.y) - dy * (samples[i].x - S.x)) / len;
    if (Math.abs(d) > Math.abs(bulge)) bulge = d;
  }
  const curve = Math.min(1, Math.max(-1, (bulge / len) * 4));

  let g = toGoal(E.x, E.y);
  if (g.y < LOW_SHOT) {
    // Kalenin altında biten çizgi kaleye kadar uzatılır: yerden şut.
    let lo = 1;
    let hi = 8;
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (toGoal(S.x + dx * mid, S.y + dy * mid).y < LOW_SHOT) lo = mid;
      else hi = mid;
    }
    g = toGoal(S.x + dx * hi, S.y + dy * hi);
    g = { x: g.x, y: Math.max(0, Math.min(g.y, LOW_SHOT)) };
  }
  return { x: Math.max(-2.4, Math.min(2.4, g.x)), y: Math.max(0, Math.min(2.4, g.y)), power, curve: Math.abs(curve) < 0.08 ? 0 : curve };
}
