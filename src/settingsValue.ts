/** DSH 0.1.7 volatile config values are references exposing `get()`. */
export interface SettingReference<T> {
  get(): T
}

export type SettingValue<T> = T | SettingReference<T>

/** Read one plain or DSH volatile setting value. */
export function readSetting<T>(value: SettingValue<T> | unknown): T {
  if (
    value !== null
    && typeof value === 'object'
    && 'get' in value
    && typeof (value as SettingReference<unknown>).get === 'function'
  ) {
    return readSetting<T>((value as SettingReference<unknown>).get())
  }
  return value as T
}

export function stringSetting(value: SettingValue<string> | unknown): string {
  const resolved = readSetting(value)
  return typeof resolved === 'string'
    ? resolved
    : typeof resolved === 'number' || typeof resolved === 'boolean'
      ? String(resolved)
      : ''
}

export function booleanSetting(value: SettingValue<boolean> | unknown): boolean {
  const resolved = readSetting(value)
  return resolved === true || resolved === 'true'
}

export function numberSetting(value: SettingValue<number> | unknown, fallback: number): number {
  const resolved = readSetting(value)
  const numeric = typeof resolved === 'number' ? resolved : Number(resolved)
  return Number.isFinite(numeric) ? numeric : fallback
}
