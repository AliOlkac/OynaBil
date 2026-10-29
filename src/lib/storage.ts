/**
 * localStorage erişimi her yerde patlayabilir (gizli pencere, kapalı site verisi,
 * okul bilgisayarlarındaki kısıtlı profiller). Uygulama depolama olmadan da çalışır.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // depolama yoksa silinecek bir şey de yoktur
  }
}
