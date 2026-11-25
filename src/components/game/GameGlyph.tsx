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
  if (id === "penalti") {
    return (
      <span className={`grid size-14 shrink-0 place-items-center rounded-lg ${ring}`} aria-hidden>
        <svg viewBox="0 0 48 48" className="size-11">
          <path d="M5 30 V10 H43 V30" fill="none" stroke="var(--color-cream)" strokeWidth={3} strokeLinejoin="round" />
          <path d="M9 13 H39 M9 18 H39 M9 23 H39 M14 10 V30 M22 10 V30 M30 10 V30 M38 10 V30" stroke="var(--color-cream)" strokeWidth={1} opacity={0.4} />
          <rect x="18" y="16" width="10" height="14" rx="3" fill="var(--color-kehribar)" />
          <circle cx="34" cy="38" r="6" fill="var(--color-cream)" />
          <path d="M34 34.5 L36.5 36.5 L35.5 39.5 H32.5 L31.5 36.5 Z" fill="var(--color-ink-950)" />
        </svg>
      </span>
    );
  }
  if (id === "basketbol") {
    return (
      <span className={`grid size-14 shrink-0 place-items-center rounded-lg ${ring}`} aria-hidden>
        <svg viewBox="0 0 48 48" className="size-11">
          <rect x="24" y="6" width="18" height="13" rx="1.5" fill="var(--color-cream)" stroke="var(--color-mercan)" strokeWidth={2} />
          <path d="M27 20 H39" stroke="var(--color-mercan)" strokeWidth={3} strokeLinecap="round" />
          <path d="M28 21 L30 30 H36 L38 21 M31 21 L32 30 M35 21 L34 30" fill="none" stroke="var(--color-cream)" strokeWidth={1.2} opacity={0.7} />
          <path d="M6 40 Q 12 6 30 16" fill="none" stroke="var(--color-cream)" strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" />
          <circle cx="10" cy="38" r="7" fill="var(--color-ates)" />
          <path d="M3 38 H17 M10 31 V45 M5 33 Q10 38 5 43 M15 33 Q10 38 15 43" fill="none" stroke="var(--color-ink-950)" strokeWidth={1.3} />
        </svg>
      </span>
    );
  }
  if (id === "okculuk") {
    return (
      <span className={`grid size-14 shrink-0 place-items-center rounded-lg ${ring}`} aria-hidden>
        <svg viewBox="0 0 48 48" className="size-11">
          <circle cx="30" cy="20" r="15" fill="var(--color-cream)" />
          <circle cx="30" cy="20" r="12" fill="var(--color-ink-950)" />
          <circle cx="30" cy="20" r="9" fill="var(--color-kobalt)" />
          <circle cx="30" cy="20" r="6" fill="var(--color-mercan)" />
          <circle cx="30" cy="20" r="3" fill="var(--color-kehribar)" />
          <path d="M6 42 L29 21" stroke="var(--color-ahsap-acik)" strokeWidth={2.5} strokeLinecap="round" />
          <path d="M6 42 l-1 -6 l4 2 Z M6 42 l6 1 l-2 -4 Z" fill="var(--color-mercan)" />
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
