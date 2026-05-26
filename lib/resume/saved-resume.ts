export const SAVED_RESUME_STORAGE_KEY = 'ats4cv-resume-text'

export function loadSavedResume(): string {
  if (typeof window === 'undefined') return ''

  try {
    return window.localStorage.getItem(SAVED_RESUME_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveResume(text: string): void {
  if (typeof window === 'undefined') return

  try {
    const trimmed = text.trim()
    if (trimmed) {
      window.localStorage.setItem(SAVED_RESUME_STORAGE_KEY, trimmed)
    } else {
      window.localStorage.removeItem(SAVED_RESUME_STORAGE_KEY)
    }
  } catch {
    // Quota exceeded or private browsing — ignore.
  }
}

export function clearSavedResume(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(SAVED_RESUME_STORAGE_KEY)
  } catch {
    // ignore
  }
}
