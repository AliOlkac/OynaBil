"use client";

import { useEffect } from "react";

/** Yalnızca derlenmiş sürümde kaydolur; geliştirme sırasında önbellek karışıklığı yaratmaz. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // çevrimdışı destek olmadan da uygulama çalışır
    });
  }, []);
  return null;
}
