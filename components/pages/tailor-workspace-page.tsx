'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PremiumUnlockBanner } from '@/components/billing/premium-unlock-banner'
import { SquareCheckoutModal } from '@/components/billing/square-checkout-modal'
import { SiteHeader } from '@/components/layout/site-header'
import { TrustBanner } from '@/components/layout/trust-banner'
import { SeoFaqSection } from '@/components/marketing/seo-faq-section'
import { TargetSkillsPanel } from '@/components/resume/target-skills-panel'
import { CoverLetterPreview } from '@/components/results/cover-letter-preview'
import { HiringPanelReviewPanel } from '@/components/results/hiring-panel-review-panel'
import { KeywordReportPanel } from '@/components/results/keyword-report'
import { RecalculateScoreToolbar } from '@/components/results/recalculate-score-toolbar'
import type { SkillSnippetSelection } from '@/components/results/editable-skill-snippet-picker'
import { applyAnchoredSkillModifications, selectionsToAnchoredModifications } from '@/lib/resume/apply-skill-modifications'
import { EditableResumePreview } from '@/components/results/editable-resume-preview'
import { ResumeDiffView } from '@/components/results/resume-diff-view'
import { ResumePreview } from '@/components/results/resume-preview'
import { UndoRedoToolbar } from '@/components/results/undo-redo-toolbar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { PreviewScoreBanner } from '@/components/workspace/preview-score-banner'
import { ResumeLetterPage } from '@/components/workspace/resume-letter-page'
import { SplitWorkspaceLayout } from '@/components/workspace/split-workspace-layout'
import { WorkspaceAccordion } from '@/components/workspace/workspace-accordion'
import { GenerateStep } from '@/components/wizard/generate-step'
import { AchievementIntakeModal } from '@/components/wizard/achievement-intake-modal'
import { PanelExperienceIntakeModal } from '@/components/wizard/panel-experience-intake-modal'
import { JobDescriptionStep } from '@/components/wizard/job-description-step'
import {
  ResumeInputStep,
  getResumeTextForSubmit,
  isResumeInputReady,
  type ResumeFileParseState,
} from '@/components/wizard/resume-input-step'
import { formatScorePassLine } from '@/lib/api/generation-config'
import { useJobPass } from '@/hooks/use-job-pass'
import { useBrowserAiPreference } from '@/hooks/use-browser-ai-preference'
import { useAtsScoreRecalculation } from '@/hooks/use-ats-score-recalculation'
import { useSavedResume } from '@/hooks/use-saved-resume'
import { RESUME_STEP_ANCHOR_ID } from '@/lib/wizard/workspace-focus-guide'
import { useUndoableResume } from '@/hooks/use-undoable-resume'
import { coalesceStreamingResume, consumeGenerationStream } from '@/lib/api/progress-stream'
import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import { runBrowserGeneration } from '@/lib/ai/browser/run-browser-generation'
import type { HiringPanelSessionResult } from '@/lib/ai/hiring-panel-schemas'
import type { GenerationResult, KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import type { PreScanResult } from '@/lib/resume/pre-scan-preparation'
import { serializeTailoredResume } from '@/lib/resume/ats-score'
import {
  detectAchievementGaps,
  formatAchievementSupplement,
  type AchievementGapQuestion,
} from '@/lib/resume/achievement-gap'
import {
  detectPanelExperienceGaps,
  formatPanelExperienceSupplement,
  type PanelExperienceQuestion,
} from '@/lib/resume/panel-experience-gaps'
import { requestPanelRevise } from '@/lib/api/panel-revise-client'

type GenerationResultWithMeta = GenerationResult & {
  refinementPasses?: number
  targetScoreMet?: boolean
  preScan?: PreScanResult
  incorporatedKeywords?: string[]
  hiringPanel?: HiringPanelSessionResult | null
  rawKeywordScore?: number
  generationSource?: 'browser' | 'server'
}

type GenerateOptions = {
  selectedKeywords?: string[]
  customSnippets?: string[]
  anchoredModifications?: ReturnType<typeof selectionsToAnchoredModifications>
  resumeOverride?: string
  achievementSupplement?: string
  skipAchievementIntake?: boolean
}

export interface TailorWorkspacePageProps {
  hero?: {
    eyebrow?: string
    title?: string
    description?: string
  }
  initialJobDescription?: string
  showFaq?: boolean
  coverLetterFieldId?: string
}

export function TailorWorkspacePage({
  hero,
  initialJobDescription = '',
  showFaq = false,
  coverLetterFieldId = 'home-cover-letter',
}: TailorWorkspacePageProps) {
  const [jobDescription, setJobDescription] = useState(initialJobDescription)
  const [resumeText, setResumeText] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [scorePassLines, setScorePassLines] = useState<string[]>([])
  const [streamingResume, setStreamingResume] = useState<TailoredResume | null>(null)
  const [streamingCoverLetter, setStreamingCoverLetter] = useState('')
  const [result, setResult] = useState<GenerationResultWithMeta | null>(null)
  const {
    resume: editedResume,
    pushResume: pushEditedResume,
    resetResume: resetEditedResume,
    undo: undoResumeEdit,
    redo: redoResumeEdit,
    canUndo: canUndoResumeEdit,
    canRedo: canRedoResumeEdit,
  } = useUndoableResume(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [fileParse, setFileParse] = useState<ResumeFileParseState>({
    status: 'idle',
    parsedText: '',
    error: null,
  })
  const [preScanPreview, setPreScanPreview] = useState<PreScanResult | null>(null)
  const [baselinePreScan, setBaselinePreScan] = useState<PreScanResult | null>(null)
  const [editedPreScan, setEditedPreScan] = useState<PreScanResult | null>(null)
  const [preScanLoading, setPreScanLoading] = useState(false)
  const [originalResumeText, setOriginalResumeText] = useState<string | null>(null)
  const [baselineTailoredResume, setBaselineTailoredResume] = useState<TailoredResume | null>(null)
  const [editedKeywordReport, setEditedKeywordReport] = useState<KeywordReport | null>(null)
  const [baselineKeywordReport, setBaselineKeywordReport] = useState<KeywordReport | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [achievementIntakeOpen, setAchievementIntakeOpen] = useState(false)
  const [achievementQuestions, setAchievementQuestions] = useState<AchievementGapQuestion[]>([])
  const [pendingGenerateOptions, setPendingGenerateOptions] = useState<GenerateOptions | null>(null)
  const [panelExperienceOpen, setPanelExperienceOpen] = useState(false)
  const [panelExperienceQuestions, setPanelExperienceQuestions] = useState<PanelExperienceQuestion[]>([])
  const [panelReviseLoading, setPanelReviseLoading] = useState(false)
  const [previewTab, setPreviewTab] = useState<'tailored' | 'audit'>('tailored')
  const {
    accessToken,
    isUnlocked,
    unlock,
    checkoutEnabled,
    jobDescriptionHash,
    passExpiryLabel,
  } = useJobPass(jobDescription)

  const { useBrowserAi, setUseBrowserAi, status: browserAiStatus, refreshStatus: refreshBrowserAiStatus } =
    useBrowserAiPreference()

  useSavedResume(resumeText, setResumeText, fileParse)

  const handleFileParseChange = useCallback((state: ResumeFileParseState) => {
    setFileParse(state)
  }, [])

  const activeResumeText =
    resumeText.trim() ||
    (fileParse.status === 'ready' ? fileParse.parsedText.trim() : '')

  useEffect(() => {
    const jobText = jobDescription.trim()
    if (!jobText || !activeResumeText) {
      setPreScanPreview(null)
      setBaselinePreScan(null)
      setEditedPreScan(null)
      return
    }

    const timer = window.setTimeout(async () => {
      setPreScanLoading(true)
      try {
        const response = await fetch('/api/pre-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobDescription: jobText,
            resumeText: activeResumeText,
            autoInject: false,
          }),
        })

        if (!response.ok) return
        const data = (await response.json()) as PreScanResult
        setPreScanPreview(data)
        setBaselinePreScan(data)
        setEditedPreScan(data)
      } catch {
        setPreScanPreview(null)
        setBaselinePreScan(null)
        setEditedPreScan(null)
      } finally {
        setPreScanLoading(false)
      }
    }, 600)

    return () => window.clearTimeout(timer)
  }, [jobDescription, activeResumeText])

  function handleInsertSkillSelections(selections: SkillSnippetSelection[]) {
    setResumeFile(null)
    setResumeText((current) => {
      const base = current.trim() || activeResumeText
      return applyAnchoredSkillModifications(base, selectionsToAnchoredModifications(selections))
    })
    toast.success(
      `Updated ${selections.length} resume line${selections.length === 1 ? '' : 's'} with selected skills`
    )
  }

  const canGenerate =
    jobDescription.trim().length > 0 &&
    isResumeInputReady(resumeText, resumeFile, fileParse) &&
    fileParse.status !== 'parsing'

  function requestGenerate(options: GenerateOptions = {}) {
    if (!canGenerate && !options.resumeOverride) return

    const resumeForScan =
      options.resumeOverride ??
      getResumeTextForSubmit(resumeText, resumeFile, fileParse).resumeText ??
      activeResumeText

    const isReTailor =
      Boolean(options.selectedKeywords?.length) ||
      Boolean(options.customSnippets?.length) ||
      Boolean(options.anchoredModifications?.length)

    if (
      !useBrowserAi &&
      !options.skipAchievementIntake &&
      !options.achievementSupplement &&
      !isReTailor &&
      resumeForScan.trim()
    ) {
      const gaps = detectAchievementGaps(resumeForScan)
      if (gaps.length > 0) {
        setAchievementQuestions(gaps)
        setPendingGenerateOptions(options)
        setAchievementIntakeOpen(true)
        return
      }
    }

    void handleGenerate(options)
  }

  function openAchievementIntakeFromPanel() {
    const gaps = detectAchievementGaps(activeResumeText)
    if (gaps.length === 0) {
      toast.message('Add quantified outcomes to your resume bullets, then regenerate.')
      return
    }
    setAchievementQuestions(gaps)
    setPendingGenerateOptions({ skipAchievementIntake: false })
    setAchievementIntakeOpen(true)
  }

  function handleAchievementIntakeSubmit(answers: Record<string, string>) {
    const supplement = formatAchievementSupplement(
      achievementQuestions
        .map((question) => ({
          context: question.context,
          bulletPreview: question.bulletPreview,
          answer: answers[question.id] ?? '',
        }))
        .filter((entry) => entry.answer.trim().length >= 8)
    )

    setAchievementIntakeOpen(false)
    void handleGenerate({
      ...(pendingGenerateOptions ?? {}),
      achievementSupplement: supplement || undefined,
      skipAchievementIntake: true,
    })
    setPendingGenerateOptions(null)
  }

  function openPanelExperienceIntake(panel: HiringPanelSessionResult) {
    const gaps = detectPanelExperienceGaps(panel)
    if (gaps.length === 0) {
      toast.message('No specific skill-evidence gaps detected in panel comments.')
      return
    }
    setPanelExperienceQuestions(gaps)
    setPanelExperienceOpen(true)
  }

  async function handlePanelExperienceSubmit(answers: Record<string, string>) {
    if (!result?.hiringPanel || !originalResumeText?.trim()) {
      toast.error('Generate a resume first, then verify flagged experience.')
      return
    }

    const experienceSupplement = formatPanelExperienceSupplement(
      panelExperienceQuestions.map((question) => ({
        skillOrTool: question.skillOrTool,
        panelSource: question.panelSource,
        answer: answers[question.id] ?? '',
      }))
    )

    if (!experienceSupplement.trim()) {
      toast.error('Add at least one verified experience description.')
      return
    }

    setPanelReviseLoading(true)

    try {
      const updated = await requestPanelRevise({
        jobDescription: jobDescription.trim(),
        sourceResumeText: originalResumeText.trim(),
        draft: {
          tailoredResume: editedResume ?? result.tailoredResume,
          coverLetter,
          keywordReport: editedKeywordReport ?? result.keywordReport,
        },
        panel: result.hiringPanel,
        experienceSupplement,
      })

      setResult((current) =>
        current
          ? {
              ...current,
              tailoredResume: updated.tailoredResume,
              coverLetter: updated.coverLetter,
              keywordReport: updated.keywordReport,
              hiringPanel: updated.hiringPanel,
              rawKeywordScore: updated.rawKeywordScore ?? current.rawKeywordScore,
            }
          : current
      )
      resetEditedResume(updated.tailoredResume)
      setCoverLetter(updated.coverLetter)
      setEditedKeywordReport(updated.keywordReport)
      setPanelExperienceOpen(false)

      if (updated.hiringPanel && !updated.hiringPanel.unanimousApproval) {
        setPanelExperienceQuestions(detectPanelExperienceGaps(updated.hiringPanel))
      } else {
        setPanelExperienceQuestions([])
      }

      toast.success('Resume and cover letter updated with your verified experience.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply verified experience.')
    } finally {
      setPanelReviseLoading(false)
    }
  }

  async function handleGenerate(options: GenerateOptions = {}) {
    if (!canGenerate && !options.resumeOverride) return

    setIsLoading(true)
    setLoadingStep(0)
    setLoadingLabel(null)
    setScorePassLines([])
    setStreamingResume(null)
    setStreamingCoverLetter('')

    const capturedResumeText =
      options.resumeOverride ??
      getResumeTextForSubmit(resumeText, resumeFile, fileParse).resumeText ??
      activeResumeText
    if (capturedResumeText.trim()) {
      setOriginalResumeText(capturedResumeText.trim())
    }

    if (!options.selectedKeywords?.length && !options.customSnippets?.length && !options.anchoredModifications?.length) {
      setResult(null)
      resetEditedResume(null)
    }

    try {
      const resumeForGeneration =
        options.resumeOverride ??
        getResumeTextForSubmit(resumeText, resumeFile, fileParse).resumeText ??
        activeResumeText

      if (useBrowserAi) {
        if (!resumeForGeneration?.trim()) {
          throw new Error('Paste resume text or wait for file parsing before using browser AI.')
        }

        setLoadingStep(1)
        setLoadingLabel('Starting unlimited browser tailoring…')

        const data = await runBrowserGeneration({
          jobDescription: jobDescription.trim(),
          resumeText: resumeForGeneration.trim(),
          useChromeNano: browserAiStatus?.supported === true && browserAiStatus.ready,
          onProgress: (label) => {
            setLoadingLabel(label)
            setLoadingStep((step) => Math.min(step + 1, 5))
          },
        })

        setResult({ ...data, generationSource: 'browser' })
        resetEditedResume(data.tailoredResume)
        setBaselineTailoredResume(data.tailoredResume)
        setEditedKeywordReport(data.keywordReport)
        setBaselineKeywordReport(data.baselineKeywordReport)
        if (data.preScan) {
          setBaselinePreScan(data.preScan)
          setEditedPreScan(data.preScan)
        }
        setCoverLetter(data.coverLetter)
        setPanelExperienceQuestions([])

        const injected = data.incorporatedKeywords?.length ?? 0
        toast.success(
          injected > 0
            ? `Ready (browser AI) — ${injected} keyword${injected === 1 ? '' : 's'} woven in. No server quota used.`
            : 'Ready (browser AI) — unlimited, no server quota used. Hiring panel skipped in this mode.'
        )
        return
      }

      const formData = new FormData()
      formData.append('jobDescription', jobDescription.trim())

      if (options.resumeOverride) {
        formData.append('resumeText', options.resumeOverride)
      } else {
        const resumePayload = getResumeTextForSubmit(resumeText, resumeFile, fileParse)
        if (resumePayload.resumeText) {
          formData.append('resumeText', resumePayload.resumeText)
        } else if (resumePayload.file) {
          formData.append('file', resumePayload.file)
        }
      }

      if (options.selectedKeywords?.length) {
        formData.append('selectedKeywords', JSON.stringify(options.selectedKeywords))
      }
      if (options.customSnippets?.length) {
        formData.append('customSnippets', JSON.stringify(options.customSnippets))
      }
      if (options.anchoredModifications?.length) {
        formData.append('anchoredModifications', JSON.stringify(options.anchoredModifications))
      }
      if (options.achievementSupplement?.trim()) {
        formData.append('achievementSupplement', options.achievementSupplement.trim())
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Generation failed'))
      }

      const data = await consumeGenerationStream<GenerationResultWithMeta>(response, {
        onProgress: (step, label) => {
          setLoadingStep(step)
          setLoadingLabel(label)
        },
        onScorePass: (event) => {
          setScorePassLines((current) => [...current, formatScorePassLine(event)])
        },
        onPartial: (preview) => {
          const resumeSnapshot = coalesceStreamingResume(preview)
          if (resumeSnapshot) {
            setStreamingResume(resumeSnapshot)
          }
          if (preview.coverLetter?.trim()) {
            setStreamingCoverLetter(preview.coverLetter)
          }
        },
      })

      setResult({ ...data, generationSource: 'server' })
      resetEditedResume(data.tailoredResume)
      setBaselineTailoredResume(data.tailoredResume)
      setEditedKeywordReport(data.keywordReport)
      setBaselineKeywordReport(data.baselineKeywordReport)
      if (data.preScan) {
        setBaselinePreScan(data.preScan)
        setEditedPreScan(data.preScan)
      }
      setCoverLetter(data.coverLetter)

      if (data.hiringPanel && !data.hiringPanel.unanimousApproval && !data.hiringPanel.reviewFailed) {
        const panelGaps = detectPanelExperienceGaps(data.hiringPanel)
        setPanelExperienceQuestions(panelGaps)
        if (panelGaps.length > 0) {
          setPanelExperienceOpen(true)
        }
      } else {
        setPanelExperienceQuestions([])
      }

      if (options.anchoredModifications?.length || options.customSnippets?.length || options.selectedKeywords?.length) {
        const count =
          options.anchoredModifications?.length ??
          options.customSnippets?.length ??
          options.selectedKeywords?.length ??
          0
        toast.success(
          `Re-tailored with ${count} addition${count === 1 ? '' : 's'} incorporated`
        )
      } else {
        const injected = data.incorporatedKeywords?.length ?? 0
        toast.success(
          injected > 0
            ? `Your tailored resume is ready — ${injected} keyword${injected === 1 ? '' : 's'} woven in automatically`
            : 'Your tailored resume is ready'
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed'
      toast.error(message)
      if (message.includes('Rate limit exceeded') && !useBrowserAi) {
        setUseBrowserAi(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleIncorporateKeywords(selections: SkillSnippetSelection[]) {
    const resumeOverride =
      editedResume != null ? serializeTailoredResume(editedResume) : activeResumeText || undefined

    if (!resumeOverride) {
      toast.error('Add a resume before re-tailoring.')
      return
    }

    await handleGenerate({
      selectedKeywords: selections.map((item) => item.keyword),
      anchoredModifications: selectionsToAnchoredModifications(selections),
      resumeOverride,
    })
  }

  async function handleCheckoutSuccess(result: {
    accessToken: string
    jobDescriptionHash: string
    expiresAt: number
    unlockedAt: number
  }) {
    unlock(result)
    toast.success('24-Hour Job Pass active — unlimited edits and downloads for this role.')
  }

  const premiumLocked = Boolean(result && checkoutEnabled && !isUnlocked)

  const resumeHasManualEdits = useMemo(() => {
    if (!editedResume || !baselineTailoredResume) return false
    return (
      serializeTailoredResume(editedResume) !== serializeTailoredResume(baselineTailoredResume)
    )
  }, [editedResume, baselineTailoredResume])

  const handleKeywordReportUpdate = useCallback((report: KeywordReport) => {
    setEditedKeywordReport(report)
  }, [])

  const scoreRecalculation = useAtsScoreRecalculation({
    autoRecalculate: Boolean(result && resumeHasManualEdits),
    resume: editedResume,
    jobDescription,
    sourceResumeText: originalResumeText,
    baselineScore: baselineKeywordReport?.matchScore,
    seedScore: result?.keywordReport.matchScore ?? null,
    onReportUpdate: handleKeywordReportUpdate,
  })

  const displayResume = editedResume ?? streamingResume
  const hasPreviewDocument = Boolean(displayResume)
  const keywordAfter = editedKeywordReport ?? result?.keywordReport

  const leftPane = (
    <>
      {hero?.title ? (
        <div className="rounded-lg border border-border/60 bg-card/80 px-4 py-3">
          {hero.eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-wide text-brand-gold">{hero.eyebrow}</p>
          ) : null}
          <h1 className="font-heading text-lg font-semibold leading-tight">{hero.title}</h1>
          {hero.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{hero.description}</p>
          ) : null}
        </div>
      ) : null}

      <TrustBanner message="Your resume stays in this browser. It is sent to AI providers during generation and is not stored on our servers." />

      {premiumLocked ? (
        <PremiumUnlockBanner onUnlockRequest={() => setCheckoutOpen(true)} />
      ) : null}

      <WorkspaceAccordion
        id="job-description-section"
        title="Job description"
        description="Paste the role you are applying for"
        defaultOpen
      >
        <JobDescriptionStep
          value={jobDescription}
          onChange={setJobDescription}
          resumePopulated={isResumeInputReady(resumeText, resumeFile, fileParse)}
        />
      </WorkspaceAccordion>

      {result && editedResume && baselineTailoredResume ? (
        <EditableResumePreview
          resume={editedResume}
          baselineResume={baselineTailoredResume}
          onResumeChange={pushEditedResume}
          originalText={originalResumeText}
          jobDescription={jobDescription}
          layout="accordion"
        />
      ) : (
        <WorkspaceAccordion
          id={RESUME_STEP_ANCHOR_ID}
          title="Your resume"
          description="Paste text or upload a PDF, DOCX, or TXT file"
          defaultOpen
        >
          <ResumeInputStep
            resumeText={resumeText}
            onResumeTextChange={setResumeText}
            resumeFile={resumeFile}
            onResumeFileChange={setResumeFile}
            onFileParseChange={handleFileParseChange}
          />
        </WorkspaceAccordion>
      )}

      <WorkspaceAccordion
        id="generate-step"
        title="Generate tailored materials"
        description="Create an ATS-formatted resume, keyword report, and cover letter"
        defaultOpen={!result}
      >
        {(preScanPreview || preScanLoading) && canGenerate ? (
          <div className="mb-4">
            <TargetSkillsPanel
              preScan={editedPreScan ?? preScanPreview}
              baselinePreScan={baselinePreScan}
              onPreScanChange={setEditedPreScan}
              isLoading={preScanLoading}
              onInsertSelections={handleInsertSkillSelections}
              jobDescription={jobDescription}
              resumeText={activeResumeText}
            />
          </div>
        ) : null}
        <GenerateStep
          onGenerate={() => requestGenerate()}
          isLoading={isLoading}
          loadingStep={loadingStep}
          loadingLabel={loadingLabel}
          scorePassLines={scorePassLines}
          streamingResume={streamingResume}
          streamingCoverLetter={streamingCoverLetter}
          disabled={!canGenerate}
          hideStreamingPreview
          useBrowserAi={useBrowserAi}
          onUseBrowserAiChange={setUseBrowserAi}
          browserAiStatus={browserAiStatus}
          onRefreshBrowserAiStatus={refreshBrowserAiStatus}
        />
      </WorkspaceAccordion>

      {result ? (
        <>
          {result.preScan ? (
            <WorkspaceAccordion
              id="target-skills-section"
              title="Target skills"
              description="Keywords aligned to this job description"
            >
              <TargetSkillsPanel
                preScan={editedPreScan ?? result.preScan}
                baselinePreScan={baselinePreScan ?? result.preScan}
                onPreScanChange={setEditedPreScan}
                jobDescription={jobDescription}
                resumeText={
                  originalResumeText ??
                  (editedResume ? serializeTailoredResume(editedResume) : activeResumeText)
                }
              />
            </WorkspaceAccordion>
          ) : null}

          {editedResume ? (
            <WorkspaceAccordion
              id="keyword-report-section"
              title="Keyword report"
              description="Match score breakdown and missing terms"
            >
              <RecalculateScoreToolbar
                onRecalculate={scoreRecalculation.recalculateNow}
                isRecalculating={scoreRecalculation.isRecalculating}
                isStale={scoreRecalculation.isStale}
                lastScoreDelta={scoreRecalculation.lastScoreDelta}
                matchScore={editedKeywordReport?.matchScore ?? result.keywordReport.matchScore}
                baselineScore={
                  baselineKeywordReport?.matchScore ?? result.keywordReport.matchScore
                }
              />
              <div className="mt-4">
                <KeywordReportPanel
                  report={editedKeywordReport ?? result.keywordReport}
                  baselineReport={baselineKeywordReport ?? result.keywordReport}
                  onReportChange={handleKeywordReportUpdate}
                  onIncorporateKeywords={handleIncorporateKeywords}
                  isRerunning={isLoading}
                  isRecalculatingScore={scoreRecalculation.isRecalculating}
                  jobDescription={jobDescription}
                  resumeText={
                    editedResume
                      ? serializeTailoredResume(editedResume)
                      : originalResumeText ?? activeResumeText
                  }
                />
              </div>
            </WorkspaceAccordion>
          ) : null}

          <WorkspaceAccordion
            id="cover-letter-section"
            title="Cover letter"
            description="Role-specific letter ready to export"
          >
            <CoverLetterPreview
              fieldId={coverLetterFieldId}
              value={coverLetter}
              onChange={setCoverLetter}
            />
          </WorkspaceAccordion>

          {result ? (
            <WorkspaceAccordion
              id="hiring-panel-section"
              title="Hiring panel review"
              description={
                result.hiringPanel?.reviewFailed
                  ? 'Review unavailable — regenerate to retry'
                  : result.hiringPanel
                    ? `${result.hiringPanel.aggregateScore}% interview readiness · ${result.hiringPanel.managers.filter((m) => m.approved).length}/10 approved`
                    : result.generationSource === 'browser'
                      ? 'Optional server panel (browser AI on)'
                      : 'Manager critique runs after each generation'
              }
              defaultOpen
            >
              {result.hiringPanel ? (
                <HiringPanelReviewPanel
                  panel={result.hiringPanel}
                  onAddMetrics={openAchievementIntakeFromPanel}
                  onVerifyExperience={() => openPanelExperienceIntake(result.hiringPanel!)}
                  hasExperienceGaps={panelExperienceQuestions.length > 0}
                />
              ) : result.generationSource === 'browser' ? (
                <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                  <p className="font-medium text-foreground">Optional: 10-manager hiring panel</p>
                  <p className="mt-1">
                    Browser AI (on by default) keeps generation unlimited on your device. The hiring
                    panel is a separate server review — turn browser AI off only when you want that
                    critique.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setUseBrowserAi(false)
                      toast.message(
                        'Browser AI off — click Generate again for the 10-manager hiring panel.'
                      )
                    }}
                  >
                    Turn off browser AI & regenerate for panel
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No panel data for this run. Regenerate to run the 10-manager review.
                </p>
              )}
            </WorkspaceAccordion>
          ) : null}
        </>
      ) : null}

      {showFaq ? (
        <WorkspaceAccordion id="faq-section" title="FAQ" description="How ATS4CV works">
          <SeoFaqSection embedded />
        </WorkspaceAccordion>
      ) : null}
    </>
  )

  const rightPane = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PreviewScoreBanner
        before={result?.baselineKeywordReport}
        after={keywordAfter}
        tailoredBaselineScore={baselineKeywordReport?.matchScore ?? result?.baselineKeywordReport?.matchScore}
        hiringPanel={result?.hiringPanel}
        rawKeywordScore={result?.rawKeywordScore ?? null}
        isAfterUpdating={scoreRecalculation.isRecalculating}
        resume={editedResume ?? result?.tailoredResume ?? null}
        coverLetter={coverLetter}
        premiumAccessToken={accessToken}
        jobDescriptionHash={jobDescriptionHash}
        isPremiumUnlocked={isUnlocked}
        passExpiryLabel={passExpiryLabel}
        onCheckoutRequest={() => setCheckoutOpen(true)}
      />

      {hasPreviewDocument ? (
        <>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-2">
            <Tabs
              value={previewTab}
              onValueChange={(value) => setPreviewTab(value as 'tailored' | 'audit')}
            >
              <TabsList>
                <TabsTrigger value="tailored">Tailored view</TabsTrigger>
                <TabsTrigger value="audit" disabled={!originalResumeText?.trim()}>
                  Changes audit
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <UndoRedoToolbar
              canUndo={canUndoResumeEdit}
              canRedo={canRedoResumeEdit}
              onUndo={undoResumeEdit}
              onRedo={redoResumeEdit}
              enabled={Boolean(editedResume)}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {previewTab === 'tailored' ? (
              <ResumeLetterPage>
                {isLoading && streamingResume ? (
                  <p className="mb-4 text-xs font-medium uppercase tracking-wide text-brand-gold">
                    Live preview — updating as generation streams
                  </p>
                ) : null}
                <ResumePreview
                  resume={displayResume!}
                  jobDescription={jobDescription}
                  variant="letter"
                />
              </ResumeLetterPage>
            ) : originalResumeText && editedResume ? (
              <ResumeLetterPage>
                <ResumeDiffView
                  originalText={originalResumeText}
                  resume={editedResume}
                  onResumeChange={pushEditedResume}
                  jobDescription={jobDescription}
                />
              </ResumeLetterPage>
            ) : null}
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ResumeLetterPage
            empty
            emptyMessage="Paste a job description and your resume, then generate to see your live 8.5×11 document preview here."
          />
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-muted/30">
      <SiteHeader current="tailor" variant="compact" />

      <SplitWorkspaceLayout leftPane={leftPane} rightPane={rightPane} />

      <SquareCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        jobDescription={jobDescription}
        onSuccess={handleCheckoutSuccess}
      />

      <AchievementIntakeModal
        open={achievementIntakeOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAchievementIntakeOpen(false)
            if (pendingGenerateOptions) {
              void handleGenerate({ ...pendingGenerateOptions, skipAchievementIntake: true })
              setPendingGenerateOptions(null)
            }
          }
        }}
        questions={achievementQuestions}
        onSubmit={handleAchievementIntakeSubmit}
        isSubmitting={isLoading}
      />

      <PanelExperienceIntakeModal
        open={panelExperienceOpen}
        onOpenChange={setPanelExperienceOpen}
        questions={panelExperienceQuestions}
        onSubmit={(answers) => void handlePanelExperienceSubmit(answers)}
        isSubmitting={panelReviseLoading}
      />
    </div>
  )
}
