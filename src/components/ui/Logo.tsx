/** OynaBil yazısı: "Oyna" krem, "Bil" firuze; başta sekiz köşeli yıldızdan bir oynat işareti. */
export function Logo({ className = "text-2xl" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.35em] font-bold tracking-tight ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-[1.15em]">
        <polygon
          points="12,0.5 15.2,4.3 20.1,3.9 19.7,8.8 23.5,12 19.7,15.2 20.1,20.1 15.2,19.7 12,23.5 8.8,19.7 3.9,20.1 4.3,15.2 0.5,12 4.3,8.8 3.9,3.9 8.8,4.3"
          fill="var(--color-firuze)"
        />
        <path d="M10 8.2v7.6l6-3.8z" fill="var(--color-ink-950)" />
      </svg>
      <span>
        Oyna<span className="text-firuze">Bil</span>
      </span>
    </span>
  );
}
