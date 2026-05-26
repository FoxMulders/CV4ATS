'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import type { ResumeFileParseState } from '@/components/wizard/resume-input-step'
import { loadSavedResume, saveResume } from '@/lib/resume/saved-resume'

export function useSavedResume(
  resumeText: string,
  setResumeText: (value: string) => void,
  fileParse: ResumeFileParseState
) {
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true

    const saved = loadSavedResume()
    if (saved.trim()) {
      setResumeText(saved)
      toast.message('Restored your last resume from this browser')
    }
  }, [setResumeText])

  useEffect(() => {
    const textToSave =
      resumeText.trim() ||
      (fileParse.status === 'ready' ? fileParse.parsedText.trim() : '')

    const timer = window.setTimeout(() => saveResume(textToSave), 800)
    return () => window.clearTimeout(timer)
  }, [resumeText, fileParse])
}
