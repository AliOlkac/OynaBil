import { ballHeight, PREVIEW, RELEASE_H, velocityOf, type Launch, type Range, type Shot, type ShotResult } from "./logic";

/**
 * Basketbol sahnesinin ölçüleri (metre) ve atışın zaman çizelgesi. Saf hesap, three.js içermez;
 * 3D sahne de çizim sahnesi de topun yerini buradan okur, tekrar gösterimi de aynı fonksiyonu oynatır.
 *
 * Pota (0, RIM_Y, 0) noktasındadır; saha +z yönünde uzanır, kamera ve şutçu +z tarafındadır.
 * Çocuklara uygun alçak bir pota kullanılır.
 */

export type V3 = { x: number; y: number; z: number };

export const RIM_Y = 2.75;
export const RIM_R = 0.23;
export const BALL_R = 0.12;
/** Panyanın ön yüzü. */
export const BOARD_Z = -0.38;
export const BOARD_W = 1.8;
export const BOARD_H = 1.05;
export const BOARD_BOTTOM = RIM_Y - 0.15;
export const NET_DEPTH = 0.42;
export const GRAVITY = 9.8;
export const THREE_POINT = 6.2;

/** Atış noktası: yakın atış çizginin önünden, üçlük çizginin dışından ve iki yandan sırayla. */
export function spotFor(range: Range, index: number): V3 {
  if (range === 2) {
    const a = [0, -0.5, 0.5][index % 3];
    return { x: Math.sin(a) * 3.9, y: 0, z: Math.cos(a) * 3.9 };
  }
  const a = [0, -0.75, 0.75, -0.4, 0.4][index % 5];
  return { x: Math.sin(a) * (THREE_POINT + 0.45), y: 0, z: Math.cos(a) * (THREE_POINT + 0.45) };
}

/** Şutçunun hareketinin anları (atış başladıktan sonra saniye). */
export const GATHER = 0.28;
export const RELEASE = 0.62;
export const LAND = 1.02;

/** Top elden çıkarken nerededir: şutçunun önünde, başının üstünde. */
export function releasePoint(spot: V3, scale: number): V3 {
  const d = Math.hypot(spot.x, spot.z) || 1;
  return { x: spot.x - (spot.x / d) * 0.22, y: 2.05 * scale + 0.32, z: spot.z - (spot.z / d) * 0.22 };
}

/**
 * Çekiş sürerken gösterilen yolun başı: elden çıkış noktasından potaya doğru, yolun `PREVIEW` kadarı.
 * Yükseklik oyun mantığının fiziğinden gelir; gerisini oyuncu kestirir.
 */
export function previewPath(launch: Launch, range: Range, index: number, scale = 0.9, count = 9): V3[] {
  const r = releasePoint(spotFor(range, index), scale);
  const lift = r.y - RELEASE_H;
  return Array.from({ length: count }, (_, i) => {
    const f = ((i + 1) / count) * PREVIEW;
    return { x: r.x * (1 - f), y: ballHeight(launch, range, f) + lift, z: r.z * (1 - f) };
  });
}

/** Topun bir bölümü: `from` noktasından `to` noktasına `dur` saniyede, yerçekimiyle uçan yay. */
type Segment = { t0: number; dur: number; from: V3; to: V3; spin: number };
export type ShotEvent = { t: number; kind: "release" | "rim" | "board" | "net" | "floor" | "made"; strength: number };

export type ShotPlan = {
  result: ShotResult;
  made: boolean;
  spot: V3;
  segments: Segment[];
  events: ShotEvent[];
  /** Topun filelere girdiği an (basketse). */
  madeAt: number | null;
  /** Topun son sekişi; sonrasında top yerde yuvarlanıp durur. */
  end: number;
  /** Tekrar gösteriminin ilgilendiği aralık. */
  replay: { from: number; to: number };
};

/** Atışa göre küçük sapmalar: aynı atış her açılışta aynı oynar. */
function rand(index: number, k: number) {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(k + 3, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 10_000) / 10_000;
}

const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const v = (x: number, y: number, z: number): V3 => ({ x, y, z });

/** İki nokta arası yayın süresi: uzaklık arttıkça uzar. */
const baseFlight = (a: V3, b: V3) => 0.78 + Math.hypot(b.x - a.x, b.z - a.z) * 0.085;

/**
 * Atışın bütün yolu. Sonuç oyun mantığından gelir; sahne yalnızca onu inandırıcı biçimde oynatır:
 * tertemiz basket çembere değmeden fileye, çemberden giren top bir iki sekip içeri, kaçan top çemberden
 * ya da panyadan dışarı.
 */
export function planShot(shot: Pick<Shot, "range" | "result" | "launch">, index: number, scale = 0.9): ShotPlan {
  const spot = spotFor(shot.range, index);
  const r = releasePoint(spot, scale);
  // Çekilen atışta topun ilk yayı çekişin hızıyla uçar: yatay hız sabit, süre mesafeden çıkar.
  const vx = shot.launch ? velocityOf(shot.launch).vx : 0;
  const flightTime = (a: V3, b: V3) => (vx > 0 ? Math.min(2.4, Math.max(0.5, Math.hypot(b.x - a.x, b.z - a.z) / vx)) : baseFlight(a, b));
  const segs: Segment[] = [];
  const events: ShotEvent[] = [{ t: RELEASE, kind: "release", strength: 1 }];
  let t = RELEASE;
  let at = r;
  const side = rand(index, 1) < 0.5 ? -1 : 1;
  // Topun yanlara hafif kayması: şutçu ortada değilse top da o yandan gelir.
  const lean = spot.x / Math.max(1, Math.hypot(spot.x, spot.z));
  const to = (p: V3, dur: number, spin = 1) => {
    segs.push({ t0: t, dur, from: at, to: p, spin });
    t += dur;
    at = p;
  };
  let madeAt: number | null = null;
  const toward = (dz: number) => v(-lean * RIM_R * 0.6, 0, dz);

  const throughNet = () => {
    madeAt = t;
    events.push({ t, kind: "made", strength: 1 }, { t: t + 0.05, kind: "net", strength: 1 });
    // File topu yavaşlatır; top dibinden çıkıp yere düşer.
    to(v(0, RIM_Y - NET_DEPTH, -0.02), 0.2, 0.4);
    to(v(side * 0.15, BALL_R, 0.35), 0.48, 0.6);
    events.push({ t, kind: "floor", strength: 1 });
  };

  switch (shot.result) {
    case "temiz": {
      to(v(0, RIM_Y + 0.02, 0.01), flightTime(r, v(0, 0, 0)));
      throughNet();
      break;
    }
    case "cember": {
      // Arka çembere vurur, öne seker, sonra içeri düşer.
      const back = add(v(0, RIM_Y + BALL_R * 0.7, -RIM_R + 0.04), toward(0));
      to(back, flightTime(r, back));
      events.push({ t, kind: "rim", strength: 0.8 });
      const front = v(side * 0.06, RIM_Y + BALL_R * 0.7, RIM_R - 0.05);
      to(front, 0.42, 0.5);
      events.push({ t, kind: "rim", strength: 0.5 });
      to(v(0, RIM_Y + 0.02, 0), 0.3, 0.4);
      throughNet();
      break;
    }
    case "kacti-on": {
      const front = add(v(0, RIM_Y + BALL_R * 0.7, RIM_R - 0.02), toward(0));
      to(front, flightTime(r, front));
      events.push({ t, kind: "rim", strength: 1 });
      to(v(side * 0.9, BALL_R, 1.9), 0.82);
      events.push({ t, kind: "floor", strength: 1 });
      break;
    }
    case "kacti-arka": {
      const back = add(v(0, RIM_Y + BALL_R * 0.7, -RIM_R + 0.02), toward(0));
      to(back, flightTime(r, back));
      events.push({ t, kind: "rim", strength: 1 });
      // Çembere vurur, havalanır, öndeki çemberi sıyırıp dışarı düşer.
      to(v(side * 0.18, RIM_Y + BALL_R * 0.8, RIM_R + 0.06), 0.55, 0.6);
      events.push({ t, kind: "rim", strength: 0.5 });
      to(v(side * 1.1, BALL_R, 1.6), 0.75);
      events.push({ t, kind: "floor", strength: 1 });
      break;
    }
    case "panya": {
      const board = v(side * 0.25, RIM_Y + 0.55, BOARD_Z + BALL_R);
      to(board, flightTime(r, board) * 0.95);
      events.push({ t, kind: "board", strength: 1 });
      // Panyadan seker, çemberin önünden geçip yere düşer.
      to(v(side * 0.7, BALL_R, 2.3), 0.85);
      events.push({ t, kind: "floor", strength: 1 });
      break;
    }
    case "kisa": {
      // Havaya gider: çemberin önüne bile ulaşmaz.
      const land = v(spot.x * 0.15 + side * 0.2, BALL_R, 0.9 + Math.hypot(spot.x, spot.z) * 0.08);
      to(land, flightTime(r, land) * 0.95);
      events.push({ t, kind: "floor", strength: 1 });
      break;
    }
  }

  // Yerde birkaç sekme, sonra durur.
  const dir = shot.result === "temiz" || shot.result === "cember" ? v(side * 0.25, 0, 0.6) : v(side * 0.35, 0, 0.75);
  let h = shot.result === "kisa" ? 1.1 : 0.85;
  for (let k = 0; k < 4; k++) {
    const dur = 2 * Math.sqrt((2 * h) / GRAVITY);
    const p = add(at, v(dir.x * dur, 0, dir.z * dur));
    segs.push({ t0: t, dur, from: at, to: p, spin: 0.5, apex: h } as Segment & { apex: number });
    t += dur;
    at = p;
    events.push({ t, kind: "floor", strength: h });
    h *= 0.42;
  }

  const made = madeAt !== null;
  const firstHit = events.find((e) => e.kind !== "release")!.t;
  return {
    result: shot.result,
    made,
    spot,
    segments: segs,
    events: events.sort((a, b) => a.t - b.t),
    madeAt,
    end: t,
    replay: { from: Math.max(RELEASE, firstHit - 0.55), to: (madeAt ?? firstHit) + 0.75 },
  };
}

/** Topun `t` anındaki yeri. Atış başlamadan önce şutçunun elindedir (null). */
export function ballAt(plan: ShotPlan, t: number, out: V3 = { x: 0, y: 0, z: 0 }): V3 | null {
  if (t < RELEASE) return null;
  const segs = plan.segments as (Segment & { apex?: number })[];
  let s = segs[segs.length - 1];
  for (const seg of segs) {
    if (t < seg.t0 + seg.dur) {
      s = seg;
      break;
    }
  }
  const u = Math.min(s.dur, Math.max(0, t - s.t0));
  const k = u / s.dur;
  out.x = s.from.x + (s.to.x - s.from.x) * k;
  out.z = s.from.z + (s.to.z - s.from.z) * k;
  if (s.apex !== undefined) {
    // Yerde sekme: tepe yüksekliği verilmiş yay.
    out.y = BALL_R + 4 * s.apex * k * (1 - k);
  } else {
    const vy = (s.to.y - s.from.y + 0.5 * GRAVITY * s.dur * s.dur) / s.dur;
    out.y = s.from.y + vy * u - 0.5 * GRAVITY * u * u;
  }
  return out;
}

/** Topun kendi çevresindeki dönüşü (radyan): uçarken geri döner, yerde yavaşlar. */
export function ballSpin(plan: ShotPlan, t: number): number {
  let a = 0;
  for (const seg of plan.segments) {
    if (t <= seg.t0) break;
    a += Math.min(t - seg.t0, seg.dur) * 9 * seg.spin;
  }
  return a;
}

/** Şutçunun pozunun parametreleri: çömelme, sıçrama yüksekliği, kolların kalkışı (0..1). */
export function shooterAt(t: number): { crouch: number; lift: number; arms: number; flick: number } {
  if (t <= 0) return { crouch: 0, lift: 0, arms: 0.15, flick: 0 };
  if (t < GATHER) {
    const k = t / GATHER;
    return { crouch: Math.sin(k * Math.PI * 0.5), lift: 0, arms: 0.15 + 0.35 * k, flick: 0 };
  }
  if (t < LAND) {
    const k = (t - GATHER) / (LAND - GATHER);
    const crouch = Math.max(0, 1 - k * 4);
    const lift = Math.sin(Math.min(1, k) * Math.PI) * 0.42;
    const arms = t < RELEASE ? 0.5 + 0.5 * ((t - GATHER) / (RELEASE - GATHER)) : 1;
    const flick = t < RELEASE ? 0 : Math.min(1, (t - RELEASE) / 0.12);
    return { crouch, lift, arms, flick };
  }
  // İnince: kol bir süre havada kalır (atış sonrası duruş), sonra iner.
  const k = Math.min(1, (t - LAND) / 0.5);
  return { crouch: Math.max(0, 0.35 - k * 0.35) * (t - LAND < 0.15 ? (t - LAND) / 0.15 : 1), lift: 0, arms: 1 - k * 0.7, flick: 1 - k };
}

/** Sonucun ekranda ve spikerde anılışı. */
export const RESULT_TEXT: Record<ShotResult, { title: string; detail: string }> = {
  temiz: { title: "Tertemiz!", detail: "Top çembere bile değmeden filelere gitti." },
  cember: { title: "Basket!", detail: "Top çemberde dans etti ve içeri düştü." },
  "kacti-on": { title: "Kısa kaldı!", detail: "Top ön çembere çarpıp döndü." },
  "kacti-arka": { title: "Uzun kaldı!", detail: "Top arka çembere çarpıp dışarı çıktı." },
  kisa: { title: "Havaya gitti!", detail: "Top çembere ulaşamadı." },
  panya: { title: "Panyadan döndü!", detail: "Atış çok güçlüydü, top panyadan sekti." },
};
