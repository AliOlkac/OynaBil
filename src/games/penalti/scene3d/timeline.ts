import { BALL_X, type Kick } from "../logic";
import { BALL_R, BOARD_H, BOARD_Z, GOAL_H, GOAL_HALF, guessPoint, hitsBar, KEEPER_HIP_Y, KEEPER_REACH, KEEPER_Z, KICKER_READY, KICKER_STRIKE, NET_DEPTH_BOTTOM, NET_DEPTH_TOP, SPOT, STAND_Z, standHeightAt, type V3 } from "./world";

/**
 * Bir penaltı şutunun zaman çizelgesi. Buradaki her şey yalnızca şutun kendisine ve geçen süreye (tau,
 * saniye) bağlıdır: rastgelelik ve saat yoktur. Bu yüzden aynı şut başka bir kameradan ağır çekimde
 * birebir yeniden oynatılabilir, testte de sınanabilir. three.js'e bağımlı değildir.
 */

/** Şutçunun topa vurduğu an, topun kaleye varış süresi ve kalecinin hamle anı. */
export const STRIKE = 0.36;
export const FLIGHT = 0.52;
export const CONTACT = STRIKE + FLIGHT;
export const DIVE_START = 0.42;
/** Canlı gösterinin bittiği an: sonuç kartı gelir, tekrar başlar. */
export const LIVE_END = 2.3;
/** Tekrar gösterimi: top yoldayken başlar, durulana kadar ağır çekimde sürer. */
export const REPLAY = { from: CONTACT - 0.36, to: CONTACT + 0.5, speed: 0.4 } as const;
export const REPLAY_SECONDS = (REPLAY.to - REPLAY.from) / REPLAY.speed;

const STEP = 1 / 120;
const SIM_SECONDS = 4.2;
const GRAVITY = 12;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Kalecinin "tahmin" yüksekliği: kurtaramadığı şutlarda nereye uçtuğu (görsel, belirli). */
const guessHeight = (index: number) => [0.25, 0.7, 0.45, 0.85, 0.15, 0.6][index % 6];

// ---------------------------------------------------------------------------------------------
// Top
// ---------------------------------------------------------------------------------------------

/**
 * Topun penaltı noktasından kaleye uçuşu: u=0 nokta, u=1 kale çizgisi. Hafif yükselir ve köşeye
 * doğru falso alır. Nişan çizgisi de bu fonksiyonla çizilir; görünen yol ile gidilen yol aynıdır.
 */
export function flightPoint(target: V3, u: number, out: V3 = { x: 0, y: 0, z: 0 }, bend = 0): V3 {
  const t = clamp01(u);
  const e = t * (1.14 - 0.14 * t);
  const s = Math.sin(Math.PI * t);
  const curve = clamp(target.x, -GOAL_HALF, GOAL_HALF) * 0.085;
  const arc = 0.2 + 0.14 * clamp01(target.y / GOAL_H);
  // Falsolu şut yolun ortasında yana açılır, sonra hedefe döner.
  out.x = SPOT.x + (target.x - SPOT.x) * e + curve * s + bend * CURL_M * s;
  out.y = SPOT.y + (target.y - SPOT.y) * e + arc * s;
  out.z = SPOT.z + (target.z - SPOT.z) * e;
  return out;
}

/** Tam falsoda topun yolun ortasında yana açılması (metre). */
export const CURL_M = 1.1;

/** Kale koordinatındaki bir şutun dünyadaki hedefi (topun merkezi). */
export function kickTarget(gx: number, gy: number): V3 {
  return { x: gx * GOAL_HALF, y: Math.max(BALL_R, gy * GOAL_H), z: 0 };
}

type Quat = [number, number, number, number];

function quatMul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function quatAxis(x: number, y: number, z: number, angle: number): Quat {
  const len = Math.hypot(x, y, z);
  if (len < 1e-8) return [0, 0, 0, 1];
  const s = Math.sin(angle / 2) / len;
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}

export type KickPlan = {
  kick: Kick;
  index: number;
  /** Topun kale çizgisindeki yeri. */
  target: V3;
  /** Kalecinin eldivenlerinin gittiği yer (kale düzleminde). */
  guess: { x: number; y: number };
  /** Kaleci topu tutup bırakmıyor mu (ortadaki kurtarış). */
  held: boolean;
  /** Temastan sonraki örnekler (her biri STEP saniye). */
  samples: number;
  pos: Float32Array;
  quat: Float32Array;
  push: Float32Array;
  visible: Uint8Array;
  /** Ağın en çok esnediği an, yer ve miktar (gol değilse null). */
  net: { at: number; x: number; y: number; push: number } | null;
  /** Topun yere çarptığı anlar (tau) ve hızları: toz ve ses için. */
  bounces: { at: number; speed: number; x: number; z: number }[];
  /** Topun panoya çarptığı an (yoksa -1). */
  boardAt: number;
};

/** Şutun bütün yolunu önceden hesaplar: uçuş analitik, temastan sonrası sabit adımlı fizik. */
export function planKick(kick: Kick, index: number): KickPlan {
  const target = kickTarget(kick.x, kick.y);
  const save = kick.result === "kurtardi";
  const guess = save ? { x: target.x, y: target.y } : guessPoint(kick.keeper, guessHeight(index));
  const held = save && kick.third === "orta";
  const n = Math.ceil(SIM_SECONDS / STEP) + 1;
  const plan: KickPlan = { kick, index, target, guess, held, samples: n, pos: new Float32Array(n * 3), quat: new Float32Array(n * 4), push: new Float32Array(n), visible: new Uint8Array(n), net: null, bounces: [], boardAt: -1 };

  // Temas anındaki hız: uçuş eğrisinin sonundaki eğim.
  const bend = kick.curve ?? 0;
  const a = flightPoint(target, 1 - 1e-3, undefined, bend);
  const b = flightPoint(target, 1, undefined, bend);
  const k = 1 / (1e-3 * FLIGHT);
  let vx = (b.x - a.x) * k;
  let vy = (b.y - a.y) * k;
  let vz = (b.z - a.z) * k;
  let px = target.x;
  let py = target.y;
  let pz = target.z;
  let q = flightQuat(target, 1);
  const d = Math.sign(kick.x) || 1;

  if (kick.result === "kurtardi") {
    // Eldivenden seken top yana ve sahaya doğru döner.
    vx = d * 5.2;
    vy = 2.4 + 1.4 * (1 - clamp01(kick.y));
    vz = 5.4;
  } else if (kick.result === "gol" && kick.post) {
    // Direkten içeri: top direğe değip kalenin içine, ağa doğru seker.
    if (Math.abs(kick.x) < 1 - BALL_X - 1e-6) {
      vx *= 0.3;
      vy = -3.4;
      vz = -4.6;
    } else {
      vx = -d * 3.4;
      vy = 0.8;
      vz = -6.2;
    }
  } else if (kick.result === "direk") {
    if (hitsBar(kick.x, kick.y)) {
      const over = kick.y > 1;
      vx *= 0.25;
      vy = over ? 3.6 : -2.2;
      vz = over ? -5 : 7.5;
    } else {
      const outside = Math.abs(kick.x) > 1;
      vx = outside ? d * 4.6 : -d * 3.2;
      vy = 1.1;
      vz = outside ? -5 : 7;
    }
  }

  // Ağın arka yüzü: eğik bir düzlem (altta derin, üstte sığ).
  const slope = Math.hypot(NET_DEPTH_BOTTOM - NET_DEPTH_TOP, GOAL_H);
  const ny = (NET_DEPTH_BOTTOM - NET_DEPTH_TOP) / slope;
  const nz = -GOAL_H / slope;
  const SPRING = 700;
  const DAMP = 38;
  const goal = kick.result === "gol";
  let visible = true;
  let rolling = false;
  let netTouched = false;

  for (let i = 0; i < n; i++) {
    plan.pos[i * 3] = px;
    plan.pos[i * 3 + 1] = py;
    plan.pos[i * 3 + 2] = pz;
    plan.quat.set(q, i * 4);
    plan.visible[i] = visible ? 1 : 0;
    const tau = CONTACT + i * STEP;

    // Adım iki yarıya bölünür: ağ yayı sert olduğundan küçük adım daha dengelidir.
    for (let h = 0; h < 2; h++) {
      const dt = STEP / 2;
      let ax = 0;
      let ay = rolling ? 0 : -GRAVITY;
      let az = 0;
      let touching = false;
      if (goal && pz < BALL_R) {
        const s = py * ny + (pz + NET_DEPTH_BOTTOM) * nz + BALL_R;
        if (s > 0) {
          const f = Math.max(0, SPRING * s + DAMP * (vy * ny + vz * nz));
          ay -= f * ny;
          az -= f * nz;
          touching = true;
          plan.push[i] = Math.max(plan.push[i], s);
          if (!plan.net || s > plan.net.push) plan.net = { at: tau, x: px, y: py, push: s };
        }
        const side = Math.abs(px) + BALL_R - GOAL_HALF;
        if (side > 0) {
          ax -= Math.sign(px) * Math.max(0, SPRING * side + DAMP * vx * Math.sign(px));
          touching = true;
        }
        const roof = py + BALL_R - GOAL_H;
        if (roof > 0) {
          ay -= Math.max(0, SPRING * roof + DAMP * vy);
          touching = true;
        }
      }
      vx += ax * dt;
      vy += ay * dt;
      vz += az * dt;
      if (touching) {
        netTouched = true;
        const drag = 1 - 5 * dt;
        vx *= drag;
        vy *= drag;
        vz *= drag;
      }
      // Ağdan dönen top kale çizgisini geçip sahaya çıkmasın.
      if (goal && netTouched && vz > 0 && pz > -0.9) vz *= 1 - 9 * dt;
      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;

      if (py < BALL_R) {
        py = BALL_R;
        if (vy < -0.9) {
          plan.bounces.push({ at: tau, speed: -vy, x: px, z: pz });
          vy = -vy * 0.46;
          vx *= 0.82;
          vz *= 0.82;
        } else {
          vy = 0;
          rolling = true;
        }
      }
      if (rolling) {
        const friction = 1 - (goal ? 2.6 : 1.3) * dt;
        vx *= friction;
        vz *= friction;
      }
      // Reklam panosu
      if (!goal && vz < 0 && pz - BALL_R < BOARD_Z && pz - BALL_R > BOARD_Z - 0.6 && py < BOARD_H + BALL_R) {
        pz = BOARD_Z + BALL_R;
        vz = -vz * 0.32;
        vx *= 0.6;
        if (plan.boardAt < 0) plan.boardAt = tau;
      }
      // Tribüne giden topu taraftar tutar.
      if (pz < STAND_Z && py < standHeightAt(pz) + BALL_R * 2) visible = false;
      if (Math.abs(px) > 40 || pz < -60) visible = false;
    }

    // Yuvarlanma: top gittiği yöne doğru döner (havada daha yavaş).
    const speed = Math.hypot(vx, vz);
    if (speed > 0.05) {
      const spin = (speed / BALL_R) * (rolling ? 1 : 0.4) * STEP;
      q = quatMul(quatAxis(vz, 0, -vx, spin), q);
      const len = Math.hypot(q[0], q[1], q[2], q[3]);
      q = [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
    }
  }
  return plan;
}

/** Uçuştaki dönüş: top gittiği yöne doğru iki buçuk tur atar. */
function flightQuat(target: V3, u: number): Quat {
  const dx = target.x - SPOT.x;
  const dz = target.z - SPOT.z;
  return quatAxis(dz, 0, -dx, clamp01(u) * Math.PI * 5);
}

export type BallState = { p: V3; q: Quat; visible: boolean; held: boolean; phase: "spot" | "flight" | "loose" };

/** Topun verilen andaki yeri ve dönüşü. `held` ise top eldivenlerdedir, yeri motor belirler. */
export function ballAt(plan: KickPlan, tau: number, out: BallState): BallState {
  if (tau < STRIKE) {
    out.p.x = SPOT.x;
    out.p.y = SPOT.y;
    out.p.z = SPOT.z;
    out.q = [0, 0, 0, 1];
    out.visible = true;
    out.held = false;
    out.phase = "spot";
    return out;
  }
  if (tau <= CONTACT) {
    const u = (tau - STRIKE) / FLIGHT;
    flightPoint(plan.target, u, out.p, plan.kick.curve ?? 0);
    out.q = flightQuat(plan.target, u);
    out.visible = true;
    out.held = false;
    out.phase = "flight";
    return out;
  }
  const f = Math.min(plan.samples - 1.001, (tau - CONTACT) / STEP);
  const i = Math.floor(f);
  const t = f - i;
  out.p.x = lerp(plan.pos[i * 3], plan.pos[i * 3 + 3], t);
  out.p.y = lerp(plan.pos[i * 3 + 1], plan.pos[i * 3 + 4], t);
  out.p.z = lerp(plan.pos[i * 3 + 2], plan.pos[i * 3 + 5], t);
  out.q = [plan.quat[i * 4], plan.quat[i * 4 + 1], plan.quat[i * 4 + 2], plan.quat[i * 4 + 3]];
  out.visible = plan.visible[i] === 1;
  out.held = plan.held;
  out.phase = "loose";
  return out;
}

/** Ağın verilen andaki esnemesi: top bastırırken itme, bıraktıktan sonra sönen bir dalga. */
export function netBulgeAt(plan: KickPlan, tau: number): { x: number; y: number; amount: number } | null {
  const net = plan.net;
  if (!net || tau < CONTACT) return null;
  const i = Math.min(plan.samples - 1, Math.floor((tau - CONTACT) / STEP));
  const after = tau - net.at;
  const ripple = after > 0 ? net.push * 0.45 * Math.exp(-3.2 * after) * Math.cos(19 * after) : 0;
  const amount = Math.max(plan.push[i], 0) + ripple;
  if (Math.abs(amount) < 0.004 && after > 1.6) return null;
  return { x: net.x, y: net.y, amount };
}

// ---------------------------------------------------------------------------------------------
// Kaleci
// ---------------------------------------------------------------------------------------------

export type KeeperPose = {
  hip: V3;
  /** Gövdenin kale düzleminde yatması: 0 dik, +90° sağa (+x) yatık. */
  roll: number;
  /** Eldiven hedefleri (dünya). null ise `handsLocal` gövdeye göre kullanılır. */
  hands: [V3, V3] | null;
  handsLocal: [V3, V3] | null;
  mouth: "focus" | "shock" | "grin";
  grounded: boolean;
  /** Yere düştü mü (toz ve ses bir kez çalsın diye). */
  landed: boolean;
  /** Top eldivenlerinde mi. */
  holding: boolean;
  /** Havadaki esneme: 0 toplu, 1 tam uzanmış. */
  stretch: number;
};

/**
 * Kalecinin uçuşu: eldivenlerin hedefe ulaşması için kalçanın nerede ve gövdenin ne kadar yatık
 * olması gerektiği. Ortaya gelen topa atlamaz; yerinde uzanır, çöker ya da zıplar.
 */
export function divePose(g: { x: number; y: number }): { hip: { x: number; y: number }; angle: number; centre: boolean } {
  const dx = g.x;
  const dy = g.y - KEEPER_HIP_Y;
  if (Math.abs(dx) < 1.5) {
    const angle = clamp(dx / 4.3, -0.35, 0.35);
    return { hip: { x: g.x - Math.sin(angle) * KEEPER_REACH, y: Math.max(KEEPER_HIP_Y - 0.42, g.y - Math.cos(angle) * KEEPER_REACH) }, angle, centre: true };
  }
  const limit = (100 * Math.PI) / 180;
  const angle = clamp(Math.atan2(dx, dy), -limit, limit);
  return { hip: { x: g.x - Math.sin(angle) * KEEPER_REACH, y: Math.max(0.32, g.y - Math.cos(angle) * KEEPER_REACH) }, angle, centre: false };
}

const mixV = (a: V3, b: V3, t: number): V3 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
/** Dik duran kalecide dünya hedefinin gövdeye göre yaklaşık yeri (ortadaki kurtarışta sarılmaya geçiş için). */
const localHold = (hip: V3, g: V3, dx: number): V3 => ({ x: g.x - hip.x + dx, y: g.y - hip.y, z: g.z - hip.z });

const READY_HANDS: [V3, V3] = [
  { x: -0.5, y: 0.2, z: 0.22 },
  { x: 0.5, y: 0.2, z: 0.22 },
];
export const KEEPER_READY_HANDS = READY_HANDS;

const HANDS_UP: [V3, V3] = [
  { x: -0.11, y: 1.14, z: 0.12 },
  { x: 0.11, y: 1.14, z: 0.12 },
];
const HANDS_HUG: [V3, V3] = [
  { x: -0.13, y: 0.3, z: 0.3 },
  { x: 0.13, y: 0.3, z: 0.3 },
];
const HANDS_DOWN: [V3, V3] = [
  { x: -0.34, y: 0.02, z: 0.1 },
  { x: 0.34, y: 0.02, z: 0.1 },
];

export function keeperAt(plan: KickPlan, tau: number): KeeperPose {
  const save = plan.kick.result === "kurtardi";
  const dest = divePose(plan.guess);
  const p = clamp01((tau - DIVE_START) / (CONTACT - DIVE_START));
  const e = easeOut(p);
  const crouch = clamp01((tau - (DIVE_START - 0.1)) / 0.1) * (1 - p);
  const hip: V3 = {
    x: lerp(0, dest.hip.x, e),
    y: lerp(KEEPER_HIP_Y - 0.1 - 0.16 * crouch, dest.hip.y, e) + Math.sin(Math.PI * p) * (dest.centre ? 0.05 : 0.2),
    z: KEEPER_Z + (dest.centre ? 0.1 : 0.45) * e,
  };
  let roll = lerp(0, dest.angle, e);
  const g: V3 = { x: plan.guess.x, y: plan.guess.y, z: hip.z + 0.25 };
  // Eldivenler topu iki yandan kavrar: gövdenin eksenine dik, biraz aralıklı.
  const spread = 0.11;
  let hands: [V3, V3] | null = [
    { x: g.x - spread * Math.cos(roll), y: g.y + spread * Math.sin(roll), z: g.z },
    { x: g.x + spread * Math.cos(roll), y: g.y - spread * Math.sin(roll), z: g.z },
  ];
  let handsLocal: [V3, V3] | null = null;
  // Hamleden önce eller hazır bekler, hamleyle birlikte hedefe uzanır.
  if (p <= 0) {
    hands = null;
    handsLocal = READY_HANDS;
  }
  let mouth: KeeperPose["mouth"] = "focus";
  let grounded = dest.centre && dest.hip.y < KEEPER_HIP_Y + 0.05;
  if (p <= 0) grounded = true;
  let landed = false;
  let holding = false;
  let stretch = dest.centre ? 0 : e;

  const after = tau - CONTACT;
  if (after > 0) {
    mouth = save ? "grin" : "shock";
    if (dest.centre) {
      const back = easeInOut(clamp01(after / 0.45));
      hip.x = dest.hip.x;
      hip.y = lerp(dest.hip.y, KEEPER_HIP_Y - 0.04, back);
      grounded = back > 0.5 || grounded;
      if (save) {
        holding = true;
        // Topu göğsüne çeker.
        const hug = easeOut(clamp01(after / 0.3));
        hands = null;
        handsLocal = [mixV(localHold(hip, g, -spread), HANDS_HUG[0], hug), mixV(localHold(hip, g, spread), HANDS_HUG[1], hug)];
      } else if (after > 0.25) {
        hands = null;
        handsLocal = HANDS_DOWN;
      }
    } else {
      const side = Math.sign(dest.angle);
      const fall = easeIn(clamp01(after / 0.4));
      const slide = easeOut(clamp01((after - 0.4) / 0.5));
      roll = lerp(dest.angle, (side * 98 * Math.PI) / 180, fall);
      hip.x = dest.hip.x + side * (0.3 * fall + 0.35 * slide);
      hip.y = lerp(dest.hip.y, 0.3, fall);
      landed = after > 0.4;
      grounded = false;
      stretch = 1 - 0.25 * slide;
      hands = null;
      handsLocal = HANDS_UP;
    }
  }
  return { hip, roll, hands, handsLocal, mouth, grounded, landed, holding, stretch };
}

// ---------------------------------------------------------------------------------------------
// Şutçu
// ---------------------------------------------------------------------------------------------

export type KickerMotion = {
  /** Kalçanın altındaki zemin noktası ve kalça yüksekliği (dünya). */
  x: number;
  z: number;
  hip: number;
  yaw: number;
  /**
   * Uzuv hedefleri gövde koordinatında: x karakterin +x yanı, z baktığı yön, y yerden yükseklik.
   * `L` karakter size bakarken sizin solunuzdaki uzuvdur; sırtı dönük şutçuda sağ ayaktır (vuran ayak).
   */
  footL: V3;
  footR: V3;
  handL: V3;
  handR: V3;
  lean: number;
  twist: number;
  toeL: number;
};

/** Karakterin dik dururken kalça yüksekliği (ölçeksiz) ve ayak bileği yüksekliği. */
const STAND = 0.8;
const ANKLE = 0.07;

/** Koşu ve vuruş: tau=0 koşuya başlar, STRIKE'ta topa vurur, sonra dengesini bulur. */
export function kickerStrike(tau: number, target: V3, scale: number): KickerMotion {
  const run = clamp01(tau / STRIKE);
  const e = easeInOut(run);
  const x = lerp(KICKER_READY.x, KICKER_STRIKE.x, e);
  const z = lerp(KICKER_READY.z, KICKER_STRIKE.z, e);
  // Koşarken gittiği yöne, vururken hedefe bakar.
  const runYaw = Math.atan2(KICKER_STRIKE.x - KICKER_READY.x, KICKER_STRIKE.z - KICKER_READY.z);
  const aimYaw = Math.atan2(clamp(target.x, -5, 5) * 0.35 - KICKER_STRIKE.x, -KICKER_STRIKE.z);
  const turn = easeInOut(clamp01((tau - (STRIKE - 0.14)) / 0.2));
  const yaw = lerpAngle(runYaw, aimYaw, turn);

  const stand = STAND * scale;
  const ground = ANKLE * scale;
  const hx = 0.1 * scale;
  let hip = stand;
  let footL: V3 = { x: -hx, y: ground, z: 0 };
  let footR: V3 = { x: hx, y: ground, z: 0 };
  let handL: V3 = { x: -0.3 * scale, y: stand + 0.02, z: 0.05 };
  let handR: V3 = { x: 0.3 * scale, y: stand + 0.02, z: 0.05 };
  let lean = 0.12;
  let twist = 0;
  let toeL = 0;

  // Topun şutçuya göre yeri (gövde koordinatı).
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const wx = SPOT.x - x;
  const wz = SPOT.z - z;
  const ball = { x: wx * cos - wz * sin, z: wx * sin + wz * cos };

  const windup = STRIKE - 0.15;
  if (tau < windup) {
    // İki hızlı adım.
    const ph = (tau / windup) * Math.PI * 2;
    const stride = 0.34 * scale;
    footL = { x: -hx, y: ground + Math.max(0, Math.sin(ph)) * 0.2 * scale, z: Math.cos(ph) * stride };
    footR = { x: hx, y: ground + Math.max(0, -Math.sin(ph)) * 0.2 * scale, z: -Math.cos(ph) * stride };
    handL = { x: -0.32 * scale, y: stand + 0.08, z: -Math.cos(ph) * 0.28 * scale };
    handR = { x: 0.32 * scale, y: stand + 0.08, z: Math.cos(ph) * 0.28 * scale };
    hip = stand - 0.04 * scale + Math.abs(Math.sin(ph)) * 0.04 * scale;
    lean = 0.28;
  } else {
    // Destek ayağı topun yanına basar; vuran ayak geriye açılır, toptan geçer, yukarı savrulur.
    const backAt = STRIKE - 0.06;
    const throughAt = STRIKE + 0.16;
    const downAt = STRIKE + 0.52;
    const back: V3 = { x: -hx * 1.3, y: ground + 0.5 * scale, z: -0.56 * scale };
    const hit: V3 = { x: ball.x, y: BALL_R * 0.9, z: ball.z - BALL_R * 0.8 };
    const through: V3 = { x: ball.x * 0.5, y: ground + 0.82 * scale, z: ball.z + 0.52 * scale };
    const rest: V3 = { x: -hx, y: ground, z: 0.06 * scale };
    const start: V3 = { x: -hx, y: ground, z: -0.3 * scale };
    footR = { x: hx, y: ground, z: 0.04 * scale };
    if (tau < backAt) {
      const k = easeOut((tau - windup) / (backAt - windup));
      footL = mixV(start, back, k);
      lean = lerp(0.28, 0.1, k);
      twist = 0.35 * k;
      toeL = 0.5 * k;
    } else if (tau < STRIKE) {
      const k = easeIn((tau - backAt) / (STRIKE - backAt));
      footL = mixV(back, hit, k);
      lean = lerp(0.1, -0.05, k);
      twist = lerp(0.35, -0.1, k);
      toeL = 0.7;
    } else if (tau < throughAt) {
      const k = easeOut((tau - STRIKE) / (throughAt - STRIKE));
      footL = mixV(hit, through, k);
      lean = lerp(-0.05, -0.3, k);
      twist = lerp(-0.1, -0.45, k);
      toeL = 0.7;
      hip = stand + 0.07 * scale * k;
    } else {
      const k = easeInOut(clamp01((tau - throughAt) / (downAt - throughAt)));
      footL = mixV(through, rest, k);
      lean = lerp(-0.3, 0.04, k);
      twist = lerp(-0.45, 0, k);
      toeL = 0.7 * (1 - k);
      hip = stand + 0.07 * scale * (1 - k);
    }
    // Kollar denge için açılır: vuran ayağın çaprazındaki kol öne ve yana.
    const open = clamp01((tau - windup) / 0.12) * (1 - clamp01((tau - throughAt) / (downAt - throughAt)));
    handL = mixV(handL, { x: -0.5 * scale, y: stand + 0.22 * scale, z: -0.3 * scale }, open);
    handR = mixV(handR, { x: 0.56 * scale, y: stand + 0.42 * scale, z: 0.16 * scale }, open);
  }
  return { x, z, hip, yaw, footL, footR, handL, handR, lean, twist, toeL };
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Tekrar gösteriminde geçen süreden şut zamanına (tau). */
export const replayTau = (elapsed: number) => Math.min(REPLAY.to, REPLAY.from + elapsed * REPLAY.speed);

