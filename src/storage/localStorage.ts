export function loadJson<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => T | undefined
): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw) as unknown

    return validate ? (validate(parsed) ?? fallback) : (parsed as T)
  } catch {
    return fallback
  }
}

export function saveJson<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value))
}
