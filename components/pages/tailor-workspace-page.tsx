'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { HiringPanelStep } from '@/components/hiring-panel/hiring-panel-step'
import { PremiumUnlockBanner } from '@/components/billing/premium-unlock-banner'
import { SquareCheckoutModal } from '@/components/billing/square-checkout-modal'
import { SiteHeader } from '@/components/layout/site-header'
import { TrustBanner } from '@/components/layout/trust-banner'
import { SeoFaqSection } from '@/components/marketing/seo-faq-section'
import { TargetSkillsPanel } from '@/components/resume/target-skills-panel'
import { CoverLetterPreview } from '@/components/results/cover-letter-preview'
import { KeywordReportPanel } from '@/components/results/keyword-report'
import { RecalculateScoreToolbar } from '@/components/results/recalculate-score-toolbar'
import type { SkillSnippetSelection } from '@/components/results/editable-skill-snippet-picker'
import { applyAnchoredSkillModifications, selectionsToAnchoredModifications } from '@/lib/resume/apply-skill-modifications'
import { EditableResumePreview } from '@/components/results/editable-resume-preview'
import { ResumeDiffView } from '@/components/results/resume-diff-view'
import { ResumePreview } from '@/components/results/resume-preview'
import { UndoRedoToolbar } from '@/components/results/undo-redo-toolbar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PreviewScoreBanner } from '@/components/workspace/preview-score-banner'
import { ResumeLetterPage } from '@/components/workspace/resume-letter-page'
import { SplitWorkspaceLayout } from '@/components/workspace/split-workspace-layout'
import { WorkspaceAccordion } from '@/components/workspace/workspace-accordion'
import { GenerateStep } from '@/components/wizard/generate-step'
import { JobDescriptionStep } from '@/components/wizard/job-description-step'
import {
  ResumeInputStep,
  getResumeTextForSubmit,
  isResumeInputReady,
  type ResumeFileParseState,
} from '@/components/wizard/resume-input-step'
import { formatScorePassLine } from '@/lib/api/generation-config'
import { useJobPass } from '@/hooks/use-job-pass'
import { useAtsScoreRecalculation } from '@/hooks/use-ats-score-recalculation'
import { useSavedResume } from '@/hooks/use-saved-resume'
import { RESUME_STEP_ANCHOR_ID } from '@/lib/wizard/workspace-focus-guide'
import { useUndoableResume } from '@/hooks/use-undoable-resume'
import { coalesceStreamingResume, consumeGenerationStream } from '@/lib/api/progress-stream'
import { consumeHiringPanelStream } from '@/lib/api/hiring-panel-stream'
import { parseApiErrorResponse } from '@/lib/api/client-fetch'
import type { GenerationResult, KeywordReport, TailoredResume } from '@/lib/ai/schemas'
import type { HiringPanelResult } from '@/lib/ai/hiring-panel-schemas'
import type { PreScanResult } from '@/lib/resume/pre-scan-preparation'
import { serializeTailoredResume } from '@/lib/resume/ats-score'

type GenerationResultWithMeta = GenerationResult & {
  refinementPasses?: number
  targetScoreMet?: boolean
  preScan?: PreScanResult
  incorporatedKeywords?: string[]
}

type GenerateOptions = {
  selectedKeywords?: string[]
  customSnippets?: string[]
  anchoredModifications?: ReturnType<typeof selectionsToAnchoredModifications>
  resumeOverride?: string
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
  const [previewTab, setPreviewTab] = useState<'tailored' | 'audit'>('tailored')
  const [hiringPanelLoading, setHiringPanelLoading] = useState(false)
  const [hiringPanelStep, setHiringPanelStep] = useState(0)
  const [hiringPanelLabel, setHiringPanelLabel] = useState<string | null>(null)
  const [hiringPanelResult, setHiringPanelResult] = useState<HiringPanelResult | null>(null)
  const {
    accessToken,
    isUnlocked,
    unlock,
    checkoutEnabled,
    jobDescriptionHash,
    passExpiryLabel,
  } = useJobPass(jobDescription)

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

      setResult(data)
      resetEditedResume(data.tailoredResume)
      setBaselineTailoredResume(data.tailoredResume)
      setEditedKeywordReport(data.keywordReport)
      setBaselineKeywordReport(data.keywordReport)
      if (data.preScan) {
        setBaselinePreScan(data.preScan)
        setEditedPreScan(data.preScan)
      }
      setCoverLetter(data.coverLetter)

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
      toast.error(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRunHiringPanel() {
    if (!canGenerate || isLoading || hiringPanelLoading) return

    setHiringPanelLoading(true)
    setHiringPanelStep(0)
    setHiringPanelLabel(null)
    setHiringPanelResult(null)

    try {
      const response = await fetch('/api/hiring-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: jobDescription.trim(),
          resumeText: activeResumeText,
        }),
      })

      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Hiring panel failed'))
      }

      const panelResult = await consumeHiringPanelStream(response, (step, label) => {
        setHiringPanelStep(step)
        setHiringPanelLabel(label)
      })

      setHiringPanelResult(panelResult)
      toast.success('Elite Hiring Manager Panel review complete')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Hiring panel failed')
    } finally {
      setHiringPanelLoading(false)
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
          onGenerate={() => handleGenerate()}
          isLoading={isLoading}
          loadingStep={loadingStep}
          loadingLabel={loadingLabel}
          scorePassLines={scorePassLines}
          streamingResume={streamingResume}
          streamingCoverLetter={streamingCoverLetter}
          disabled={!canGenerate || hiringPanelLoading}
          hideStreamingPreview
        />
        <HiringPanelStep
          onRun={handleRunHiringPanel}
          isLoading={hiringPanelLoading}
          loadingStep={hiringPanelStep}
          loadingLabel={hiringPanelLabel}
          disabled={!canGenerate || isLoading}
          result={hiringPanelResult}
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
        tailoredBaselineScore={
          baselineKeywordReport?.matchScore ?? result?.keywordReport.matchScore
        }
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
    </div>
  )
}
