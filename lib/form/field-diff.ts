export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => valuesEqual(item, b[index]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aRecord = a as Record<string, unknown>
    const bRecord = b as Record<string, unknown>
    const keys = new Set([...Object.keys(aRecord), ...Object.keys(bRecord)])
    for (const key of keys) {
      if (!valuesEqual(aRecord[key], bRecord[key])) return false
    }
    return true
  }
  return false
}

export function isFieldEdited(
  current: unknown,
  baseline: unknown
): boolean {
  return !valuesEqual(current, baseline)
}

export function cloneFormValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value
  return structuredClone(value)
}
