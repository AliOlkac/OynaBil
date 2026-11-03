/**
 * Sahnelerdeki çocukların ortak görünüşü: ten, saç, kıyafet renkleri ve baş çizimi.
 * Halat Çekme ile Kule Yıkmaca aynı karakter tasarımını kullanır.
 */

export const SKIN = ["#f1c7a1", "#d6a27a", "#b07650", "#8a5636"];
export const HAIR = ["#2a1b12", "#5a3720", "#16161d", "#7a4520", "#3b2416"];
export const STYLES = ["short", "ponytail", "curly", "bun"] as const;
export const PANTS = "#22304f";
export const SHOE = "#f3ead8";
export const DARK = "#1a1420";

export type HairStyle = (typeof STYLES)[number];
export type KidLook = { skin: string; hair: string; style: HairStyle };

/**
 * Baş: yerel koordinatta merkez (0,0), yüz +x yönüne bakar.
 * Ağız ve yanak `data-part` ile işaretlidir; sahne döngüsü ifadeyi opaklıkla değiştirir.
 */
export function Head({ look }: { look: KidLook }) {
  const hairBack =
    look.style === "ponytail" ? (
      <g fill={look.hair}>
        <ellipse cx={-23} cy={-1} rx={10} ry={6} transform="rotate(-25 -23 -1)" />
        <circle cx={-15} cy={-5} r={4} fill="var(--color-mercan)" />
      </g>
    ) : look.style === "bun" ? (
      <circle cx={-9} cy={-19} r={8.5} fill={look.hair} />
    ) : null;
  const hairTop =
    look.style === "curly" ? (
      <g fill={look.hair}>
        <circle cx={-11} cy={-10} r={9} />
        <circle cx={-2} cy={-15} r={9} />
        <circle cx={8} cy={-14} r={7.5} />
        <circle cx={-16} cy={0} r={7} />
        <circle cx={14} cy={-8} r={5} />
      </g>
    ) : (
      <path d="M-17 4 C-19 -12 -7 -20 3 -19 C11 -18 17 -12 17.5 -5 C10 -8 4 -9 -2 -7 C-7 -4 -10 1 -12 7 Z" fill={look.hair} />
    );
  return (
    <>
      {hairBack}
      <circle r={17} fill={look.skin} />
      {hairTop}
      <circle cx={-4} cy={2} r={4} fill={look.skin} stroke="rgb(0 0 0 / 0.12)" strokeWidth={1.5} />
      <ellipse cx={9} cy={-3} rx={2.3} ry={3.1} fill={DARK} />
      <path d="M4.5 -9.5 L13 -7.5" stroke={DARK} strokeWidth={2.6} strokeLinecap="round" />
      <circle data-part="cheek" cx={6} cy={5} r={3.8} fill="var(--color-mercan)" opacity={0.3} />
      <g data-part="mouthGrit">
        <rect x={7} y={6} width={9} height={5} rx={1.5} fill="#fff" stroke={DARK} strokeWidth={1.6} />
        <line x1={7.5} y1={8.5} x2={15.5} y2={8.5} stroke={DARK} strokeWidth={1} />
      </g>
      <ellipse data-part="mouthOpen" cx={11.5} cy={9} rx={3.6} ry={4.4} fill={DARK} opacity={0} />
      <path data-part="mouthSmile" d="M5.5 6 Q 11 14 16 5.5 Z" fill={DARK} opacity={0} />
      <path data-part="mouthCalm" d="M7 8.5 L14 8" stroke={DARK} strokeWidth={2.2} strokeLinecap="round" opacity={0} />
    </>
  );
}
