'use client'

import { useCallback, useMemo, useReducer } from 'react'

import type { TailoredResume } from '@/lib/ai/schemas'
import type { ResumeDocument } from '@/lib/resume/strict-resume-state'
import {
  applyRevisionsToStateSlice,
  auditStateSlicePhrasing,
  mergeTailoredResumeIntoStateSlice,
  createEmptyResumeStateSlice,
  resumeStateSliceReducer,
  resumeTextToStateSlice,
  revisionsToAnchoredModifications,
  stateSliceToResumeText,
  stateSliceToTailoredResume,
  type ResumeRevision,
  type ResumeStateSlice,
} from '@/lib/resume/resume-state-slice'
import { getHydratedDocumentPayloadFromSlice } from '@/lib/resume/hydrated-document-payload'
import type { SkillSnippetSelection } from '@/components/results/editable-skill-snippet-picker'

export interface UseResumeBuilderStateOptions {
  jobDescription?: string
  sourceText?: string | null
}

export interface UseResumeBuilderStateResult {
  state: ResumeStateSlice
  /** Tailored resume view derived from the live document slice. */
  tailoredResume: TailoredResume | null
  /** Exact export payload for PDF/DOCX — always mirrors the slice. */
  documentPayload: ResumeDocument | null
  /** Serialized resume text for API calls and pre-scan. */
  resumeText: string
  anchoredModifications: ReturnType<typeof revisionsToAnchoredModifications>
  onApplyRevisions: (selections: SkillSnippetSelection[]) => ResumeStateSlice
  setFromTailoredResume: (resume: TailoredResume, sourceText?: string) => void
  setFromResumeText: (resumeText: string) => void
  mergeGenerationResult: (resume: TailoredResume, sourceText?: string) => ResumeStateSlice
  patchTailoredResume: (resume: TailoredResume) => void
  reset: () => void
}

function selectionsToRevisions(selections: SkillSnippetSelection[]): ResumeRevision[] {
  return selections.map((selection) => ({
    snippet: selection.snippet,
    positionId: selection.positionId,
    bulletIndex: selection.bulletIndex,
    originalBullet: selection.originalBullet,
    bulletLineIndex: selection.bulletLineIndex,
    modificationType: selection.modificationType,
    targetRoleTitle: selection.targetRoleTitle,
    targetCompany: selection.targetCompany,
  }))
}

export function useResumeBuilderState(
  options: UseResumeBuilderStateOptions = {}
): UseResumeBuilderStateResult {
  const { jobDescription = '', sourceText = null } = options

  const [state, dispatch] = useReducer(resumeStateSliceReducer, null, createEmptyResumeStateSlice)

  const onApplyRevisions = useCallback(
    (selections: SkillSnippetSelection[]) => {
      if (selections.length === 0) return state

      const revisions = selectionsToRevisions(selections)
      let base = state
      if (base.workExperience.length === 0 && sourceText?.trim()) {
        base = resumeTextToStateSlice(sourceText)
      }

      let next = applyRevisionsToStateSlice(base, revisions)
      if (jobDescription.trim()) {
        next = {
          ...next,
          phrasingAudit: auditStateSlicePhrasing(next, jobDescription.trim()),
        }
      }

      dispatch({ type: 'RESET', payload: next })
      return next
    },
    [jobDescription, sourceText, state]
  )

  const setFromTailoredResume = useCallback((resume: TailoredResume, text?: string) => {
    dispatch({
      type: 'SET_FROM_TAILORED',
      resume,
      sourceText: text ?? sourceText ?? undefined,
    })
  }, [sourceText])

  const setFromResumeText = useCallback((resumeText: string) => {
    dispatch({ type: 'SET_FROM_TEXT', resumeText })
  }, [])

  const mergeGenerationResult = useCallback(
    (resume: TailoredResume, text?: string) => {
      let next = mergeTailoredResumeIntoStateSlice(state, resume, text ?? sourceText ?? undefined)
      if (jobDescription.trim()) {
        next = {
          ...next,
          phrasingAudit: auditStateSlicePhrasing(next, jobDescription.trim()),
        }
      }
      dispatch({ type: 'RESET', payload: next })
      return next
    },
    [jobDescription, sourceText, state]
  )

  const patchTailoredResume = useCallback(
    (resume: TailoredResume) => {
      dispatch({
        type: 'PATCH_TAILORED',
        resume,
        sourceText: sourceText ?? undefined,
        jobDescription: jobDescription.trim() || undefined,
      })
    },
    [jobDescription, sourceText]
  )

  const reset = useCallback(() => {
    dispatch({ type: 'RESET', payload: null })
  }, [])

  const tailoredResume = useMemo(() => {
    if (!state.summary.trim() && state.workExperience.length === 0) return null
    return stateSliceToTailoredResume(state)
  }, [state])

  const documentPayload = useMemo(() => {
    if (!tailoredResume) return null
    const hydrated = getHydratedDocumentPayloadFromSlice(state)
    return {
      contactInfo: hydrated.contact,
      summary: hydrated.summary,
      skills: hydrated.skills,
      workExperience: hydrated.experience,
      education: hydrated.education,
      projects: hydrated.projects ?? [],
      certifications: hydrated.certifications ?? [],
    }
  }, [state, tailoredResume])

  const resumeText = useMemo(() => {
    if (!state.summary.trim() && state.workExperience.length === 0 && !sourceText?.trim()) {
      return sourceText?.trim() ?? ''
    }
    const serialized = stateSliceToResumeText(state)
    return serialized.trim() || sourceText?.trim() || ''
  }, [sourceText, state])

  const anchoredModifications = useMemo(
    () => revisionsToAnchoredModifications(state.appliedRevisions),
    [state.appliedRevisions]
  )

  return {
    state,
    tailoredResume,
    documentPayload,
    resumeText,
    anchoredModifications,
    onApplyRevisions,
    setFromTailoredResume,
    setFromResumeText,
    mergeGenerationResult,
    patchTailoredResume,
    reset,
  }
}
