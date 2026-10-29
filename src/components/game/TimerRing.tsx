"use client";

/** Kalan süreyi gösteren halka. Son beş saniyede mercana döner. */
export function TimerRing({
  remainingMs,
  totalMs,
  paused = false,
  className = "size-24",
}: {
  remainingMs: number;
  totalMs: number;
  paused?: boolean;
  className?: string;
}) {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs));
  const urgent = seconds <= 5;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const color = urgent ? "var(--color-mercan)" : "var(--color-firuze)";

  return (
    <div className={`relative grid shrink-0 place-items-center ${className}`} role="timer" aria-label={`${seconds} saniye kaldı`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-ink-700)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          // Halka, sayaçla aynı aralıkta (100 ms) doğrusal ilerler.
          style={{ transition: "stroke-dashoffset 100ms linear, stroke var(--dur-base) var(--ease-out)" }}
        />
      </svg>
      <span className="tabular text-[2.1em] leading-none font-bold" style={{ color: paused ? "var(--color-ink-400)" : urgent ? color : undefined }}>
        {seconds}
      </span>
    </div>
  );
}
