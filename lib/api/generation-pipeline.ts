import { runHiringPanelWithRevisions } from '@/lib/ai/hiring-panel'
import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import type { KeywordReport } from '@/lib/ai/schemas'
import type { AiGenerationResult, GenerationResult } from '@/lib/ai/schemas'
import { refineTailoredResume, generateTailoredResume } from '@/lib/ai/generate'
import {
  getMaxGenerationPasses,
  refinementProgressLabel,
  sanitizeKeywordReport,
  TARGET_ATS_SCORE,
} from '@/lib/api/generation-config'
import { GENERATION_PROGRESS_LABELS } from '@/lib/api/generation-progress-labels'
import type { ScorePassEvent, PartialGenerationEvent } from '@/lib/api/progress-stream'
import {
  buildCoreCompetencyChecklist,
  formatChecklistForPrompt,
} from '@/lib/resume/core-competency-checklist'
import { appendSnippetsToResume } from '@/lib/resume/skill-snippets'
import { applyAnchoredSkillModifications } from '@/lib/resume/apply-skill-modifications'
import { injectSelectedKeywords } from '@/lib/resume/inject-selected-keywords'
import type { PreScanResult } from '@/lib/resume/pre-scan-preparation'
import { runSkillExtrapolationAndInjection } from '@/lib/resume/pre-scan-preparation'
import { formatTailoredResume } from '@/lib/resume/ats-resume-formatter'
import { enforceSourceCertifications } from '@/lib/resume/certification-guard'
import {
  auditResumePhrasingCompliance,
  buildPhrasingComplianceSuggestions,
} from '@/lib/resume/exact-phrasing-auditor'
import {
  buildAtsComparison,
  scoreAtsCompliance,
  serializeTailoredResume,
} from '@/lib/resume/ats-score'
import {
  keywordsToTargetSkills,
  targetSkillTerms,
  type TargetSkill,
} from '@/lib/resume/skill-extrapolation'
import { integrateScoringKeywordsUntilSaturation } from '@/lib/resume/scoring-keyword-integration'
import { getMissingScoringKeywords } from '@/lib/resume/scoring-keyword-targets'
import { mergeTargetSkills } from '@/lib/resume/tailored-resume-injection'
import { repairCoverLetterCompliance } from '@/lib/ai/cover-letter-repair'
import { auditCoverLetterCompliance } from '@/lib/resume/cover-letter-compliance'

export { GENERATION_PROGRESS_LABELS }

export type ProgressUpdate =
  | { type: 'step'; step: number; label: string }
  | ScorePassEvent
  | PartialGenerationEvent

export type ProgressCallback = (update: ProgressUpdate) => void | Promise<void>

export type GenerationPipelineOptions = {
  selectedKeywords?: string[]
  customSnippets?: string[]
  /** User-supplied metrics for bullets that lacked quantified outcomes. */
  achievementSupplement?: string
  /** Inline bullet/summary revisions with placement metadata. */
  anchoredModifications?: Array<{
    snippet: string
    positionId?: string
    bulletIndex?: number
    originalBullet?: string
    bulletLineIndex?: number
    modificationType?: 'inline-bullet' | 'skills-section' | 'summary'
  }>
}

export type GenerationPipelineResult = GenerationResult & {
  refinementPasses: number
  targetScoreMet: boolean
  preScan: PreScanResult
  incorporatedKeywords: string[]
  passHistory: ScorePassEvent[]
  hiringPanel?: HiringPanelSessionResult | null
  /** Uncapped keyword-only ATS before hiring panel adjustment. */
  rawKeywordScore?: number
}

function runScoringIntegration(
  aiResult: AiGenerationResult,
  jobDescription: string,
  seedSkills: TargetSkill[]
): { aiResult: AiGenerationResult; injectedSkills: string[]; matchScore: number } {
  const integration = integrateScoringKeywordsUntilSaturation(
    aiResult.tailoredResume,
    jobDescription,
    seedSkills
  )

  if (integration.injectedSkills.length === 0) {
    return { aiResult, injectedSkills: [], matchScore: integration.matchScore }
  }

  return {
    aiResult: {
      ...aiResult,
      tailoredResume: integration.resume,
    },
    injectedSkills: integration.injectedSkills,
    matchScore: integration.matchScore,
  }
}

function scoreResume(
  resume: AiGenerationResult['tailoredResume'],
  jobDescription: string,
  sourceResumeText: string,
  baselineScore?: number
): number {
  return scoreAtsCompliance(serializeTailoredResume(resume), jobDescription, {
    phase: 'tailored',
    sourceResumeText,
    baselineScore,
  }).matchScore
}

function applySourceGrounding(
  aiResult: AiGenerationResult,
  sourceResumeText: string
): AiGenerationResult {
  return {
    ...aiResult,
    tailoredResume: enforceSourceCertifications(aiResult.tailoredResume, sourceResumeText),
  }
}

/** When the hiring panel rejects the package, keyword-only ATS must not exceed panel readiness. */
function applyPanelReadinessToKeywordReport(
  report: KeywordReport,
  panel: HiringPanelSessionResult | null | undefined,
  rawKeywordScore: number
): KeywordReport {
  if (!panel || panel.reviewFailed || panel.unanimousApproval) {
    return report
  }

  const cappedScore = Math.min(report.matchScore, panel.aggregateScore)
  if (cappedScore >= report.matchScore) {
    return report
  }

  return {
    ...report,
    matchScore: cappedScore,
    suggestions: [
      `Keyword-only ATS was ${rawKeywordScore}%, but the hiring panel scored this package ${panel.aggregateScore}%. Fix the issues below — keyword density alone does not mean interview-ready.`,
      ...report.suggestions,
    ].slice(0, 6),
  }
}

export async function runGenerationPipeline(
  jobDescription: string,
  resumeText: string,
  onProgress?: ProgressCallback,
  options: GenerationPipelineOptions = {}
): Promise<GenerationPipelineResult> {
  const passHistory: ScorePassEvent[] = []

  const emitStep = async (step: number, label?: string) => {
    await onProgress?.({
      type: 'step',
      step,
      label: label ?? GENERATION_PROGRESS_LABELS[step] ?? 'Working…',
    })
  }

  const emitScorePass = async (event: ScorePassEvent) => {
    passHistory.push(event)
    await onProgress?.(event)
  }

  await emitStep(0)

  const selectedKeywords = options.selectedKeywords ?? []
  const customSnippets = options.customSnippets ?? []
  const anchoredModifications = options.anchoredModifications ?? []
  const achievementSupplement = options.achievementSupplement?.trim() ?? ''
  let workingResumeText = resumeText
  let incorporatedKeywords: string[] = []

  if (anchoredModifications.length > 0) {
    workingResumeText = applyAnchoredSkillModifications(workingResumeText, anchoredModifications)
    incorporatedKeywords = selectedKeywords.length > 0 ? selectedKeywords : []
  } else if (customSnippets.length > 0) {
    workingResumeText = appendSnippetsToResume(workingResumeText, customSnippets)
    incorporatedKeywords = selectedKeywords.length > 0 ? selectedKeywords : []
  } else if (selectedKeywords.length > 0) {
    const userInjection = injectSelectedKeywords(workingResumeText, selectedKeywords)
    workingResumeText = userInjection.text
    incorporatedKeywords = userInjection.injectedSkills
  }

  const baselineKeywordReport = scoreAtsCompliance(workingResumeText, jobDescription, {
    phase: 'baseline',
    sourceResumeText: resumeText,
  })
  const baselineScore = baselineKeywordReport.matchScore

  const preScan = runSkillExtrapolationAndInjection(workingResumeText, jobDescription, {
    autoInject: true,
  })
  const preparedResumeText = preScan.preparedResumeText

  if (incorporatedKeywords.length > 0) {
    preScan.autoInjectedSkills = [
      ...new Set([...incorporatedKeywords, ...preScan.autoInjectedSkills]),
    ]
  }

  const competencyChecklist = buildCoreCompetencyChecklist(
    jobDescription,
    preparedResumeText,
    preScan.targetSkills
  )
  const checklistPrompt = formatChecklistForPrompt(competencyChecklist)

  const llmTargetSkills = [
    ...new Set([...targetSkillTerms(preScan.targetSkills), ...competencyChecklist.allTerms, ...selectedKeywords]),
  ]

  const seedSkills = mergeTargetSkills(
    preScan.missingSkills,
    keywordsToTargetSkills(competencyChecklist.missingTerms)
  )

  await emitScorePass({
    type: 'score-pass',
    pass: 0,
    phase: 'Pre-scan baseline',
    scoreBefore: 0,
    scoreAfter: baselineScore,
  })

  await emitStep(1)

  const emitPartial = async (preview: PartialGenerationEvent['preview']) => {
    await onProgress?.({ type: 'partial', preview })
  }

  let aiResult = applySourceGrounding(
    await generateTailoredResume(
      jobDescription,
      preparedResumeText,
      {
        targetSkills: llmTargetSkills,
        coreCompetencyChecklist: checklistPrompt,
        missingKeywords: competencyChecklist.missingTerms,
        achievementSupplement,
      },
      {
        onPartial: emitPartial,
      }
    ),
    resumeText
  )

  let integration = runScoringIntegration(aiResult, jobDescription, seedSkills)
  aiResult = integration.aiResult
  incorporatedKeywords = [...new Set([...incorporatedKeywords, ...integration.injectedSkills])]

  const afterInitialScore = scoreResume(aiResult.tailoredResume, jobDescription, resumeText, baselineScore)
  await emitScorePass({
    type: 'score-pass',
    pass: 1,
    phase: 'Initial LLM tailoring + keyword weave',
    scoreBefore: baselineScore,
    scoreAfter: afterInitialScore,
    injectedCount: integration.injectedSkills.length,
  })

  await emitStep(2)

  let comparison = buildAtsComparison(
    workingResumeText,
    serializeTailoredResume(aiResult.tailoredResume),
    jobDescription,
    sanitizeKeywordReport(aiResult.keywordReport).suggestions,
    resumeText,
    aiResult.tailoredResume
  )

  let currentScore = comparison.keywordReport.matchScore
  let refinementPasses = 0
  let pass = 1

  while (currentScore < TARGET_ATS_SCORE && pass < getMaxGenerationPasses()) {
    const missingKeywords = getMissingScoringKeywords(
      serializeTailoredResume(aiResult.tailoredResume),
      jobDescription
    )
    if (missingKeywords.length === 0) break

    const previousScore = currentScore
    refinementPasses += 1
    pass += 1

    await emitStep(2, refinementProgressLabel(pass, currentScore))

    aiResult = applySourceGrounding(
      await refineTailoredResume(
        jobDescription,
        workingResumeText,
        currentScore,
        missingKeywords.slice(0, 8),
        checklistPrompt,
        achievementSupplement,
        { onPartial: emitPartial }
      ),
      resumeText
    )

    integration = runScoringIntegration(aiResult, jobDescription, keywordsToTargetSkills(missingKeywords))
    aiResult = integration.aiResult
    incorporatedKeywords = [...new Set([...incorporatedKeywords, ...integration.injectedSkills])]

    comparison = buildAtsComparison(
      workingResumeText,
      serializeTailoredResume(aiResult.tailoredResume),
      jobDescription,
      sanitizeKeywordReport(aiResult.keywordReport).suggestions,
      resumeText,
      aiResult.tailoredResume
    )

    currentScore = comparison.keywordReport.matchScore

    await emitScorePass({
      type: 'score-pass',
      pass: pass + 1,
      phase: `Refinement pass ${pass}`,
      scoreBefore: previousScore,
      scoreAfter: currentScore,
      injectedCount: integration.injectedSkills.length,
    })

    if (currentScore <= previousScore && integration.injectedSkills.length === 0) break
  }

  const beforeFinalScore = currentScore
  integration = runScoringIntegration(aiResult, jobDescription, seedSkills)
  aiResult = integration.aiResult
  incorporatedKeywords = [...new Set([...incorporatedKeywords, ...integration.injectedSkills])]

  comparison = buildAtsComparison(
    workingResumeText,
    serializeTailoredResume(aiResult.tailoredResume),
    jobDescription,
    sanitizeKeywordReport(aiResult.keywordReport).suggestions,
    resumeText,
    aiResult.tailoredResume
  )

  if (integration.injectedSkills.length > 0 || comparison.keywordReport.matchScore !== beforeFinalScore) {
    await emitScorePass({
      type: 'score-pass',
      pass: passHistory.length,
      phase: 'Final keyword integration',
      scoreBefore: beforeFinalScore,
      scoreAfter: comparison.keywordReport.matchScore,
      injectedCount: integration.injectedSkills.length,
    })
  }

  await emitStep(3, 'Hiring panel review…')

  aiResult = {
    ...aiResult,
    tailoredResume: enforceSourceCertifications(
      formatTailoredResume(aiResult.tailoredResume),
      resumeText
    ),
  }

  let panelRun: Awaited<ReturnType<typeof runHiringPanelWithRevisions>> = {
    aiResult,
    panel: null,
  }

  try {
    panelRun = await runHiringPanelWithRevisions(
      jobDescription,
      resumeText,
      aiResult,
      async (label) => emitStep(3, label),
      { achievementSupplement: achievementSupplement || undefined }
    )
  } catch (error) {
    console.error('Hiring panel skipped due to error:', error)
    await emitStep(3, 'Hiring panel skipped — finalizing your resume…')
  }

  aiResult = panelRun.aiResult
  aiResult = applySourceGrounding(
    {
      ...aiResult,
      tailoredResume: formatTailoredResume(aiResult.tailoredResume),
    },
    resumeText
  )

  const coverViolations = auditCoverLetterCompliance(aiResult.coverLetter)
  if (coverViolations.length > 0) {
    await emitStep(3, 'Final cover letter polish…')
    try {
      const panelReview =
        panelRun.panel && !panelRun.panel.reviewFailed && panelRun.panel.managers.length === 10
          ? {
              managers: panelRun.panel.managers,
              revisionRecommendations: panelRun.panel.revisionRecommendations,
              finalVerdict: panelRun.panel.finalVerdict,
            }
          : null
      aiResult = {
        ...aiResult,
        coverLetter: await repairCoverLetterCompliance(
          aiResult.coverLetter,
          coverViolations,
          resumeText,
          jobDescription,
          achievementSupplement,
          panelReview
        ),
      }
    } catch (error) {
      console.error('Cover letter polish skipped:', error)
    }
  }

  comparison = buildAtsComparison(
    workingResumeText,
    serializeTailoredResume(aiResult.tailoredResume),
    jobDescription,
    sanitizeKeywordReport(aiResult.keywordReport).suggestions,
    resumeText,
    aiResult.tailoredResume
  )

  const phrasingAudit = auditResumePhrasingCompliance(
    [
      { label: 'Professional summary', text: aiResult.tailoredResume.summary },
      ...aiResult.tailoredResume.experience.flatMap((entry, index) =>
        entry.bullets.map((bullet, bulletIndex) => ({
          label: `Experience ${index + 1} bullet ${bulletIndex + 1}`,
          text: bullet,
        }))
      ),
      { label: 'Cover letter', text: aiResult.coverLetter },
    ],
    jobDescription
  )
  const phrasingSuggestions = buildPhrasingComplianceSuggestions(phrasingAudit)
  const rawKeywordScore = comparison.keywordReport.matchScore
  const keywordReport = applyPanelReadinessToKeywordReport(
    sanitizeKeywordReport({
      ...comparison.keywordReport,
      suggestions: [...phrasingSuggestions, ...comparison.keywordReport.suggestions].slice(0, 6),
    }),
    panelRun.panel,
    rawKeywordScore
  )

  const result: GenerationPipelineResult = {
    ...aiResult,
    keywordReport,
    baselineKeywordReport,
    refinementPasses,
    targetScoreMet: keywordReport.matchScore >= TARGET_ATS_SCORE,
    preScan,
    incorporatedKeywords: [
      ...new Set([...preScan.autoInjectedSkills, ...incorporatedKeywords, ...selectedKeywords]),
    ],
    passHistory,
    hiringPanel: panelRun.panel,
    rawKeywordScore,
  }

  await emitStep(4)
  return result
}
