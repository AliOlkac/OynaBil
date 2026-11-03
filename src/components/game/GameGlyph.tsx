import { TeamEmblem } from "@/components/ui/TeamEmblem";

/** Oyunların küçük simgeleri: sistemin kendi parçalarından (takım amblemleri, ip) çizilir. */
export function GameGlyph({ id, selected = false }: { id: string; selected?: boolean }) {
  const ring = selected ? "bg-ink-900" : "bg-ink-900/60";
  if (id === "halat-cekme") {
    return (
      <span className={`grid size-14 shrink-0 place-items-center rounded-lg ${ring}`} aria-hidden>
        <svg viewBox="0 0 48 48" className="size-11">
          <rect x="4" y="22" width="40" height="4" rx="2" fill="#c9a061" />
          <rect x="22" y="14" width="4" height="20" rx="2" fill="var(--color-cream)" />
          <circle cx="8" cy="24" r="6" fill="var(--color-kobalt)" />
          <circle cx="40" cy="24" r="6" fill="var(--color-mercan)" />
        </svg>
      </span>
    );
  }
  if (id === "kule-yikmaca") {
    return (
      <span className={`grid size-14 shrink-0 place-items-center rounded-lg ${ring}`} aria-hidden>
        <svg viewBox="0 0 48 48" className="size-11">
          <path d="M6 44 Q 20 2 40 18" fill="none" stroke="var(--color-cream)" strokeWidth={2.5} strokeDasharray="3 4" strokeLinecap="round" />
          <rect x="30" y="20" width="14" height="24" rx="1.5" fill="var(--color-tas)" />
          <path d="M29 20 h4 v-4 h3 v4 h2 v-4 h3 v4 h4 v3 h-16 Z" fill="var(--color-tas-acik)" />
          <path d="M34 33 a3 3 0 0 1 6 0 v4 h-6 Z" fill="var(--color-kehribar)" />
          <circle cx="6" cy="40" r="4.5" fill="var(--color-mercan)" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`grid size-14 shrink-0 grid-cols-2 gap-1 rounded-lg p-2.5 ${ring}`} aria-hidden>
      {(["kobalt", "mercan", "zumrut", "kehribar"] as const).map((c) => (
        <TeamEmblem key={c} color={c} className="size-full" />
      ))}
    </span>
  );
}
