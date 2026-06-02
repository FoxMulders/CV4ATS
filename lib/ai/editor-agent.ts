import { generateText, NoObjectGeneratedError, Output } from 'ai'

import { applyGenerationHygiene } from '@/lib/ai/generation-hygiene'
import {
  EDITOR_AGENT_SYSTEM_PROMPT,
  buildEditorAgentRevisionPrompt,
} from '@/lib/ai/editor-agent-prompts'
import {
  isGeminiModelNotFoundError,
  shouldFallbackToNextGeminiModel,
  unwrapAiError,
} from '@/lib/ai/errors'
import {
  createGeminiModel,
  geminiProviderOptions,
  hiringPanelModelCandidates,
} from '@/lib/ai/gemini'
import type { HiringPanelReview } from '@/lib/ai/hiring-panel-schemas'
import { parseJsonFromModelText } from '@/lib/ai/normalize-output'
import { parseJsonFromSanitizedText, stripMarkdownJsonFences } from '@/lib/ai/sanitize-json-response'
import { AI_GENERATION_MAX_TOKENS, AI_STREAM_MAX_RETRIES } from '@/lib/ai/provider'
import {
  aiGenerationResultSchema,
  tailoredResumeSchema,
  type AiGenerationResult,
} from '@/lib/ai/schemas'
import {
  auditPanelDraftIssues,
  repairPersonalVenturesInWorkExperience,
  summarizePanelDraftIssues,
  type PanelDraftIssue,
} from '@/lib/ai/panel-draft-audit'
import { enforceSourceCertifications } from '@/lib/resume/certification-guard'

const EDITOR_OUTPUT = Output.object({
  schema: aiGenerationResultSchema.pick({ tailoredResume: true, coverLetter: true }),
  name: 'EditorAgentRevision',
  description: 'Editor Agent corrected resume and cover letter after hiring panel audit.',
})

async function generateEditorAgentText(params: Omit<Parameters<typeof generateText>[0], 'model'>) {
  const candidates = hiringPanelModelCandidates()
  let lastError: unknown

  for (const modelId of candidates) {
    try {
      return await generateText({
        ...params,
        model: createGeminiModel(modelId),
      } as Parameters<typeof generateText>[0])
    } catch (error) {
      lastError = error
      if (shouldFallbackToNextGeminiModel(error)) {
        const reason = isGeminiModelNotFoundError(error) ? 'unavailable' : 'rate limited'
        console.warn(`[Editor Agent] Model "${modelId}" ${reason} — trying next fallback.`)
        continue
      }
      throw error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Editor Agent: no Gemini model available.')
}

function tryRecoverRevision(
  error: unknown
): Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter'> | undefined {
  const root = unwrapAiError(error)
  const text = NoObjectGeneratedError.isInstance(root) ? root.text : undefined
  if (!text?.trim()) return undefined

  try {
    const parsed = parseJsonFromModelText(text) as Record<string, unknown>
    return {
      tailoredResume: tailoredResumeSchema.parse(parsed.tailoredResume),
      coverLetter: String(parsed.coverLetter ?? ''),
    }
  } catch {
    return undefined
  }
}

export type EditorAgentRunOptions = {
  achievementSupplement?: string
}

export type EditorAgentResult = {
  draft: AiGenerationResult
  flaggedIssuesBefore: PanelDraftIssue[]
  flaggedIssuesAfter: PanelDraftIssue[]
  correctedIssueSummaries: string[]
}

function applyDeterministicRepairs(
  draft: AiGenerationResult,
  sourceResumeText: string,
  options: EditorAgentRunOptions = {}
): AiGenerationResult {
  const repairedResume = repairPersonalVenturesInWorkExperience(draft.tailoredResume)

  return applyGenerationHygiene(
    {
      ...draft,
      tailoredResume: enforceSourceCertifications(repairedResume, sourceResumeText),
    },
    sourceResumeText,
    { achievementSupplement: options.achievementSupplement }
  )
}

/** Agent 3 — silent editor pass after hiring panel audit. */
export async function runEditorAgentCorrection(
  jobDescription: string,
  sourceResumeText: string,
  draft: AiGenerationResult,
  review: HiringPanelReview,
  options: EditorAgentRunOptions = {}
): Promise<EditorAgentResult> {
  const prepped = applyDeterministicRepairs(draft, sourceResumeText, options)
  const flaggedIssuesBefore = auditPanelDraftIssues(prepped, sourceResumeText, jobDescription)

  const prompt = buildEditorAgentRevisionPrompt({
    jobDescription,
    sourceResumeText,
    draft: prepped,
    review,
    flaggedIssues: flaggedIssuesBefore,
    achievementSupplement: options.achievementSupplement,
  })

  let revision: Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter'> | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await generateEditorAgentText({
        system: EDITOR_AGENT_SYSTEM_PROMPT,
        prompt,
        temperature: attempt === 0 ? 0.25 : 0.2,
        maxOutputTokens: AI_GENERATION_MAX_TOKENS,
        maxRetries: AI_STREAM_MAX_RETRIES,
        output: EDITOR_OUTPUT,
        providerOptions: geminiProviderOptions(),
      })
      const output = response.output as Pick<AiGenerationResult, 'tailoredResume' | 'coverLetter'>
      revision = {
        tailoredResume: tailoredResumeSchema.parse(output.tailoredResume),
        coverLetter: String(output.coverLetter).trim(),
      }
      break
    } catch (error) {
      revision = tryRecoverRevision(error) ?? null
      if (revision) break

      try {
        const response = await generateEditorAgentText({
          system: `${EDITOR_AGENT_SYSTEM_PROMPT}\n\nReturn JSON with tailoredResume and coverLetter keys only.`,
          prompt: `${prompt}\n\nRespond with valid JSON only.`,
          temperature: 0.2,
          maxOutputTokens: AI_GENERATION_MAX_TOKENS,
          maxRetries: AI_STREAM_MAX_RETRIES,
          providerOptions: geminiProviderOptions(),
        })
        const parsed = parseJsonFromSanitizedText(stripMarkdownJsonFences(response.text)) as Record<
          string,
          unknown
        >
        revision = {
          tailoredResume: tailoredResumeSchema.parse(parsed.tailoredResume),
          coverLetter: String(parsed.coverLetter ?? '').trim(),
        }
        break
      } catch {
        // retry loop
      }

      if (attempt === 1) {
        console.error('Editor Agent correction failed:', error)
      }
    }
  }

  const merged: AiGenerationResult = revision
    ? applyDeterministicRepairs(
        {
          ...prepped,
          tailoredResume: revision.tailoredResume,
          coverLetter: revision.coverLetter,
        },
        sourceResumeText,
        options
      )
    : prepped

  const flaggedIssuesAfter = auditPanelDraftIssues(merged, sourceResumeText, jobDescription)
  const beforeSummaries = new Set(summarizePanelDraftIssues(flaggedIssuesBefore))
  const afterSummaries = new Set(summarizePanelDraftIssues(flaggedIssuesAfter))
  const correctedIssueSummaries = [...beforeSummaries].filter((item) => !afterSummaries.has(item))

  return {
    draft: merged,
    flaggedIssuesBefore,
    flaggedIssuesAfter,
    correctedIssueSummaries,
  }
}

export function buildAutoCorrectionSummary(input: {
  initialScore: number
  finalScore: number
  correctedIssues: string[]
  revisionRounds: number
}): string {
  if (input.correctedIssues.length === 0 && input.revisionRounds === 0) {
    return `Interview readiness scored ${input.finalScore}% with no automatic corrections required.`
  }

  const issuePreview = input.correctedIssues.slice(0, 4).join('; ')
  const suffix =
    input.correctedIssues.length > 4
      ? ` (+${input.correctedIssues.length - 4} more)`
      : ''

  return `We scanned your initial draft, caught ${input.correctedIssues.length || 'several'} issue(s)${issuePreview ? ` (${issuePreview}${suffix})` : ''}, and automatically corrected them${input.revisionRounds > 0 ? ` in ${input.revisionRounds} editor pass(es)` : ''}. Your material is now rated ${input.finalScore}% for interview readiness${input.initialScore < input.finalScore ? ` (up from ${input.initialScore}%)` : ''}.`
}
