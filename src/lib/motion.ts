/**
 * Hareket belirteçleri. Bütün animasyonlar buradan beslenir (CSS tarafı: globals.css'teki --dur-*).
 * Kural: arayüz hızlı ve kuru; yaylı taşma yalnızca kutlama anlarında (puan, doğru cevap) ve ipte.
 */
export const ease = [0.22, 1, 0.36, 1] as const;

export const dur = { fast: 0.15, base: 0.25, slow: 0.4 } as const;

/** Sıralı girişlerde öğeler arası gecikme. */
export const stagger = 0.06;

export const spring = {
  /** Seçim zemini, anahtar, pencere: taşmadan yerine oturur. */
  ui: { type: "spring", stiffness: 420, damping: 36 },
  /** Liste ve kart girişleri. */
  enter: { type: "spring", stiffness: 320, damping: 30 },
  /** Kutlama: puan artışı, doğru cevap rozeti, geri sayım rakamı. */
  celebrate: { type: "spring", stiffness: 400, damping: 18 },
  /** İpin çekilmesi: ağır ve yaylı, sınıfın görmesi için. */
  rope: { type: "spring", stiffness: 160, damping: 16 },
} as const;
