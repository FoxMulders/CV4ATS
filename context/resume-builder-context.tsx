'use client'

import { createContext, useContext, type ReactNode } from 'react'

import {
  useResumeBuilderState,
  type UseResumeBuilderStateOptions,
  type UseResumeBuilderStateResult,
} from '@/hooks/use-resume-builder-state'

const ResumeBuilderContext = createContext<UseResumeBuilderStateResult | null>(null)

export interface ResumeBuilderProviderProps extends UseResumeBuilderStateOptions {
  children: ReactNode
}

export function ResumeBuilderProvider({
  children,
  jobDescription,
  sourceText,
}: ResumeBuilderProviderProps) {
  const value = useResumeBuilderState({ jobDescription, sourceText })

  return (
    <ResumeBuilderContext.Provider value={value}>{children}</ResumeBuilderContext.Provider>
  )
}

export function useResumeBuilder(): UseResumeBuilderStateResult {
  const context = useContext(ResumeBuilderContext)
  if (!context) {
    throw new Error('useResumeBuilder must be used within ResumeBuilderProvider')
  }
  return context
}
