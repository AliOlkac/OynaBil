"use client";

import type { ReactNode } from "react";
import { useIsClient } from "@/lib/hooks";

/**
 * Tarayıcı belleğine (kayıtlı kurulum, yarım kalan oyun) bağlı ekranlar yalnızca
 * tarayıcıda çizilir; böylece durağan HTML ile ilk çizim arasında uyuşmazlık olmaz.
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  return useIsClient() ? children : fallback;
}
