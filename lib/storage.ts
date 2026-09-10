// Tiny localStorage wrapper used ONLY by the mock API layer (lib/api.ts).
// A real backend removes this file entirely — nothing outside lib/api.ts
// should ever import it directly.

const PREFIX = "raneems_";

export function readCollection<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

export function writeCollection<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREFIX + key) === "true";
}

export function writeFlag(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(PREFIX + key, "true");
  else window.localStorage.removeItem(PREFIX + key);
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => window.localStorage.removeItem(k));
}
