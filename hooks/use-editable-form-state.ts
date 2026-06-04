'use client'

import { useCallback, useMemo, useState } from 'react'

import { cloneFormValue, isFieldEdited, valuesEqual } from '@/lib/form/field-diff'

export interface EditableFormState<T> {
  values: T
  baseline: T
  setValues: (next: T | ((current: T) => T)) => void
  syncBaseline: (nextBaseline: T) => void
  resetToBaseline: () => void
  resetField: <K extends keyof T>(key: K) => void
  isEdited: (path?: string) => boolean
  editedPaths: string[]
  hasEdits: boolean
}

function collectEditedPaths(
  current: unknown,
  baseline: unknown,
  prefix = ''
): string[] {
  const paths: string[] = []

  if (valuesEqual(current, baseline)) return paths

  if (
    current == null ||
    baseline == null ||
    typeof current !== 'object' ||
    typeof baseline !== 'object' ||
    Array.isArray(current) !== Array.isArray(baseline)
  ) {
    if (prefix) paths.push(prefix)
    return paths
  }

  if (Array.isArray(current) && Array.isArray(baseline)) {
    const maxLength = Math.max(current.length, baseline.length)
    for (let index = 0; index < maxLength; index += 1) {
      const childPrefix = prefix ? `${prefix}.${index}` : String(index)
      paths.push(...collectEditedPaths(current[index], baseline[index], childPrefix))
    }
    return paths
  }

  const currentRecord = current as Record<string, unknown>
  const baselineRecord = baseline as Record<string, unknown>
  const keys = new Set([...Object.keys(currentRecord), ...Object.keys(baselineRecord)])

  for (const key of keys) {
    const childPrefix = prefix ? `${prefix}.${key}` : key
    paths.push(
      ...collectEditedPaths(currentRecord[key], baselineRecord[key], childPrefix)
    )
  }

  return paths
}

export function useEditableFormState<T>(initialValue: T): EditableFormState<T> {
  const [baseline, setBaseline] = useState<T>(() => cloneFormValue(initialValue))
  const [values, setValuesState] = useState<T>(() => cloneFormValue(initialValue))
  const [syncedInitialValue, setSyncedInitialValue] = useState(initialValue)

  if (initialValue !== syncedInitialValue) {
    setSyncedInitialValue(initialValue)
    const nextBaseline = cloneFormValue(initialValue)
    setBaseline(nextBaseline)
    setValuesState(nextBaseline)
  }

  const syncBaseline = useCallback((nextBaseline: T) => {
    const cloned = cloneFormValue(nextBaseline)
    setBaseline(cloned)
    setValuesState(cloned)
  }, [])

  const setValues = useCallback((next: T | ((current: T) => T)) => {
    setValuesState((current) => {
      const resolved =
        typeof next === 'function'
          ? (next as (current: T) => T)(current)
          : next
      return cloneFormValue(resolved)
    })
  }, [])

  const resetToBaseline = useCallback(() => {
    setValuesState(cloneFormValue(baseline))
  }, [baseline])

  const resetField = useCallback(<K extends keyof T>(key: K) => {
    setValuesState((current) => ({
      ...current,
      [key]: cloneFormValue(baseline[key]),
    }))
  }, [baseline])

  const editedPaths = useMemo(
    () => collectEditedPaths(values, baseline),
    [values, baseline]
  )

  const isEdited = useCallback(
    (path?: string) => {
      if (!path) return editedPaths.length > 0
      return editedPaths.some(
        (editedPath) => editedPath === path || editedPath.startsWith(`${path}.`)
      )
    },
    [editedPaths]
  )

  return {
    values,
    baseline,
    setValues,
    syncBaseline,
    resetToBaseline,
    resetField,
    isEdited,
    editedPaths,
    hasEdits: editedPaths.length > 0,
  }
}

export { isFieldEdited }
