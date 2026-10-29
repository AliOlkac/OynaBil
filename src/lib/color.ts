/** `var(--color-x)` biçimindeki bir belirteci gerçek renge çevirir. Canvas tabanlı efektler (konfeti) CSS değişkeni okuyamaz. */
export function cssColor(value: string): string {
  if (typeof window === "undefined" || !value.startsWith("var(")) return value;
  return getComputedStyle(document.documentElement).getPropertyValue(value.slice(4, -1)).trim() || value;
}
