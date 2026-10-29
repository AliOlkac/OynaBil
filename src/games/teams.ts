import type { Team, TeamColor } from "./types";

/**
 * Takımlar uzaktan ayırt edilebilsin diye renk + şekil taşır.
 * Kırmızı-yeşil renk körlüğünde de şekil (yıldız, altıgen, daire, baklava) farkı kalır.
 */
export const TEAM_STYLES: Record<
  TeamColor,
  { label: string; base: string; deep: string; soft: string; emblem: "yildiz" | "altigen" | "daire" | "baklava" }
> = {
  kobalt: { label: "Mavi", base: "var(--color-kobalt)", deep: "var(--color-kobalt-deep)", soft: "rgb(90 150 255 / 0.16)", emblem: "yildiz" },
  mercan: { label: "Kırmızı", base: "var(--color-mercan)", deep: "var(--color-mercan-deep)", soft: "rgb(255 107 79 / 0.16)", emblem: "altigen" },
  zumrut: { label: "Yeşil", base: "var(--color-zumrut)", deep: "var(--color-zumrut-deep)", soft: "rgb(52 199 132 / 0.16)", emblem: "daire" },
  kehribar: { label: "Sarı", base: "var(--color-kehribar)", deep: "var(--color-kehribar-deep)", soft: "rgb(255 194 61 / 0.16)", emblem: "baklava" },
};

export const TEAM_ORDER: TeamColor[] = ["kobalt", "mercan", "zumrut", "kehribar"];

export function defaultTeams(count: number): Team[] {
  return TEAM_ORDER.slice(0, count).map((color) => ({
    id: color,
    name: `${TEAM_STYLES[color].label} Takım`,
    color,
  }));
}
