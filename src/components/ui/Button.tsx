import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "md" | "lg" | "xl";

const VARIANTS: Record<Variant, { className: string; edge?: string }> = {
  primary: { className: "bg-kehribar text-ink-950 disabled:bg-ink-700 disabled:text-ink-400", edge: "var(--color-kehribar-deep)" },
  secondary: { className: "bg-ink-700 text-cream disabled:text-ink-400", edge: "var(--color-ink-950)" },
  danger: { className: "bg-mercan text-ink-950", edge: "var(--color-mercan-deep)" },
  quiet: { className: "text-ink-300 hover:bg-ink-800 hover:text-cream active:bg-ink-700 disabled:opacity-40" },
};

const SIZES: Record<Size, string> = {
  md: "h-12 gap-2 rounded-md px-5 text-base",
  lg: "h-16 gap-3 rounded-lg px-7 text-xl",
  xl: "h-20 gap-3 rounded-xl px-10 text-2xl",
};

type StyleProps = { variant?: Variant; size?: Size; icon?: ReactNode; iconAfter?: boolean };

function look({ variant = "secondary", size = "md", className = "", style }: StyleProps & { className?: string; style?: CSSProperties }) {
  const v = VARIANTS[variant];
  return {
    className: `inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors ${v.edge ? "pressable" : ""} ${
      v.className
    } ${SIZES[size]} ${className}`,
    style: v.edge ? ({ "--edge": v.edge, ...style } as CSSProperties) : style,
  };
}

export function Button({
  variant,
  size,
  icon,
  iconAfter,
  children,
  className,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & StyleProps) {
  return (
    <button type="button" {...rest} {...look({ variant, size, className, style })}>
      {!iconAfter && icon}
      {children}
      {iconAfter && icon}
    </button>
  );
}

/** Bir sayfaya giden düğme. Bağlantının içine düğme koymak yerine bağlantının kendisi düğme gibi görünür. */
export function ButtonLink({ variant, size, icon, iconAfter, children, className, style, ...rest }: ComponentProps<typeof Link> & StyleProps) {
  return (
    <Link {...rest} {...look({ variant, size, className, style })}>
      {!iconAfter && icon}
      {children}
      {iconAfter && icon}
    </Link>
  );
}
